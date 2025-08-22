import { Type } from "class-transformer";
import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateUserDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    email?: string;

    @IsNumber()
    @Type(() => Number)
    phone_number: number;

    @IsOptional()
    @IsBoolean()
    status?: boolean;
}
