import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsInt, Min } from "class-validator";

export class AddCollectionEntriesDto {
  @ApiProperty({
    example: [101, 205, 399],
    description: "List of item IDs or store IDs based on collection type",
    type: [Number],
  })
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  entity_ids: number[];
}
