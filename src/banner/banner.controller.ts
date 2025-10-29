import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { BannerService } from './banner.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { ReorderBannersDto, MoveBannerDto } from './dto/reorder-banners.dto';
import { PaginationDto } from 'src/shared/dto/pagination.dto';

@ApiTags('Banner Management')
@Controller('banner')
export class BannerController {
  constructor(private readonly bannerService: BannerService) {}

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({
    summary: 'Create a new banner',
    description: 'Create a new promotional banner with title, subtitle, CTA button, image file, and other settings. Image file must be jpg, png, or webp format. File will be uploaded to S3 with naming pattern: banners/{title-without-spaces}.{extension}',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'Craving Something Delicious?' },
        subtitle: { type: 'string', example: 'Get your favorite meals delivered hot & fast—right to your doorstep.' },
        cta_button: { type: 'string', example: 'Order Now!' },
        background_color: { type: 'string', example: '#14b8a6' },
        promotion_type: { type: 'string', enum: ['restaurant_id', 'category_id', 'url'], example: 'restaurant_id' },
        promotion_link: { type: 'string', example: '1' },
        sequence: { type: 'number', example: 1, description: 'Auto-assigned if not provided' },
        status: { type: 'string', example: 'true', description: 'Status as string: "true" or "false"' },
        image: {
          type: 'string',
          format: 'binary',
          description: 'Banner image file (jpg, png, webp only)'
        }
      },
      required: ['title', 'image']
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Banner created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        title: { type: 'string', example: 'Craving Something Delicious?' },
        subtitle: { type: 'string', example: 'Get your favorite meals delivered hot & fast—right to your doorstep.' },
        cta_button: { type: 'string', example: 'Order Now!' },
        image_url: { type: 'string', example: 'https://bucket.com/banners/CravingSomethingDelicious.jpg' },
        background_color: { type: 'string', example: '#14b8a6' },
        promotion_type: { type: 'string', example: 'restaurant_id' },
        promotion_link: { type: 'string', example: '1' },
        sequence: { type: 'number', example: 1 },
        status: { type: 'boolean', example: true },
        created_at: { type: 'string', example: '2025-01-15T12:00:00Z' },
        updated_at: { type: 'string', example: '2025-01-15T12:00:00Z' }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid banner data or file format'
  })
  async create(@Body() createBannerDto: CreateBannerDto, @UploadedFile() imageFile: Express.Multer.File) {
    if (!imageFile) {
      throw new BadRequestException('Image file is required');
    }
    return this.bannerService.create(createBannerDto, imageFile);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all banners',
    description: 'Retrieve banners with optional filtering and sorting. If no pagination parameters (page/limit) are provided, returns all banners in a single response. Default ordering is by sequence (drag & drop order) in ASC order.',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number for pagination (optional - if not provided, returns all banners)',
    example: 1,
    required: false,
    type: 'number'
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of items per page (optional - if not provided, returns all banners)',
    example: 10,
    required: false,
    type: 'number'
  })
  @ApiQuery({
    name: 'status',
    description: 'Filter banners by status (true/false)',
    example: true,
    required: false,
    type: 'boolean'
  })
  @ApiQuery({
    name: 'search',
    description: 'Search banners by title or subtitle',
    example: 'Craving',
    required: false,
    type: 'string'
  })
  @ApiQuery({
    name: 'order_by',
    description: 'Order banners by field (sequence, title, created_at). Note: sequence is always ordered ASC regardless of sortOrder parameter.',
    example: 'sequence',
    required: false,
    type: 'string'
  })
  @ApiResponse({
    status: 200,
    description: 'Banners retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 1 },
              title: { type: 'string', example: 'Craving Something Delicious?' },
              subtitle: { type: 'string', example: 'Get your favorite meals delivered hot & fast—right to your doorstep.' },
              cta_button: { type: 'string', example: 'Order Now!' },
              image_url: { type: 'string', example: 'https://bucket.com/banners/CravingSomethingDelicious.jpg' },
              background_color: { type: 'string', example: '#14b8a6' },
              promotion_type: { type: 'string', example: 'restaurant_id' },
              promotion_link: { type: 'string', example: '1' },
              sequence: { type: 'number', example: 1 },
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
            total: { type: 'number', example: 100 },
            totalPages: { type: 'number', example: 10 },
            hasNext: { type: 'boolean', example: true },
            hasPrev: { type: 'boolean', example: false }
          }
        }
      }
    }
  })
  async findAll(
    @Query() paginationDto: PaginationDto,
    @Query('order_by') orderBy?: string
  ) {
    return this.bannerService.findAll(paginationDto, orderBy);
  }

  @Get('active')
  @ApiOperation({
    summary: 'Get active banners',
    description: 'Retrieve all active banners ordered by sequence. Used by the home API.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active banners retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number', example: 1 },
          title: { type: 'string', example: 'Craving Something Delicious?' },
          subtitle: { type: 'string', example: 'Get your favorite meals delivered hot & fast—right to your doorstep.' },
          cta_button: { type: 'string', example: 'Order Now!' },
          image_url: { type: 'string', example: 'https://bucket.com/banners/CravingSomethingDelicious.jpg' },
          background_color: { type: 'string', example: '#14b8a6' },
          promotion_type: { type: 'string', example: 'restaurant_id' },
          promotion_link: { type: 'string', example: '1' },
          sequence: { type: 'number', example: 1 },
          status: { type: 'boolean', example: true }
        }
      }
    }
  })
  async findActive() {
    return this.bannerService.findActive();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a banner by ID',
    description: 'Retrieve a single banner by its ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Banner ID',
    type: 'number',
    example: 1
  })
  @ApiResponse({
    status: 200,
    description: 'Banner retrieved successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'Banner not found'
  })
  async findOne(@Param('id') id: string) {
    return this.bannerService.findOne(+id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({
    summary: 'Update a banner',
    description: 'Update banner details. Image file is optional - if provided, old image will be deleted and new one uploaded.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'id',
    description: 'Banner ID',
    type: 'number',
    example: 1
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'Craving Something Delicious?' },
        subtitle: { type: 'string', example: 'Get your favorite meals delivered hot & fast—right to your doorstep.' },
        cta_button: { type: 'string', example: 'Order Now!' },
        background_color: { type: 'string', example: '#14b8a6' },
        promotion_type: { type: 'string', enum: ['restaurant_id', 'category_id', 'url'], example: 'restaurant_id' },
        promotion_link: { type: 'string', example: '1' },
        sequence: { type: 'number', example: 1 },
        status: { type: 'string', example: 'true', description: 'Status as string: "true" or "false"' },
        image: {
          type: 'string',
          format: 'binary',
          description: 'Banner image file (jpg, png, webp only) - optional'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Banner updated successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'Banner not found'
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid banner data or file format'
  })
  async update(
    @Param('id') id: string,
    @Body() updateBannerDto: UpdateBannerDto,
    @UploadedFile() imageFile?: Express.Multer.File
  ) {
    return this.bannerService.update(+id, updateBannerDto, imageFile);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a banner',
    description: 'Delete a banner by ID. This will also delete the associated image from S3.',
  })
  @ApiParam({
    name: 'id',
    description: 'Banner ID',
    type: 'number',
    example: 1
  })
  @ApiResponse({
    status: 200,
    description: 'Banner deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Banner deleted successfully' }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Banner not found'
  })
  async remove(@Param('id') id: string) {
    return this.bannerService.remove(+id);
  }

  @Post('reorder')
  @ApiOperation({
    summary: 'Reorder banners',
    description: 'Update sequence positions for multiple banners. All banners in the array will be updated with new sequence numbers.',
  })
  @ApiBody({
    type: ReorderBannersDto,
    description: 'Array of banners with their new sequence positions'
  })
  @ApiResponse({
    status: 200,
    description: 'Banners reordered successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Banners reordered successfully' }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Some banners not found'
  })
  async reorderBanners(@Body() reorderDto: ReorderBannersDto) {
    return this.bannerService.reorderBanners(reorderDto);
  }

  @Patch(':id/move')
  @ApiOperation({
    summary: 'Move a banner to a new position',
    description: 'Move a single banner to a new sequence position. Other banners will be automatically reordered.',
  })
  @ApiParam({
    name: 'id',
    description: 'Banner ID',
    type: 'number',
    example: 1
  })
  @ApiBody({
    type: MoveBannerDto,
    description: 'New position for the banner'
  })
  @ApiResponse({
    status: 200,
    description: 'Banner moved successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Banner moved successfully' }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Banner not found'
  })
  async moveBanner(@Param('id') id: string, @Body() moveDto: MoveBannerDto) {
    return this.bannerService.moveBanner(+id, moveDto);
  }

  @Post('normalize-sequences')
  @ApiOperation({
    summary: 'Normalize banner sequences',
    description: 'Renumber all banner sequences sequentially starting from 1 to eliminate gaps.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sequences normalized successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Sequences normalized successfully' }
      }
    }
  })
  async normalizeSequences() {
    return this.bannerService.normalizeSequences();
  }
}

