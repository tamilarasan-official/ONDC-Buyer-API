import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { DishService } from './dish.service';
import { CreateDishDto } from './dto/create-dish.dto';
import { UpdateDishDto } from './dto/update-dish.dto';
import { ReorderDishesDto, MoveDishDto } from './dto/reorder-dishes.dto';
import { PaginationDto } from 'src/shared/dto/pagination.dto';

@ApiTags('Dish Management')
@Controller('dish')
export class DishController {
  constructor(private readonly dishService: DishService) {}

  @Post()
  @UseInterceptors(FileInterceptor('icon'))
  @ApiOperation({
    summary: 'Create a new dish',
    description: 'Create a new dish with name, description, food_type, icon file, and status. Icon file must be jpg, png, or webp format. File will be uploaded to S3 with naming pattern: dishes/{dish-name-without-spaces}.{extension}',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Pizza' },
        description: { type: 'string', example: 'Delicious Italian pizza' },
        food_type: { type: 'string', example: 'Non Veg' },
        status: { type: 'string', example: 'true', description: 'Status as string: "true" or "false"' },
        icon: {
          type: 'string',
          format: 'binary',
          description: 'Icon image file (jpg, png, webp only)'
        }
      },
      required: ['name', 'food_type', 'icon']
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Dish created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Dish created successfully' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            name: { type: 'string', example: 'Pizza' },
            description: { type: 'string', example: 'Delicious Italian pizza' },
            food_type: { type: 'string', example: 'Non Veg' },
            icon: { type: 'string', example: 'https://bucket.com/dishes/Pizza.jpg' },
            sequence: { type: 'number', example: 1 },
            status: { type: 'boolean', example: true },
            created_at: { type: 'string', example: '2025-01-15T12:00:00Z' },
            updated_at: { type: 'string', example: '2025-01-15T12:00:00Z' }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid dish data or file format',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Invalid file format. Only jpg, png, webp allowed' },
        error: { type: 'string', example: 'BAD_REQUEST' }
      }
    }
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Dish name already exists',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Dish with this name already exists' },
        error: { type: 'string', example: 'CONFLICT' }
      }
    }
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - File upload or database operation failed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Failed to upload file or save dish' },
        error: { type: 'string', example: 'INTERNAL_SERVER_ERROR' }
      }
    }
  })
  async create(@Body() createDishDto: CreateDishDto, @UploadedFile() iconFile: Express.Multer.File) {
    if (!iconFile) {
      throw new BadRequestException('Icon file is required');
    }

    // Validate file format
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(iconFile.mimetype)) {
      throw new BadRequestException('Invalid file format. Only jpg, png, webp allowed');
    }

    return this.dishService.create(createDishDto, iconFile);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all dishes',
    description: 'Retrieve dishes with optional filtering and sorting. If no pagination parameters (page/limit) are provided, returns all dishes in a single response. Default ordering is by sequence (drag & drop order) in ASC order.',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number for pagination (optional - if not provided, returns all dishes)',
    example: 1,
    required: false,
    type: 'number'
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of items per page (optional - if not provided, returns all dishes)',
    example: 10,
    required: false,
    type: 'number'
  })
  @ApiQuery({
    name: 'food_type',
    description: 'Filter dishes by food type',
    example: 'Non Veg',
    required: false,
    type: 'string'
  })
  @ApiQuery({
    name: 'status',
    description: 'Filter dishes by status (true/false)',
    example: true,
    required: false,
    type: 'boolean'
  })
  @ApiQuery({
    name: 'search',
    description: 'Search dishes by name or description',
    example: 'pizza',
    required: false,
    type: 'string'
  })
  @ApiQuery({
    name: 'order_by',
    description: 'Order dishes by field (sequence, name, created_at). Note: sequence is always ordered ASC regardless of sortOrder parameter.',
    example: 'sequence',
    required: false,
    type: 'string'
  })
  @ApiResponse({
    status: 200,
    description: 'Dishes retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Dishes retrieved successfully' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 1 },
              name: { type: 'string', example: 'Pizza' },
              description: { type: 'string', example: 'Delicious Italian pizza' },
              food_type: { type: 'string', example: 'Non Veg' },
              icon: { type: 'string', example: 'https://bucket.com/dishes/Pizza.jpg' },
              status: { type: 'boolean', example: true },
              created_at: { type: 'string', example: '2025-01-15T12:00:00Z' },
              updated_at: { type: 'string', example: '2025-01-15T12:00:00Z' }
            }
          }
        },
        meta: {
          type: 'object',
          properties: {
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 10 },
            total: { type: 'number', example: 25 },
            total_pages: { type: 'number', example: 3 },
            has_next: { type: 'boolean', example: true },
            has_prev: { type: 'boolean', example: false }
          }
        }
      }
    }
  })
  async findAll(
    @Query() paginationDto: PaginationDto, 
    @Query('order_by') orderBy?: string,
    @Query('food_type') foodType?: string
  ) {
    // Add food_type to paginationDto for service processing
    if (foodType) {
      paginationDto.food_type = foodType;
    }
    return this.dishService.findAll(paginationDto, orderBy);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get dish by ID',
    description: 'Retrieve a specific dish by its unique identifier.',
  })
  @ApiParam({
    name: 'id',
    description: 'Dish ID to retrieve',
    example: 1,
    type: 'number'
  })
  @ApiResponse({
    status: 200,
    description: 'Dish retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Dish retrieved successfully' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            name: { type: 'string', example: 'Pizza' },
            description: { type: 'string', example: 'Delicious Italian pizza' },
            food_type: { type: 'string', example: 'Non Veg' },
            icon: { type: 'string', example: 'https://bucket.com/dishes/Pizza.jpg' },
            sequence: { type: 'number', example: 1 },
            status: { type: 'boolean', example: true },
            created_at: { type: 'string', example: '2025-01-15T12:00:00Z' },
            updated_at: { type: 'string', example: '2025-01-15T12:00:00Z' }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Dish not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Dish not found' },
        error: { type: 'string', example: 'NOT_FOUND' }
      }
    }
  })
  async findOne(@Param('id') id: string) {
    return this.dishService.findOne(+id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('icon'))
  @ApiOperation({
    summary: 'Update dish',
    description: 'Update an existing dish\'s information including name, description, food_type, icon file, and status. Icon file must be jpg, png, or webp format. File upload is optional for updates. If provided, old file will be deleted and new file uploaded with naming pattern: dishes/{dish-name-without-spaces}.{extension}',
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'id',
    description: 'Dish ID to update',
    example: 1,
    type: 'number'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Updated Pizza' },
        description: { type: 'string', example: 'Updated delicious Italian pizza' },
        food_type: { type: 'string', example: 'Non Veg' },
        status: { type: 'string', example: 'true', description: 'Status as string: "true" or "false"' },
        icon: {
          type: 'string',
          format: 'binary',
          description: 'Icon image file (jpg, png, webp only) - optional for updates'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Dish updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Dish updated successfully' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            name: { type: 'string', example: 'Updated Pizza' },
            description: { type: 'string', example: 'Updated delicious Italian pizza' },
            food_type: { type: 'string', example: 'Non Veg' },
            icon: { type: 'string', example: 'https://bucket.com/dishes/UpdatedPizza.jpg' },
            status: { type: 'boolean', example: true },
            created_at: { type: 'string', example: '2025-01-15T12:00:00Z' },
            updated_at: { type: 'string', example: '2025-01-15T12:30:00Z' }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid dish data or file format',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Invalid file format. Only jpg, png, webp allowed' },
        error: { type: 'string', example: 'BAD_REQUEST' }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Dish not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Dish not found' },
        error: { type: 'string', example: 'NOT_FOUND' }
      }
    }
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Dish name already exists',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Dish with this name already exists' },
        error: { type: 'string', example: 'CONFLICT' }
      }
    }
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - File upload or database operation failed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Failed to upload file or update dish' },
        error: { type: 'string', example: 'INTERNAL_SERVER_ERROR' }
      }
    }
  })
  async update(@Param('id') id: string, @Body() updateDishDto: UpdateDishDto, @UploadedFile() iconFile?: Express.Multer.File) {
    // Validate file format if file is provided
    if (iconFile) {
      const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedMimes.includes(iconFile.mimetype)) {
        throw new BadRequestException('Invalid file format. Only jpg, png, webp allowed');
      }
    }

    return this.dishService.update(+id, updateDishDto, iconFile);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete dish',
    description: 'Delete a dish by its ID. This action cannot be undone. The associated icon file will also be deleted from S3 storage.',
  })
  @ApiParam({
    name: 'id',
    description: 'Dish ID to delete',
    example: 1,
    type: 'number'
  })
  @ApiResponse({
    status: 200,
    description: 'Dish deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Dish deleted successfully' }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Dish not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Dish not found' },
        error: { type: 'string', example: 'NOT_FOUND' }
      }
    }
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - File deletion or database operation failed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Failed to delete dish or associated file' },
        error: { type: 'string', example: 'INTERNAL_SERVER_ERROR' }
      }
    }
  })
  async remove(@Param('id') id: string) {
    return this.dishService.remove(+id);
  }

  @Post('reorder')
  @ApiOperation({
    summary: 'Reorder dishes',
    description: 'Reorder multiple dishes by providing their new sequence positions. Useful for drag and drop functionality.',
  })
  @ApiBody({ type: ReorderDishesDto })
  @ApiResponse({
    status: 200,
    description: 'Dishes reordered successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Dishes reordered successfully' }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid dish data or some dishes not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Some dishes not found' },
        error: { type: 'string', example: 'BAD_REQUEST' }
      }
    }
  })
  async reorderDishes(@Body() reorderDto: ReorderDishesDto) {
    return this.dishService.reorderDishes(reorderDto);
  }

  @Patch(':id/move')
  @ApiOperation({
    summary: 'Move dish to new position',
    description: 'Move a single dish to a specific position within its food type. Other dishes will be automatically reordered.',
  })
  @ApiParam({
    name: 'id',
    description: 'Dish ID to move',
    example: 1,
    type: 'number'
  })
  @ApiBody({ type: MoveDishDto })
  @ApiResponse({
    status: 200,
    description: 'Dish moved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Dish moved successfully' }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Dish not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Dish not found' },
        error: { type: 'string', example: 'NOT_FOUND' }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid position or food type mismatch',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Invalid position' },
        error: { type: 'string', example: 'BAD_REQUEST' }
      }
    }
  })
  async moveDish(@Param('id') id: string, @Body() moveDto: MoveDishDto) {
    return this.dishService.moveDish(+id, moveDto);
  }

  @Post('normalize-sequences')
  @ApiOperation({
    summary: 'Normalize dish sequences',
    description: 'Remove gaps in sequence numbers and renumber dishes in order. Useful for cleanup after deletions.',
  })
  @ApiQuery({
    name: 'food_type',
    description: 'Food type to normalize sequences for (optional)',
    example: 'Veg',
    required: false,
    type: 'string'
  })
  @ApiResponse({
    status: 200,
    description: 'Sequences normalized successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Sequences normalized successfully' }
      }
    }
  })
  async normalizeSequences(@Query('food_type') foodType?: string) {
    return this.dishService.normalizeSequences(foodType);
  }
}
