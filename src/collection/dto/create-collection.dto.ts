import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from "class-validator";
import { CollectionPage, CollectionType } from "../entities/collection.entity";

export class CreateCollectionDto {
  @ApiProperty({ example: "Dosa Picks" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @ApiPropertyOptional({ example: "Featured items for home grid" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: "https://cdn.example.com/collections/home-grid.jpg" })
  @IsOptional()
  @IsUrl()
  image_url?: string;

  @ApiProperty({ enum: CollectionType, example: CollectionType.ITEM })
  @IsEnum(CollectionType)
  type: CollectionType;

  @ApiProperty({ enum: CollectionPage, example: CollectionPage.HOME })
  @IsEnum(CollectionPage)
  page: CollectionPage;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value.toLowerCase() === "true";
    }
    return value;
  })
  @IsBoolean()
  status?: boolean;
}

