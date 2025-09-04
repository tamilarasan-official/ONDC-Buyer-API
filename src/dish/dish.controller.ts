import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { DishService } from './dish.service';
import { CreateDishDto } from './dto/create-dish.dto';
import { UpdateDishDto } from './dto/update-dish.dto';
import { PaginationDto } from 'src/shared/dto/pagination.dto';

@ApiTags('Dish Management')
@Controller('dish')
export class DishController {
  constructor(private readonly dishService: DishService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new dish',
    description: 'Create a new dish with name, description, icon, and status. Dishes are used for categorization and search purposes.',
  })
  @ApiBody({ type: CreateDishDto })
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
            icon: { type: 'string', example: 'https://example.com/pizza-icon.png' },
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
    description: 'Bad request - Invalid dish data',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Dish name is required' },
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
  async create(@Body() createDishDto: CreateDishDto) {
    return this.dishService.create(createDishDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all dishes',
    description: 'Retrieve a paginated list of all dishes with optional filtering and sorting options.',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number for pagination',
    example: 1,
    required: false,
    type: 'number'
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of items per page',
    example: 10,
    required: false,
    type: 'number'
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
              icon: { type: 'string', example: 'https://example.com/pizza-icon.png' },
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
  async findAll(@Query() paginationDto: PaginationDto) {
    return this.dishService.findAll(paginationDto);
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
            icon: { type: 'string', example: 'https://example.com/pizza-icon.png' },
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
  @ApiOperation({
    summary: 'Update dish',
    description: 'Update an existing dish\'s information including name, description, icon, and status.',
  })
  @ApiParam({
    name: 'id',
    description: 'Dish ID to update',
    example: 1,
    type: 'number'
  })
  @ApiBody({ type: UpdateDishDto })
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
            icon: { type: 'string', example: 'https://example.com/updated-pizza-icon.png' },
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
    description: 'Bad request - Invalid dish data',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Invalid dish data' },
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
  async update(@Param('id') id: string, @Body() updateDishDto: UpdateDishDto) {
    return this.dishService.update(+id, updateDishDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete dish',
    description: 'Delete a dish by its ID. This action cannot be undone.',
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
  async remove(@Param('id') id: string) {
    return this.dishService.remove(+id);
  }
}
