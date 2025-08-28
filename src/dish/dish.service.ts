import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateDishDto } from './dto/create-dish.dto';
import { UpdateDishDto } from './dto/update-dish.dto';
import { Dish } from './entities/dish.entity';
import { QueryFailedError, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationDto } from 'src/shared/dto/pagination.dto';
import { PaginationUtil } from 'src/shared/utils/pagination.util';

@Injectable()
export class DishService {

  constructor(
    @InjectRepository(Dish)
    private readonly dishRepository: Repository<Dish>,
  ) { }

  async create(createDishDto: CreateDishDto) {
    try {
      const dish = this.dishRepository.create(createDishDto);
      return await this.dishRepository.save(dish);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        throw new ConflictException('Duplicate entry');
      }
      throw new BadRequestException(error.message);
    }
  }

  async findAll(paginationDto: PaginationDto) {
    try {
      return PaginationUtil.findWithPagination(
        this.dishRepository,
        paginationDto,
        ['name', 'description', 'status', 'icon'],
        'created_at'
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }

  }

  async findOne(id: number) {
    try {
      const dish = await this.dishRepository.findOne({ where: { id } });
      if (!dish) {
        throw new NotFoundException('Dish not found');
      }
      return dish;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  async update(id: number, updateDishDto: UpdateDishDto) {
    try {
      const dish = await this.dishRepository.findOne({ where: { id } });
      if (!dish) {
        throw new NotFoundException('Dish not found');
      }
      await this.dishRepository.update(id, updateDishDto);
      return { message: 'Dish updated successfully' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  async remove(id: number) {
    try {
      const dish = await this.dishRepository.findOne({ where: { id } });
      if (!dish) {
        throw new NotFoundException('Dish not found');
      }
      await this.dishRepository.delete(id);
      return { message: 'Dish deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
