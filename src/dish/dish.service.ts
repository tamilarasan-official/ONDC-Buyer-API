import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateDishDto } from './dto/create-dish.dto';
import { UpdateDishDto } from './dto/update-dish.dto';
import { ReorderDishesDto, MoveDishDto } from './dto/reorder-dishes.dto';
import { Dish } from './entities/dish.entity';
import { QueryFailedError, Repository, In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationDto } from 'src/shared/dto/pagination.dto';
import { UploadService } from 'src/shared/upload.service';

@Injectable()
export class DishService {

  constructor(
    @InjectRepository(Dish)
    private readonly dishRepository: Repository<Dish>,
    private readonly uploadService: UploadService,
  ) { }

  async create(createDishDto: CreateDishDto, iconFile: Express.Multer.File) {
    try {
      // Generate file name from dish name (remove spaces and special characters)
      const fileName = createDishDto.name.replace(/[^a-zA-Z0-9]/g, '');
      const fileExtension = iconFile.originalname.split('.').pop();
      const s3Key = `dishes/${fileName}.${fileExtension}`;

      // Upload file to S3
      const iconUrl = await this.uploadService.uploadFile(
        iconFile.buffer,
        iconFile.mimetype,
        s3Key
      );

      // Get next sequence number for this food type
      const maxSequence = await this.dishRepository
        .createQueryBuilder('dish')
        .where('dish.food_type = :foodType', { foodType: createDishDto.food_type })
        .select('MAX(dish.sequence)', 'max')
        .getRawOne();

      const nextSequence = (maxSequence?.max || 0) + 1;

      // Create dish with icon URL and sequence
      const dish = this.dishRepository.create({
        ...createDishDto,
        icon: iconUrl,
        sequence: nextSequence
      });

      return await this.dishRepository.save(dish);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        throw new ConflictException('Dish with this name already exists');
      }
      throw new BadRequestException('Failed to create dish. Please check your data and try again.');
    }
  }

  async findAll(paginationDto: PaginationDto, orderBy?: string) {
    try {
      // Validate order_by parameter
      const allowedOrderFields = ['sequence', 'name', 'created_at', 'updated_at'];
      const orderField = orderBy && allowedOrderFields.includes(orderBy) ? orderBy : 'sequence';
      
      // Check if pagination parameters are provided
      const hasPaginationParams = paginationDto.page !== undefined || paginationDto.limit !== undefined;
      
      if (hasPaginationParams) {
        // Use pagination when page or limit is specified
        // Override sortOrder to ASC when ordering by sequence
        if (orderField === 'sequence') {
          paginationDto.sortOrder = 'ASC';
        }
        
        // Build custom query to handle boolean status field properly
        const baseQueryBuilder = this.dishRepository.createQueryBuilder('dish');
        
        // Apply search filter if provided (only on text fields)
        if (paginationDto.search) {
          baseQueryBuilder.andWhere(
            '(dish.name ILIKE :search OR dish.description ILIKE :search OR dish.food_type ILIKE :search)',
            { search: `%${paginationDto.search}%` }
          );
        }
        
        // Apply status filter if provided (boolean field - direct comparison)
        if (paginationDto.status !== undefined) {
          baseQueryBuilder.andWhere('dish.status = :status', { status: paginationDto.status });
        }
        
        // Apply food_type filter if provided
        if (paginationDto.food_type) {
          baseQueryBuilder.andWhere('dish.food_type = :foodType', { foodType: paginationDto.food_type });
        }
        
        // Get total count
        const total = await baseQueryBuilder.getCount();
        
        // Create a new query builder for getting paginated results
        const dataQueryBuilder = this.dishRepository.createQueryBuilder('dish');
        
        // Apply the same filters to data query
        if (paginationDto.search) {
          dataQueryBuilder.andWhere(
            '(dish.name ILIKE :search OR dish.description ILIKE :search OR dish.food_type ILIKE :search)',
            { search: `%${paginationDto.search}%` }
          );
        }
        
        if (paginationDto.status !== undefined) {
          dataQueryBuilder.andWhere('dish.status = :status', { status: paginationDto.status });
        }
        
        if (paginationDto.food_type) {
          dataQueryBuilder.andWhere('dish.food_type = :foodType', { foodType: paginationDto.food_type });
        }
        
        // Apply ordering - sequence always in ASC order
        if (orderField === 'sequence') {
          dataQueryBuilder.orderBy('dish.sequence', 'ASC');
        } else {
          dataQueryBuilder.orderBy(`dish.${orderField}`, paginationDto.sortOrder || 'ASC');
        }
        
        // Apply pagination
        const page = paginationDto.page || 1;
        const limit = paginationDto.limit || 10;
        const skip = (page - 1) * limit;
        
        dataQueryBuilder.skip(skip).take(limit);
        
        // Get paginated results
        const data = await dataQueryBuilder.getMany();
        
        return {
          data,
          meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNext: page < Math.ceil(total / limit),
            hasPrev: page > 1,
          }
        };
      } else {
        // Return all dishes without pagination
        return this.findAllWithoutPagination(paginationDto, orderField);
      }
    } catch (error) {
      throw new BadRequestException('Failed to retrieve dishes. Please check your parameters and try again.');
    }
  }

  private async findAllWithoutPagination(paginationDto: PaginationDto, orderField: string) {
    const queryBuilder = this.dishRepository.createQueryBuilder('dish');
    
    // Apply search filter if provided
    if (paginationDto.search) {
      queryBuilder.andWhere(
        '(dish.name ILIKE :search OR dish.description ILIKE :search OR dish.food_type ILIKE :search)',
        { search: `%${paginationDto.search}%` }
      );
    }
    
    // Apply status filter if provided
    if (paginationDto.status !== undefined) {
      queryBuilder.andWhere('dish.status = :status', { status: paginationDto.status });
    }
    
    // Apply food_type filter if provided (from controller query)
    if (paginationDto.food_type) {
      queryBuilder.andWhere('dish.food_type = :foodType', { foodType: paginationDto.food_type });
    }
    
    // Apply ordering - sequence always in ASC order
    if (orderField === 'sequence') {
      queryBuilder.orderBy('dish.sequence', 'ASC');
    } else {
      queryBuilder.orderBy(`dish.${orderField}`, paginationDto.sortOrder || 'ASC');
    }
    
    const dishes = await queryBuilder.getMany();
    
    return {
      data: dishes,
      meta: {
        page: 1,
        limit: dishes.length,
        total: dishes.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      }
    };
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
      throw new BadRequestException('Failed to retrieve dish details.');
    }
  }

  async update(id: number, updateDishDto: UpdateDishDto, iconFile?: Express.Multer.File) {
    try {
      const dish = await this.dishRepository.findOne({ where: { id } });
      if (!dish) {
        throw new NotFoundException('Dish not found');
      }

      let updateData = { ...updateDishDto };

      // Handle file upload if provided
      if (iconFile) {
        // Delete old file if it exists
        if (dish.icon) {
          try {
            await this.uploadService.deleteFileFromUrl(dish.icon);
          } catch (error) {
            console.warn('Failed to delete old icon file:', error.message);
          }
        }

        // Generate new file name
        const fileName = (updateDishDto.name || dish.name).replace(/[^a-zA-Z0-9]/g, '');
        const fileExtension = iconFile.originalname.split('.').pop();
        const s3Key = `dishes/${fileName}.${fileExtension}`;

        // Upload new file
        const iconUrl = await this.uploadService.uploadFile(
          iconFile.buffer,
          iconFile.mimetype,
          s3Key
        );

        (updateData as any).icon = iconUrl;
      }

      await this.dishRepository.update(id, updateData);
      return { message: 'Dish updated successfully' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (error instanceof QueryFailedError) {
        throw new ConflictException('Dish with this name already exists');
      }
      throw new BadRequestException('Failed to update dish. Please check your data and try again.');
    }
  }

  async remove(id: number) {
    try {
      const dish = await this.dishRepository.findOne({ where: { id } });
      if (!dish) {
        throw new NotFoundException('Dish not found');
      }

      // Delete file from S3 if it exists
      if (dish.icon) {
        try {
          await this.uploadService.deleteFileFromUrl(dish.icon);
        } catch (error) {
          console.warn('Failed to delete icon file:', error.message);
        }
      }

      await this.dishRepository.delete(id);
      return { message: 'Dish deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete dish. Please try again.');
    }
  }

  async reorderDishes(reorderDto: ReorderDishesDto) {
    try {
      const { dishes, food_type_id } = reorderDto;

      // Validate all dish IDs exist
      const dishIds = dishes.map(d => d.id);
      const existingDishes = await this.dishRepository.find({
        where: { id: In(dishIds) }
      });

      if (existingDishes.length !== dishIds.length) {
        throw new BadRequestException('Some dishes not found');
      }

      // If food_type_id is provided, validate all dishes belong to that food type
      if (food_type_id) {
        const invalidDishes = existingDishes.filter(dish => dish.food_type !== food_type_id.toString());
        if (invalidDishes.length > 0) {
          throw new BadRequestException('Some dishes do not belong to the specified food type');
        }
      }

      // Start transaction
      return await this.dishRepository.manager.transaction(async manager => {
        // If reordering a single item, check if target sequence is already occupied by another dish
        if (dishes.length === 1) {
          const targetDish = dishes[0];
          const occupyingDish = await manager
            .createQueryBuilder(Dish, 'dish')
            .where('dish.sequence = :sequence', { sequence: targetDish.sequence })
            .andWhere('dish.id != :id', { id: targetDish.id })
            .getOne();

          if (occupyingDish) {
            // Swap sequences: move occupying dish to origin sequence
            const originDish = existingDishes.find(d => d.id === targetDish.id);
            if (originDish) {
              await manager.update(Dish, { id: occupyingDish.id }, { sequence: originDish.sequence });
            }
          }
        }

        // Update all dishes with new sequences
        for (const dish of dishes) {
          await manager.update(Dish, 
            { id: dish.id }, 
            { sequence: dish.sequence }
          );
        }

        return { message: 'Dishes reordered successfully' };
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to reorder dishes. Please try again.');
    }
  }

  async moveDish(id: number, moveDto: MoveDishDto) {
    try {
      const { new_position, food_type_id } = moveDto;

      // Find the dish to move
      const dish = await this.dishRepository.findOne({ where: { id } });
      if (!dish) {
        throw new NotFoundException('Dish not found');
      }

      // If food_type_id is provided, validate the dish belongs to that food type
      if (food_type_id && dish.food_type !== food_type_id.toString()) {
        throw new BadRequestException('Dish does not belong to the specified food type');
      }

      // Get all dishes in the same food type, ordered by sequence
      const queryBuilder = this.dishRepository
        .createQueryBuilder('dish')
        .where('dish.food_type = :foodType', { foodType: dish.food_type })
        .orderBy('dish.sequence', 'ASC');

      const allDishes = await queryBuilder.getMany();

      // Remove the dish from its current position
      const dishesWithoutMoved = allDishes.filter(d => d.id !== id);

      // Insert the dish at the new position
      const reorderedDishes: Dish[] = [];
      for (let i = 0; i < dishesWithoutMoved.length; i++) {
        if (i === new_position - 1) {
          reorderedDishes.push(dish);
        }
        reorderedDishes.push(dishesWithoutMoved[i]);
      }

      // If new position is beyond the current length, add at the end
      if (new_position > dishesWithoutMoved.length) {
        reorderedDishes.push(dish);
      }

      // Start transaction and update all sequences
      return await this.dishRepository.manager.transaction(async manager => {
        for (let i = 0; i < reorderedDishes.length; i++) {
          await manager.update(Dish, 
            { id: reorderedDishes[i].id }, 
            { sequence: i + 1 }
          );
        }

        return { message: 'Dish moved successfully' };
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to move dish. Please try again.');
    }
  }

  async normalizeSequences(food_type?: string) {
    try {
      const queryBuilder = this.dishRepository
        .createQueryBuilder('dish')
        .orderBy('dish.sequence', 'ASC');

      if (food_type) {
        queryBuilder.where('dish.food_type = :foodType', { foodType: food_type });
      }

      const dishes = await queryBuilder.getMany();

      // Renumber sequences to eliminate gaps
      return await this.dishRepository.manager.transaction(async manager => {
        for (let i = 0; i < dishes.length; i++) {
          await manager.update(Dish, dishes[i].id, { sequence: i + 1 });
        }

        return { message: 'Sequences normalized successfully' };
      });
    } catch (error) {
      throw new BadRequestException('Failed to normalize sequences. Please try again.');
    }
  }
}
