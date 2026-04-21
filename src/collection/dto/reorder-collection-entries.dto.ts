import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsInt, Min, ValidateNested } from "class-validator";

class ReorderCollectionEntryDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  entry_id: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  new_position: number;
}

export class ReorderCollectionEntriesDto {
  @ApiProperty({ type: [ReorderCollectionEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderCollectionEntryDto)
  entries: ReorderCollectionEntryDto[];
}
