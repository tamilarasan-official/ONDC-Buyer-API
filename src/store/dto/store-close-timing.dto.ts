import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  IsIn,
  IsArray,
  ValidateNested,
  IsOptional,
  IsDateString,
  IsInt,
} from "class-validator";
import { Type } from "class-transformer";

export class StoreCloseTimingItemDto {
  @ApiProperty({
    description: "Store reference ID (ONDC provider ID like 'P1', 'P2') or numeric database ID (e.g., '1', '2'). The system will first try to find by reference_id, then by numeric ID.",
    example: "P1",
    type: "string",
    examples: ["P1", "P2", "1", "2"],
  })
  @IsNotEmpty()
  @IsString()
  store_id: string;

  @ApiProperty({
    description: "Store timing status - 'open' to reopen the store (end active closures), 'closed' to close the store temporarily",
    example: "closed",
    type: "string",
    enum: ["open", "closed"],
    enumName: "StoreTimingStatus",
  })
  @IsNotEmpty()
  @IsString()
  @IsIn(["open", "closed"])
  status: "open" | "closed";

  @ApiProperty({
    description: "Required when status='closed': End datetime for the closure period (ISO 8601 format). Store will reopen at this time.",
    example: "2025-01-15T23:59:59Z",
    type: "string",
    format: "date-time",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  close_end_datetime?: string;

  @ApiProperty({
    description: "Optional when status='closed': Start datetime for the closure period (ISO 8601 format). Defaults to current time if not provided.",
    example: "2025-01-10T10:00:00Z",
    type: "string",
    format: "date-time",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  close_start_datetime?: string;

  @ApiProperty({
    description: "Optional message or reason for closure. Useful for logging and tracking why a store was closed.",
    example: "Temporarily closed for maintenance",
    type: "string",
    required: false,
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({
    description: "Optional location ID for location-specific closures. If not provided, closure applies to all locations of the store.",
    example: 1,
    type: "number",
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  location_id?: number;
}

export class StoreCloseTimingDto {
  @ApiProperty({
    description: "Array of store close timing updates",
    type: [StoreCloseTimingItemDto],
    example: [
      {
        store_id: "P1",
        status: "closed",
        close_start_datetime: "2025-01-10T10:00:00Z",
        close_end_datetime: "2025-01-15T23:59:59Z",
        message: "Temporarily closed for maintenance",
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StoreCloseTimingItemDto)
  stores: StoreCloseTimingItemDto[];
}

