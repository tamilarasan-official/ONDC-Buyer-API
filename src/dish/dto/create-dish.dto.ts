import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { StoreDietaryPreference } from "../../shared/enums/store-dietary-preference.enum";

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
    description: "Food type of the dish: pure-veg, veg, non-veg, egg, veg-and-non-veg",
    example: StoreDietaryPreference.NON_VEG,
    required: true,
    enum: StoreDietaryPreference,
    enumName: "StoreDietaryPreference",
  })
  @IsEnum(StoreDietaryPreference)
  @IsNotEmpty()
  food_type: StoreDietaryPreference;

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
