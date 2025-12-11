import { IsArray, IsInt, IsNotEmpty, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export class BannerSequenceDto {
  @ApiProperty({
    description: "Banner ID",
    example: 1,
    type: "number",
  })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  id: number;

  @ApiProperty({
    description: "New sequence position",
    example: 1,
    type: "number",
  })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  sequence: number;
}

export class ReorderBannersDto {
  @ApiProperty({
    description: "Array of banners with their new sequence positions",
    type: [BannerSequenceDto],
    example: [
      { id: 3, sequence: 1 },
      { id: 1, sequence: 2 },
      { id: 2, sequence: 3 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BannerSequenceDto)
  banners: BannerSequenceDto[];
}

export class MoveBannerDto {
  @ApiProperty({
    description: "New position for the banner",
    example: 1,
    type: "number",
  })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  new_position: number;
}
