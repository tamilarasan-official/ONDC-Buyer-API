import { Type } from "class-transformer";
import { IsNotEmpty, IsNumber } from "class-validator";

export class GenerateOtpDto {
    
    @IsNotEmpty()
    @IsNumber()
    @Type(() => Number)
    phone_number: number;
}