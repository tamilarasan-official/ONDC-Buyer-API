import { Injectable, BadRequestException } from "@nestjs/common";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import * as AWS from "aws-sdk";
import * as dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });
import * as multerS3 from "multer-s3";

@Injectable()
export class UploadService {
  private s3: AWS.S3;
  private readonly bucketName = process.env.AWS_BUCKET_NAME;
  private readonly bucketUrl = process.env.AWS_BUCKET_URL;
  private readonly envName = process.env.AWS_ENV_NAME;

  constructor() {
    this.s3 = new AWS.S3({
      endpoint: new AWS.Endpoint(this.bucketUrl || ""),
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
      s3ForcePathStyle: true,
      signatureVersion: "v4",
    });
  }

  getMulterOptions(folder: string) {
    return {
      storage: multerS3({
        s3: this.s3,
        bucket: this.bucketName,
        acl: "public-read",
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
          const fileExt = file.originalname.split(".").pop();
          const fileName = `${folder}/${uuidv4()}.${fileExt}`;
          cb(null, fileName);
        },
      }),
    };
  }

  getFileUrl(folder: string, fileName: string): string {
    return `${this.bucketUrl}/${this.bucketName}/${folder}/${fileName}`;
  }

  async uploadFile(
    buffer: Buffer,
    mimetype: string,
    key: string,
  ): Promise<string> {
    await this.s3
      .putObject({
        Bucket: this.bucketName || "",
        Key: `${this.envName}/${key}`,
        Body: buffer,
        ContentType: mimetype,
        ACL: "public-read",
      })
      .promise();

    return `${this.bucketUrl}/${this.bucketName}/${this.envName}/${key}`;
  }

  get bucketBaseUrl(): string {
    return `${this.bucketUrl}/${this.bucketName}`;
  }

  async deleteFile(key: string) {
    await this.s3
      .deleteObject({
        Bucket: this.bucketName || "",
        Key: `${this.envName}/${key}`,
      })
      .promise();
  }

  async deleteFileFromUrl(url: string) {
    try {
      // Handle both URL formats:
      // Format 1: https://bucket.your-endpoint.com/path/to/file
      // Format 2: https://your-endpoint.com/bucket/path/to/file

      let key = "";

      // Try to extract key from new format (with bucket in URL)
      if (url.includes(this.bucketBaseUrl)) {
        key =
          url.split(this.bucketBaseUrl + "/")[1] ||
          url.split(this.bucketBaseUrl)[1];
      }
      // Handle older format where bucket is in path (database format)
      else if (url.includes(`/${this.bucketName}/`)) {
        key = url.split(`/${this.bucketName}/`)[1];
      }
      // Fallback: try to find bucket name in URL
      else {
        const urlParts = url.split("/");
        const bucketIndex = urlParts.findIndex(
          (part) => part === this.bucketName,
        );
        if (bucketIndex !== -1 && bucketIndex < urlParts.length - 1) {
          key = urlParts.slice(bucketIndex + 1).join("/");
        }
      }

      if (!key) {
        console.error("Failed to extract S3 key from URL:", url);
        return false;
      }

      // The key should already include env path (e.g., "production/stores/1/logo/file.jpg")
      await this.s3
        .deleteObject({
          Bucket: this.bucketName || "",
          Key: key,
        })
        .promise();

      return true;
    } catch (error) {
      console.error("Error deleting file from S3:", error);
      return false;
    }
  }
}
