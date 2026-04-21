import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { StoreDietaryPreference } from "../../shared/enums/store-dietary-preference.enum";
import { normalizeHHMMValue } from "../utils/hhmm.util";
import { normalizeSessionsPayload } from "../utils/session-input.util";

export class DishSessionDto {
  private static pick(obj: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        return obj[key];
      }
    }
    for (const key of keys) {
      if (key in obj) {
        return obj[key];
      }
    }
    return undefined;
  }

  @ApiProperty({ description: "Start day (1=Mon ... 7=Sun)", example: 1 })
  @Transform(({ value, obj }) => {
    const src = (obj ?? {}) as Record<string, unknown>;
    return Number(value ?? DishSessionDto.pick(src, ["day_from", "dayFrom"]));
  })
  @IsInt()
  @Min(1)
  @Max(7)
  day_from: number;

  @ApiProperty({ description: "End day (1=Mon ... 7=Sun)", example: 7 })
  @Transform(({ value, obj }) => {
    const src = (obj ?? {}) as Record<string, unknown>;
    return Number(value ?? DishSessionDto.pick(src, ["day_to", "dayTo"]));
  })
  @IsInt()
  @Min(1)
  @Max(7)
  day_to: number;

  @ApiProperty({ description: "Start time in HHMM format", example: 700 })
  @Transform(({ value, obj }) => {
    const src = (obj ?? {}) as Record<string, unknown>;
    return normalizeHHMMValue(
      value ??
        DishSessionDto.pick(src, [
          "start_hhmm",
          "start_time",
          "startTime",
          "startHhmm",
          "from",
        ]),
    );
  })
  @IsInt()
  @Min(0)
  @Max(2359)
  start_hhmm: number;

  @ApiProperty({ description: "End time in HHMM format", example: 1130 })
  @Transform(({ value, obj }) => {
    const src = (obj ?? {}) as Record<string, unknown>;
    return normalizeHHMMValue(
      value ??
        DishSessionDto.pick(src, [
          "end_hhmm",
          "end_time",
          "endTime",
          "endHhmm",
          "to",
        ]),
    );
  })
  @IsInt()
  @Min(0)
  @Max(2359)
  end_hhmm: number;

  @ApiProperty({
    description: "Optional session label",
    example: "Breakfast",
    required: false,
  })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({
    description: "Status of this schedule window",
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

  @ApiProperty({
    description: "Enable time-based session filtering for this dish",
    example: true,
    required: false,
    default: false,
  })
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value.toLowerCase() === "true";
    }
    return value;
  })
  @IsBoolean()
  @IsOptional()
  schedule_enabled?: boolean;

  @ApiProperty({
    description: "Optional schedule windows in IST",
    required: false,
    type: [DishSessionDto],
  })
  @Transform(({ value }) => normalizeSessionsPayload(value))
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @Type(() => DishSessionDto)
  @ValidateNested({ each: true })
  sessions?: DishSessionDto[];
}
