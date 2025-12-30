import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CancelReasonService } from './cancel-reason.service';
import { CreateCancelReasonDto } from './dto/create-cancel-reason.dto';
import { UpdateCancelReasonDto } from './dto/update-cancel-reason.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags("Cancel Reason")
@Controller('cancel-reason')
export class CancelReasonController {
  constructor(private readonly cancelReasonService: CancelReasonService) { }

  @Post()
  create(@Body() createCancelReasonDto: CreateCancelReasonDto) {
    console.log('createCancelReasonDto: ', createCancelReasonDto);
    return this.cancelReasonService.create(createCancelReasonDto);
  }

  @Get()
  findAll() {
    return this.cancelReasonService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cancelReasonService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCancelReasonDto: UpdateCancelReasonDto) {
    return this.cancelReasonService.update(+id, updateCancelReasonDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cancelReasonService.remove(+id);
  }
}
