import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { DishService } from './dish.service';
import { CreateDishDto } from './dto/create-dish.dto';
import { UpdateDishDto } from './dto/update-dish.dto';
import { PaginationDto } from 'src/shared/dto/pagination.dto';

@Controller('dish')
export class DishController {
  constructor(private readonly dishService: DishService) {}

  @Post()
  async create(@Body() createDishDto: CreateDishDto) {
    return this.dishService.create(createDishDto);
  }

  @Get()
  async findAll(@Query() paginationDto: PaginationDto) {
    return this.dishService.findAll(paginationDto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.dishService.findOne(+id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateDishDto: UpdateDishDto) {
    return this.dishService.update(+id, updateDishDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.dishService.remove(+id);
  }
}
