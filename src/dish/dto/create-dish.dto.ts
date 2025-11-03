import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export class CreateDishDto {
  @ApiProperty({
    description: "Name of the dish",
    example: "Pizza",
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: "Description of the dish",
    example: "Delicious Italian pizza with fresh ingredients",
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: "Food type of the dish",
    example: "Italian",
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(["pure-veg", "veg", "non-veg", "egg", "veg-and-non-veg"])
  food_type: string;

  @ApiProperty({
    description: "Status of the dish (active/inactive)",
    example: true,
    required: false,
    default: true,
  })
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value.toLowerCase() === "true";
    }
    return value;
  })
  @IsBoolean()
  @IsOptional()
  status?: boolean;
}
