import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsNotEmpty } from "class-validator";

export class MoveCollectionDto {
  @ApiProperty({
    description: "New position for the collection",
    example: 1,
    type: "number",
  })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  new_position: number;
}

