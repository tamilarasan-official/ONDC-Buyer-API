import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsString,
} from "class-validator";
import { Type } from "class-transformer";

export enum ExportFormat {
  CSV = "csv",
  PDF = "pdf",
  ZIP = "zip",
}

export class ExportCodesDto {
  @ApiProperty({
    description: "Export format",
    enum: ExportFormat,
    example: ExportFormat.CSV,
  })
  @IsNotEmpty()
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @ApiProperty({
    description: "Include QR codes in export",
    example: true,
    default: false,
    required: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  include_qr?: boolean;

  @ApiProperty({
    description: "User ID who is exporting (for audit)",
    example: "admin@example.com",
    required: false,
  })
  @IsOptional()
  @IsString()
  exported_by?: string;
}

