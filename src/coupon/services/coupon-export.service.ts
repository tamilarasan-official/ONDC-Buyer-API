import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Coupon } from "../entities/coupon.entity";
import { CouponCampaign } from "../entities/coupon-campaign.entity";
import { ExportFormat } from "../dto/export-codes.dto";
// Note: Install required packages: npm install qrcode puppeteer archiver @types/qrcode
// import * as QRCode from "qrcode";
// import * as puppeteer from "puppeteer";
// import { create } from "archiver";

// QRCode and Puppeteer imports commented - install packages if needed

@Injectable()
export class CouponExportService {
  private readonly logger = new Logger(CouponExportService.name);

  constructor(
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
    @InjectRepository(CouponCampaign)
    private readonly campaignRepository: Repository<CouponCampaign>,
  ) {}

  /**
   * Export codes to CSV
   */
  async exportCSV(
    campaignId: number,
    includeQr: boolean = false,
  ): Promise<string> {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    const coupons = await this.couponRepository.find({
      where: { campaign_id: campaignId },
      order: { created_at: "ASC" },
    });

    let csv = "campaign_key,code,status,created_at,expires_at";
    if (includeQr) {
      csv += ",qr_url";
    }
    csv += "\n";

    const baseUrl = process.env.APP_URL || "https://app.example.com";

    for (const coupon of coupons) {
      const row = [
        campaign.campaign_key,
        coupon.code,
        coupon.status,
        coupon.created_at.toISOString(),
        coupon.end_at ? coupon.end_at.toISOString() : "",
      ];

      if (includeQr) {
        const qrUrl = `${baseUrl}/redeem?code=${coupon.code}`;
        row.push(qrUrl);
      }

      csv += row.map((cell) => `"${cell}"`).join(",") + "\n";
    }

    return csv;
  }

  /**
   * Export codes to PDF
   */
  async exportPDF(
    campaignId: number,
    includeQr: boolean = false,
  ): Promise<Buffer> {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    const coupons = await this.couponRepository.find({
      where: { campaign_id: campaignId },
      order: { created_at: "ASC" },
      take: 1000, // Limit for PDF
    });

    // Puppeteer requires installation: npm install puppeteer
    // Uncomment when puppeteer is installed:
    // const puppeteer = require('puppeteer');
    // const browser = await puppeteer.launch({
    //   headless: true,
    //   args: ["--no-sandbox", "--disable-setuid-sandbox"],
    // });
    // 
    // try {
    //   const page = await browser.newPage();
    //
    //   // Generate QR codes if needed
    //   const qrCodes: Record<string, string> = {};
    //   if (includeQr) {
    //     // QR Code generation requires 'qrcode' package
    //     // Install: npm install qrcode @types/qrcode
    //     // const QRCode = require('qrcode');
    //     // const baseUrl = process.env.APP_URL || "https://app.example.com";
    //     // for (const coupon of coupons) {
    //     //   const qrUrl = `${baseUrl}/redeem?code=${coupon.code}`;
    //     //   qrCodes[coupon.code] = await QRCode.toDataURL(qrUrl);
    //     // }
    //   }
    //
    //   // Generate HTML
    //   const html = this.generatePDFHTML(campaign, coupons, qrCodes, includeQr);
    //
    //   await page.setContent(html, { waitUntil: "networkidle0" });
    //   const pdf = await page.pdf({
    //     format: "A4",
    //     printBackground: true,
    //     margin: { top: 10, right: 10, bottom: 10, left: 10 },
    //   });
    //
    //   return Buffer.from(pdf);
    // } finally {
    //   await browser.close();
    // }
    
    throw new Error("PDF export requires 'puppeteer' package. Install: npm install puppeteer");
  }

  /**
   * Generate HTML for PDF
   */
  private generatePDFHTML(
    campaign: CouponCampaign,
    coupons: Coupon[],
    qrCodes: Record<string, string>,
    includeQr: boolean,
  ): string {
    const codesPerPage = 10;
    const pages: string[] = [];

    for (let i = 0; i < coupons.length; i += codesPerPage) {
      const pageCoupons = coupons.slice(i, i + codesPerPage);
      const pageHtml = `
        <div style="page-break-after: always; padding: 20px; font-family: Arial, sans-serif;">
          <h2 style="text-align: center; margin-bottom: 30px;">${campaign.title}</h2>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
            ${pageCoupons
              .map(
                (coupon) => `
              <div style="border: 2px solid #000; padding: 15px; text-align: center;">
                <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">${coupon.code}</div>
                ${
                  includeQr && qrCodes[coupon.code]
                    ? `<img src="${qrCodes[coupon.code]}" style="width: 100px; height: 100px; margin: 10px auto; display: block;" />`
                    : ""
                }
                <div style="font-size: 12px; color: #666;">
                  ${coupon.end_at ? `Expires: ${coupon.end_at.toLocaleDateString()}` : "No expiration"}
                </div>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      `;
      pages.push(pageHtml);
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page { margin: 0; }
            body { margin: 0; padding: 0; }
          </style>
        </head>
        <body>
          ${pages.join("")}
        </body>
      </html>
    `;
  }

  /**
   * Export codes to ZIP (CSV + PDF + metadata.json)
   */
  async exportZIP(
    campaignId: number,
    includeQr: boolean = false,
  ): Promise<Buffer> {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new Error("Campaign not found");
    }

    const csv = await this.exportCSV(campaignId, includeQr);
    const pdf = await this.exportPDF(campaignId, includeQr);

    const metadata = {
      campaign_key: campaign.campaign_key,
      title: campaign.title,
      export_date: new Date().toISOString(),
      total_codes: await this.couponRepository.count({
        where: { campaign_id: campaignId },
      }),
    };

    // Archiver requires installation: npm install archiver
    // Uncomment when archiver is installed:
    // const archiver = require('archiver');
    // const archive = archiver.create("zip", { zlib: { level: 9 } });
    // const chunks: Buffer[] = [];
    // archive.on("data", (chunk) => chunks.push(chunk));
    // archive.append(csv, { name: "codes.csv" });
    // archive.append(pdf, { name: "codes.pdf" });
    // archive.append(JSON.stringify(metadata, null, 2), { name: "metadata.json" });
    // await archive.finalize();
    // return new Promise((resolve, reject) => {
    //   archive.on("end", () => resolve(Buffer.concat(chunks)));
    //   archive.on("error", reject);
    // });
    
    throw new Error("ZIP export requires 'archiver' package. Install: npm install archiver");
  }

  /**
   * Mark campaign as exported
   */
  async markExported(
    campaignId: number,
    exportedBy?: string,
  ): Promise<void> {
    await this.couponRepository.update(
      { campaign_id: campaignId },
      {
        exported: true,
        exported_by: exportedBy,
        exported_at: new Date(),
      },
    );
  }
}

