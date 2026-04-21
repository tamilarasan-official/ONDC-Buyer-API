import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { CollectionPage, CollectionType } from "../entities/collection.entity";

export class HomeCollectionQueryDto {
  @ApiPropertyOptional({ enum: CollectionType, example: CollectionType.ITEM })
  @IsOptional()
  @IsEnum(CollectionType)
  type?: CollectionType;

  @ApiPropertyOptional({ enum: CollectionPage, example: CollectionPage.HOME })
  @IsOptional()
  @IsEnum(CollectionPage)
  page?: CollectionPage;
}
