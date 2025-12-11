import {
  IsString,
  IsNotEmpty,
  IsPhoneNumber,
  IsEnum,
  IsOptional,
} from "class-validator";
import { OtpPurpose } from "../entities/otp-verification.entity";

export class SendOtpDto {
  @IsString()
  @IsNotEmpty()
  @IsPhoneNumber("IN")
  phone_number: string;

  @IsEnum(OtpPurpose)
  @IsOptional()
  purpose?: OtpPurpose = OtpPurpose.REGISTRATION;
}

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  @IsPhoneNumber("IN")
  phone_number: string;

  @IsString()
  @IsNotEmpty()
  otp: string;

  @IsEnum(OtpPurpose)
  @IsOptional()
  purpose?: OtpPurpose = OtpPurpose.REGISTRATION;
}
