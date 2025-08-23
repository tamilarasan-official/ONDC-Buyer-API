import { PartialType } from '@nestjs/swagger';
import { CreateAddressDto, CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {}

export class UpdateAddressDto extends PartialType(CreateAddressDto) {}