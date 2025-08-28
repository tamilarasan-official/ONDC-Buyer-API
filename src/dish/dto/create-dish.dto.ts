import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateDishDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    icon?: string;

    @IsBoolean()
    @IsOptional()
    status?: boolean;

}
