import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsOptional,
} from "class-validator";
import { Type } from "class-transformer";

export class StoreStatusUpdateItemDto {
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
    description: "Store status - true to enable the store, false to disable it",
    example: true,
    type: "boolean",
  })
  @IsNotEmpty()
  @IsBoolean()
  status: boolean;

  @ApiProperty({
    description: "Optional message or reason for status change. Useful for logging and tracking why a store was closed or opened.",
    example: "Store temporarily closed for maintenance",
    type: "string",
    required: false,
  })
  @IsOptional()
  @IsString()
  message?: string;
}

export class StoreStatusUpdateDto {
  @ApiProperty({
    description: "Array of store status updates",
    type: [StoreStatusUpdateItemDto],
    example: [
      {
        store_id: "P1",
        status: true,
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StoreStatusUpdateItemDto)
  stores: StoreStatusUpdateItemDto[];
}

