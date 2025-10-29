import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { ReorderBannersDto, MoveBannerDto } from './dto/reorder-banners.dto';
import { Banner } from './entities/banner.entity';
import { QueryFailedError, Repository, In } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationDto } from 'src/shared/dto/pagination.dto';
import { PaginationUtil } from 'src/shared/utils/pagination.util';
import { UploadService } from 'src/shared/upload.service';

@Injectable()
export class BannerService {

  constructor(
    @InjectRepository(Banner)
    private readonly bannerRepository: Repository<Banner>,
    private readonly uploadService: UploadService,
  ) { }

  async create(createBannerDto: CreateBannerDto, imageFile: Express.Multer.File) {
    try {
      // Validate file type
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedMimeTypes.includes(imageFile.mimetype)) {
        throw new BadRequestException('Invalid file type. Only JPG, PNG, and WebP are allowed.');
      }

      // Generate file name from banner title (remove spaces and special characters)
      const fileName = createBannerDto.title.replace(/[^a-zA-Z0-9]/g, '');
      const fileExtension = imageFile.originalname.split('.').pop();
      const s3Key = `banners/${fileName}.${fileExtension}`;

      // Upload file to S3
      const imageUrl = await this.uploadService.uploadFile(
        imageFile.buffer,
        imageFile.mimetype,
        s3Key
      );

      // Get next sequence number (auto-assign if not provided)
      let sequence = createBannerDto.sequence;
      if (sequence === undefined) {
        const maxSequence = await this.bannerRepository
          .createQueryBuilder('banner')
          .select('MAX(banner.sequence)', 'max')
          .getRawOne();

        sequence = (maxSequence?.max || 0) + 1;
      }

      // Create banner with image URL and sequence
      const banner = this.bannerRepository.create({
        ...createBannerDto,
        image_url: imageUrl,
        sequence: sequence
      });

      return await this.bannerRepository.save(banner);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof QueryFailedError) {
        throw new ConflictException('Error creating banner');
      }
      throw new BadRequestException(error.message);
    }
  }

  async findAll(paginationDto: PaginationDto, orderBy?: string) {
    try {
      // Validate order_by parameter
      const allowedOrderFields = ['sequence', 'title', 'created_at', 'updated_at'];
      const orderField = orderBy && allowedOrderFields.includes(orderBy) ? orderBy : 'sequence';
      
      // Check if pagination parameters are provided
      const hasPaginationParams = paginationDto.page !== undefined || paginationDto.limit !== undefined;
      
      if (hasPaginationParams) {
        // Use pagination when page or limit is specified
        // Override sortOrder to ASC when ordering by sequence
        if (orderField === 'sequence') {
          paginationDto.sortOrder = 'ASC';
        }
        
        return PaginationUtil.findWithPagination(
          this.bannerRepository,
          paginationDto,
          ['title', 'subtitle', 'cta_button', 'status', 'promotion_type'],
          orderField
        );
      } else {
        // Return all banners without pagination
        return this.findAllWithoutPagination(paginationDto, orderField);
      }
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  private async findAllWithoutPagination(paginationDto: PaginationDto, orderField: string) {
    const queryBuilder = this.bannerRepository.createQueryBuilder('banner');
    
    // Apply search filter if provided
    if (paginationDto.search) {
      queryBuilder.andWhere(
        '(banner.title ILIKE :search OR banner.subtitle ILIKE :search)',
        { search: `%${paginationDto.search}%` }
      );
    }
    
    // Apply status filter if provided
    if (paginationDto.status !== undefined) {
      queryBuilder.andWhere('banner.status = :status', { status: paginationDto.status });
    }
    
    // Apply ordering - sequence always in ASC order
    if (orderField === 'sequence') {
      queryBuilder.orderBy('banner.sequence', 'ASC');
    } else {
      queryBuilder.orderBy(`banner.${orderField}`, paginationDto.sortOrder || 'ASC');
    }
    
    const banners = await queryBuilder.getMany();
    
    return {
      data: banners,
      meta: {
        page: 1,
        limit: banners.length,
        total: banners.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      }
    };
  }

  async findOne(id: number) {
    try {
      const banner = await this.bannerRepository.findOne({ where: { id } });
      if (!banner) {
        throw new NotFoundException('Banner not found');
      }
      return banner;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  async findActive() {
    try {
      const banners = await this.bannerRepository.find({
        where: { status: true },
        order: { sequence: 'ASC' }
      });
      return banners;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async update(id: number, updateBannerDto: UpdateBannerDto, imageFile?: Express.Multer.File) {
    try {
      const banner = await this.bannerRepository.findOne({ where: { id } });
      if (!banner) {
        throw new NotFoundException('Banner not found');
      }

      let updateData = { ...updateBannerDto };

      // Handle file upload if provided
      if (imageFile) {
        // Validate file type
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedMimeTypes.includes(imageFile.mimetype)) {
          throw new BadRequestException('Invalid file type. Only JPG, PNG, and WebP are allowed.');
        }

        // Delete old file if it exists
        if (banner.image_url) {
          try {
            await this.uploadService.deleteFileFromUrl(banner.image_url);
          } catch (error) {
            console.warn('Failed to delete old image file:', error.message);
          }
        }

        // Generate new file name
        const fileName = (updateBannerDto.title || banner.title).replace(/[^a-zA-Z0-9]/g, '');
        const fileExtension = imageFile.originalname.split('.').pop();
        const s3Key = `banners/${fileName}.${fileExtension}`;

        // Upload new file
        const imageUrl = await this.uploadService.uploadFile(
          imageFile.buffer,
          imageFile.mimetype,
          s3Key
        );

        (updateData as any).image_url = imageUrl;
      }

      await this.bannerRepository.update(id, updateData);
      return await this.bannerRepository.findOne({ where: { id } });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof QueryFailedError) {
        throw new ConflictException('Error updating banner');
      }
      throw new BadRequestException(error.message);
    }
  }

  async remove(id: number) {
    try {
      const banner = await this.bannerRepository.findOne({ where: { id } });
      if (!banner) {
        throw new NotFoundException('Banner not found');
      }

      // Delete file from S3 if it exists
      if (banner.image_url) {
        try {
          await this.uploadService.deleteFileFromUrl(banner.image_url);
        } catch (error) {
          console.warn('Failed to delete image file:', error.message);
        }
      }

      await this.bannerRepository.delete(id);
      return { message: 'Banner deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  async reorderBanners(reorderDto: ReorderBannersDto) {
    try {
      const { banners } = reorderDto;

      // Validate all banner IDs exist
      const bannerIds = banners.map(b => b.id);
      const existingBanners = await this.bannerRepository.find({
        where: { id: In(bannerIds) }
      });

      if (existingBanners.length !== bannerIds.length) {
        throw new BadRequestException('Some banners not found');
      }

      // Start transaction
      return await this.bannerRepository.manager.transaction(async manager => {
        // Update all banners with new sequences
        for (const banner of banners) {
          await manager.update(Banner, 
            { id: banner.id }, 
            { sequence: banner.sequence }
          );
        }

        return { message: 'Banners reordered successfully' };
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  async moveBanner(id: number, moveDto: MoveBannerDto) {
    try {
      const { new_position } = moveDto;

      // Find the banner to move
      const banner = await this.bannerRepository.findOne({ where: { id } });
      if (!banner) {
        throw new NotFoundException('Banner not found');
      }

      // Get all banners, ordered by sequence
      const allBanners = await this.bannerRepository.find({
        order: { sequence: 'ASC' }
      });

      // Remove the banner from its current position
      const bannersWithoutMoved = allBanners.filter(b => b.id !== id);

      // Insert the banner at the new position
      const reorderedBanners: Banner[] = [];
      for (let i = 0; i < bannersWithoutMoved.length; i++) {
        if (i === new_position - 1) {
          reorderedBanners.push(banner);
        }
        reorderedBanners.push(bannersWithoutMoved[i]);
      }

      // If new position is beyond the current length, add at the end
      if (new_position > bannersWithoutMoved.length) {
        reorderedBanners.push(banner);
      }

      // Start transaction and update all sequences
      return await this.bannerRepository.manager.transaction(async manager => {
        for (let i = 0; i < reorderedBanners.length; i++) {
          await manager.update(Banner, 
            { id: reorderedBanners[i].id }, 
            { sequence: i + 1 }
          );
        }

        return { message: 'Banner moved successfully' };
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  async normalizeSequences() {
    try {
      const banners = await this.bannerRepository.find({
        order: { sequence: 'ASC' }
      });

      // Renumber sequences to eliminate gaps
      return await this.bannerRepository.manager.transaction(async manager => {
        for (let i = 0; i < banners.length; i++) {
          await manager.update(Banner, banners[i].id, { sequence: i + 1 });
        }

        return { message: 'Sequences normalized successfully' };
      });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}

