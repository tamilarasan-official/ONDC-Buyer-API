import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AdminAccessService } from './super-admin-access.service';
import { CreateAdminAccessDto } from './dto/create-admin-access.dto';
import { UpdateAdminAccessDto } from './dto/update-admin-access.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags("Super Admin Access")
@Controller('super-admin-access')
export class AdminAccessController {
  constructor(private readonly AdminAccessservice: AdminAccessService) { }

  @Post()
  create(@Body() dto: CreateAdminAccessDto) {
    console.log('dto: ', dto);
    return this.AdminAccessservice.create(dto);
  }

  @Get()
  findAll() {
    return this.AdminAccessservice.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.AdminAccessservice.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: number,
    @Body() dto: UpdateAdminAccessDto,
  ) {
    return this.AdminAccessservice.update(+id, dto);
  }

  @Post(':id/regenerate-api-key')
  regenerateApiKey(@Param('id') id: number) {
    return this.AdminAccessservice.regenerateApiKey(+id);
  }

  @Post(':id/disable')
  disable(@Param('id') id: number) {
    return this.AdminAccessservice.disable(+id);
  }
}
