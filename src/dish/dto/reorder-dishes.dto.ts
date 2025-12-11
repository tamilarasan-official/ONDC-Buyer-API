import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export class DishSequenceDto {
  @ApiProperty({
    description: "Dish ID",
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

export class ReorderDishesDto {
  @ApiProperty({
    description: "Array of dishes with their new sequence positions",
    type: [DishSequenceDto],
    example: [
      { id: 3, sequence: 1 },
      { id: 1, sequence: 2 },
      { id: 2, sequence: 3 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DishSequenceDto)
  dishes: DishSequenceDto[];

  @ApiProperty({
    description: "Food type ID to reorder within (optional)",
    example: 1,
    required: false,
    type: "number",
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  food_type_id?: number;
}

export class MoveDishDto {
  @ApiProperty({
    description: "New position for the dish",
    example: 1,
    type: "number",
  })
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  new_position: number;

  @ApiProperty({
    description: "Food type ID to move within (optional)",
    example: 1,
    required: false,
    type: "number",
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  food_type_id?: number;
}
