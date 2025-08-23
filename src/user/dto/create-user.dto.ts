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

export class CreateAddressDto {
    @IsString()
    address1: string;

    @IsOptional()
    @IsString()
    address2?: string;

    @IsOptional()
    @IsString()
    address3?: string;

    @IsString()
    city: string;

    @IsString()
    state: string;

    @IsString()
    pincode: string;

    @IsNumber()
    @Type(() => Number)
    latitude: number;

    @IsNumber()
    @Type(() => Number)
    longitude: number;

    @IsString()
    type: string;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    alternate_phone_number?: number;

    @IsOptional()
    @IsBoolean()
    is_default?: boolean;
}
