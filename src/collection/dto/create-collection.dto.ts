import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { CollectionFiltersDto } from "./collection-filters.dto";

export class CreateCollectionDto {
  @ApiProperty({ example: "Dosa Picks" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @ApiPropertyOptional({ type: CollectionFiltersDto })
  @IsOptional()
  @Type(() => CollectionFiltersDto)
  filters?: CollectionFiltersDto;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  status?: boolean;
}

