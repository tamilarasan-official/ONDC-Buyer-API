import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CreateBannerDto } from "./dto/create-banner.dto";
import { UpdateBannerDto } from "./dto/update-banner.dto";
import { ReorderBannersDto, MoveBannerDto } from "./dto/reorder-banners.dto";
import { Banner } from "./entities/banner.entity";
import { QueryFailedError, Repository, In } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { PaginationDto } from "src/shared/dto/pagination.dto";
import { UploadService } from "src/shared/upload.service";
import { Store } from "../store/entities/store.entity";
import { Collection } from "../collection/entities/collection.entity";
import { TimezoneUtil } from "../shared/utils/timezone.util";

@Injectable()
export class BannerService {
  constructor(
    @InjectRepository(Banner)
    private readonly bannerRepository: Repository<Banner>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
    private readonly uploadService: UploadService,
  ) {}

  private toBoolean(value: unknown, fallback = false): boolean {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
    return Boolean(value);
  }

  private normalizeHHMM(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
    if (typeof value !== "string") return 0;
    const raw = value.trim();
    if (!raw) return 0;
    if (/^\d{1,4}$/.test(raw)) return parseInt(raw, 10);
    const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{1,2}(?:\.\d+)?)?$/);
    if (match) return Number(match[1]) * 100 + Number(match[2]);
    return 0;
  }

  private normalizeBannerSessions(rawSessions?: unknown): Array<{
    day_from: number;
    day_to: number;
    start_hhmm: number;
    end_hhmm: number;
    label?: string;
    status: boolean;
  }> {
    if (rawSessions === undefined || rawSessions === null || rawSessions === "") {
      return [];
    }
    let parsed: unknown = rawSessions;
    if (typeof rawSessions === "string") {
      try {
        parsed = JSON.parse(rawSessions);
      } catch {
        throw new BadRequestException("Invalid sessions format. Expected JSON array.");
      }
    }
    if (!Array.isArray(parsed)) {
      throw new BadRequestException("Invalid sessions format. Expected JSON array.");
    }
    type NormalizedBannerSession = {
      day_from: number;
      day_to: number;
      start_hhmm: number;
      end_hhmm: number;
      label?: string;
      status: boolean;
    };
    const sessions: Array<NormalizedBannerSession | null> = parsed
      .map((row: any, idx: number) => {
      // Ignore blank placeholder rows from multipart/form UIs.
      const hasAnyValue =
        row &&
        typeof row === "object" &&
        (row.day_from !== undefined ||
          row.dayFrom !== undefined ||
          row.day_to !== undefined ||
          row.dayTo !== undefined ||
          row.start_hhmm !== undefined ||
          row.startTime !== undefined ||
          row.from !== undefined ||
          row.end_hhmm !== undefined ||
          row.endTime !== undefined ||
          row.to !== undefined);
      if (!hasAnyValue) {
        return null;
      }
      const dayFrom = Number(row?.day_from ?? row?.dayFrom);
      const dayTo = Number(row?.day_to ?? row?.dayTo);
      const start = this.normalizeHHMM(row?.start_hhmm ?? row?.startTime ?? row?.from);
      const end = this.normalizeHHMM(row?.end_hhmm ?? row?.endTime ?? row?.to);
      if (!Number.isFinite(dayFrom) || dayFrom < 1 || dayFrom > 7) {
        throw new BadRequestException(`Invalid day_from at session index ${idx}`);
      }
      if (!Number.isFinite(dayTo) || dayTo < 1 || dayTo > 7) {
        throw new BadRequestException(`Invalid day_to at session index ${idx}`);
      }
      if (start < 0 || start > 2359 || end < 0 || end > 2359) {
        throw new BadRequestException(`Invalid session time at session index ${idx}`);
      }
      if (start === end) {
        throw new BadRequestException(`start_hhmm and end_hhmm cannot be equal at session index ${idx}`);
      }
      return {
        day_from: dayFrom,
        day_to: dayTo,
        start_hhmm: start,
        end_hhmm: end,
        label: row?.label ? String(row.label) : undefined,
        status: row?.status !== false,
      };
      })
      .filter((session) => session !== null);
    return sessions as NormalizedBannerSession[];
  }

  private isSessionActiveNow(session: {
    day_from: number;
    day_to: number;
    start_hhmm: number;
    end_hhmm: number;
    status?: boolean;
  }): boolean {
    if (session.status === false) return false;
    const currentDay = TimezoneUtil.getCurrentISTDay();
    const currentTime = TimezoneUtil.getCurrentISTTimeHHMM();
    const inDayRange =
      session.day_from <= session.day_to
        ? currentDay >= session.day_from && currentDay <= session.day_to
        : currentDay >= session.day_from || currentDay <= session.day_to;
    if (!inDayRange) return false;
    if (session.end_hhmm < session.start_hhmm) {
      return currentTime >= session.start_hhmm || currentTime <= session.end_hhmm;
    }
    return currentTime >= session.start_hhmm && currentTime <= session.end_hhmm;
  }

  private isBannerVisibleNow(banner: Banner): boolean {
    const scheduleEnabled = this.toBoolean((banner as any).schedule_enabled, false);
    if (!scheduleEnabled) return true;
    const sessions = Array.isArray((banner as any).sessions)
      ? ((banner as any).sessions as any[])
      : [];
    if (sessions.length === 0) return false;
    return sessions.some((session) => this.isSessionActiveNow(session));
  }

  private async validatePromotionData(
    promotionType?: string,
    promotionLink?: string | null,
  ): Promise<void> {
    if (!promotionType) return;

    if (promotionType === "restaurant_id") {
      const store = await this.storeRepository.findOne({
        where: { reference_id: promotionLink || "" },
      });
      if (!store) {
        throw new BadRequestException("Restaurant not found");
      }
      return;
    }

    if (promotionType === "category_id") {
      if (!promotionLink) {
        throw new BadRequestException(
          "promotion_link is required for category_id type",
        );
      }
      return;
    }

    if (promotionType === "collection_id") {
      if (!promotionLink) {
        throw new BadRequestException(
          "promotion_link is required for collection_id type",
        );
      }
      const collectionId = Number(promotionLink);
      if (!Number.isFinite(collectionId) || collectionId <= 0) {
        throw new BadRequestException(
          "promotion_link must be a valid collection id for collection_id type",
        );
      }
      const collection = await this.collectionRepository.findOne({
        where: { id: collectionId, status: true },
      });
      if (!collection) {
        throw new BadRequestException("Active collection not found");
      }
      return;
    }

    if (promotionType === "url") {
      if (!promotionLink) {
        throw new BadRequestException("promotion_link is required for url type");
      }
      try {
        new URL(promotionLink);
      } catch {
        throw new BadRequestException(
          "promotion_link must be a valid URL for url type",
        );
      }
    }
    // organization type: no link validation required.
  }

  async create(
    createBannerDto: CreateBannerDto,
    imageFile: Express.Multer.File,
    rawSessions?: unknown,
  ) {
    try {
      // Validate file type
      const allowedMimeTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
      ];
      if (!allowedMimeTypes.includes(imageFile.mimetype)) {
        throw new BadRequestException(
          "Invalid file type. Only JPG, PNG, and WebP are allowed.",
        );
      }

      await this.validatePromotionData(
        createBannerDto.promotion_type,
        createBannerDto.promotion_link,
      );
      const scheduleEnabled = this.toBoolean(
        (createBannerDto as any).schedule_enabled,
        false,
      );
      const normalizedSessions = this.normalizeBannerSessions(
        rawSessions !== undefined ? rawSessions : (createBannerDto as any).sessions,
      );

      // Generate file name from banner title (remove spaces and special characters)
      // Include timestamp for cache busting
      const timestamp = Date.now();
      const fileName = (createBannerDto.title ?? "banner").replace(/[^a-zA-Z0-9]/g, "") || "banner";
      const fileExtension = imageFile.originalname.split(".").pop();
      const s3Key = `banners/${fileName}-${timestamp}.${fileExtension}`;

      // Upload file to S3
      const imageUrl = await this.uploadService.uploadFile(
        imageFile.buffer,
        imageFile.mimetype,
        s3Key,
      );

      // Auto-assign next sequence number
      const maxSequence = await this.bannerRepository
        .createQueryBuilder("banner")
        .select("MAX(banner.sequence)", "max")
        .getRawOne();

      const sequence = (maxSequence?.max || 0) + 1;

      // Create banner with image URL and sequence
      const banner = this.bannerRepository.create({
        ...createBannerDto,
        schedule_enabled: scheduleEnabled,
        sessions: normalizedSessions,
        image_url: imageUrl,
        sequence: sequence,
      });

      return await this.bannerRepository.save(banner);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof QueryFailedError) {
        throw new ConflictException("Error creating banner");
      }
      throw new BadRequestException(
        "Failed to create banner. Please check your data and try again.",
      );
    }
  }

  async findAll(paginationDto: PaginationDto, orderBy?: string) {
    try {
      // Validate order_by parameter
      const allowedOrderFields = [
        "sequence",
        "title",
        "created_at",
        "updated_at",
      ];
      const orderField =
        orderBy && allowedOrderFields.includes(orderBy) ? orderBy : "sequence";

      // Check if pagination parameters are provided
      const hasPaginationParams =
        paginationDto.page !== undefined || paginationDto.limit !== undefined;

      if (hasPaginationParams) {
        // Use pagination when page or limit is specified
        // Override sortOrder to ASC when ordering by sequence
        if (orderField === "sequence") {
          paginationDto.sortOrder = "ASC";
        }

        // Build custom query to handle boolean status field properly
        const baseQueryBuilder =
          this.bannerRepository.createQueryBuilder("banner");

        // Apply search filter if provided (only on text fields)
        if (paginationDto.search) {
          baseQueryBuilder.andWhere(
            "(banner.title ILIKE :search OR banner.subtitle ILIKE :search OR banner.cta_button ILIKE :search OR banner.promotion_type ILIKE :search)",
            { search: `%${paginationDto.search}%` },
          );
        }

        // Apply status filter if provided (boolean field - direct comparison)
        if (paginationDto.status !== undefined) {
          baseQueryBuilder.andWhere("banner.status = :status", {
            status: paginationDto.status,
          });
        }

        // Get total count
        const total = await baseQueryBuilder.getCount();

        // Create a new query builder for getting paginated results
        const dataQueryBuilder =
          this.bannerRepository.createQueryBuilder("banner");

        // Apply the same filters to data query
        if (paginationDto.search) {
          dataQueryBuilder.andWhere(
            "(banner.title ILIKE :search OR banner.subtitle ILIKE :search OR banner.cta_button ILIKE :search OR banner.promotion_type ILIKE :search)",
            { search: `%${paginationDto.search}%` },
          );
        }

        if (paginationDto.status !== undefined) {
          dataQueryBuilder.andWhere("banner.status = :status", {
            status: paginationDto.status,
          });
        }

        // Apply ordering - sequence always in ASC order
        if (orderField === "sequence") {
          dataQueryBuilder.orderBy("banner.sequence", "ASC");
        } else {
          dataQueryBuilder.orderBy(
            `banner.${orderField}`,
            paginationDto.sortOrder || "ASC",
          );
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
          },
        };
      } else {
        // Return all banners without pagination
        return this.findAllWithoutPagination(paginationDto, orderField);
      }
    } catch (error) {
      throw new BadRequestException(
        "Failed to retrieve banners. Please check your parameters and try again.",
      );
    }
  }

  private async findAllWithoutPagination(
    paginationDto: PaginationDto,
    orderField: string,
  ) {
    const queryBuilder = this.bannerRepository.createQueryBuilder("banner");

    // Apply search filter if provided
    if (paginationDto.search) {
      queryBuilder.andWhere(
        "(banner.title ILIKE :search OR banner.subtitle ILIKE :search)",
        { search: `%${paginationDto.search}%` },
      );
    }

    // Apply status filter if provided
    if (paginationDto.status !== undefined) {
      queryBuilder.andWhere("banner.status = :status", {
        status: paginationDto.status,
      });
    }

    // Apply ordering - sequence always in ASC order
    if (orderField === "sequence") {
      queryBuilder.orderBy("banner.sequence", "ASC");
    } else {
      queryBuilder.orderBy(
        `banner.${orderField}`,
        paginationDto.sortOrder || "ASC",
      );
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
      },
    };
  }

  async findOne(id: number) {
    try {
      const banner = await this.bannerRepository.findOne({ where: { id } });
      if (!banner) {
        throw new NotFoundException("Banner not found");
      }
      return banner;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException("Failed to retrieve banner details.");
    }
  }

  async findActive() {
    try {
      const bannersRaw = await this.bannerRepository.find({
        where: { status: true },
        order: { sequence: "ASC" },
      });
      return bannersRaw.filter((banner) => this.isBannerVisibleNow(banner));
    } catch (error) {
      throw new BadRequestException("Failed to retrieve active banners.");
    }
  }

  async update(
    id: number,
    updateBannerDto: UpdateBannerDto,
    imageFile?: Express.Multer.File,
    rawSessions?: unknown,
  ) {
    try {
      const banner = await this.bannerRepository.findOne({ where: { id } });
      if (!banner) {
        throw new NotFoundException("Banner not found");
      }

      const updateData = { ...updateBannerDto };
      const effectivePromotionType =
        updateBannerDto.promotion_type ?? banner.promotion_type;
      const effectivePromotionLink =
        updateBannerDto.promotion_link ?? banner.promotion_link;
      await this.validatePromotionData(
        effectivePromotionType,
        effectivePromotionLink,
      );
      const scheduleEnabled =
        (updateBannerDto as any).schedule_enabled !== undefined
          ? this.toBoolean((updateBannerDto as any).schedule_enabled, false)
          : this.toBoolean((banner as any).schedule_enabled, false);
      // Prefer rawSessions (raw string/value from @Body("sessions")) over DTO-transformed value,
      // which may be stripped by the class-validator whitelist pipeline for multipart requests.
      const incomingSessions =
        rawSessions !== undefined
          ? rawSessions
          : (updateBannerDto as any).sessions;
      const scheduleConfigUpdated =
        (updateBannerDto as any).schedule_enabled !== undefined ||
        incomingSessions !== undefined;
      const normalizedSessions =
        incomingSessions !== undefined
          ? this.normalizeBannerSessions(incomingSessions)
          : Array.isArray((banner as any).sessions)
            ? ((banner as any).sessions as any[])
            : [];
      (updateData as any).schedule_enabled = scheduleEnabled;
      (updateData as any).sessions = normalizedSessions;

      // Handle file upload if provided
      if (imageFile) {
        // Validate file type
        const allowedMimeTypes = [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/webp",
        ];
        if (!allowedMimeTypes.includes(imageFile.mimetype)) {
          throw new BadRequestException(
            "Invalid file type. Only JPG, PNG, and WebP are allowed.",
          );
        }

        // Delete old file if it exists
        if (banner.image_url) {
          try {
            await this.uploadService.deleteFileFromUrl(banner.image_url);
          } catch (error) {
            console.warn("Failed to delete old image file:", error.message);
          }
        }

        // Generate new file name
        // Include timestamp for cache busting
        const timestamp = Date.now();
        const fileName = (updateBannerDto.title || banner.title).replace(
          /[^a-zA-Z0-9]/g,
          "",
        );
        const fileExtension = imageFile.originalname.split(".").pop();
        const s3Key = `banners/${fileName}-${timestamp}.${fileExtension}`;

        // Upload new file
        const imageUrl = await this.uploadService.uploadFile(
          imageFile.buffer,
          imageFile.mimetype,
          s3Key,
        );

        (updateData as any).image_url = imageUrl;
      }

      const updatedBanner = this.bannerRepository.merge(banner, updateData);
      return await this.bannerRepository.save(updatedBanner);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      if (error instanceof QueryFailedError) {
        throw new ConflictException("Error updating banner");
      }
      throw new BadRequestException(
        "Failed to update banner. Please check your data and try again.",
      );
    }
  }

  async remove(id: number) {
    try {
      const banner = await this.bannerRepository.findOne({ where: { id } });
      if (!banner) {
        throw new NotFoundException("Banner not found");
      }

      // Delete file from S3 if it exists
      if (banner.image_url) {
        try {
          await this.uploadService.deleteFileFromUrl(banner.image_url);
        } catch (error) {
          console.warn("Failed to delete image file:", error.message);
        }
      }

      await this.bannerRepository.delete(id);
      return { message: "Banner deleted successfully" };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        "Failed to delete banner. Please try again.",
      );
    }
  }

  async reorderBanners(reorderDto: ReorderBannersDto) {
    try {
      const { banners } = reorderDto;

      // Validate all banner IDs exist
      const bannerIds = banners.map((b) => b.id);
      const existingBanners = await this.bannerRepository.find({
        where: { id: In(bannerIds) },
      });

      if (existingBanners.length !== bannerIds.length) {
        throw new BadRequestException("Some banners not found");
      }

      // Start transaction
      return await this.bannerRepository.manager.transaction(
        async (manager) => {
          // If reordering a single item, check if target sequence is already occupied by another banner
          if (banners.length === 1) {
            const targetBanner = banners[0];
            const occupyingBanner = await manager
              .createQueryBuilder(Banner, "banner")
              .where("banner.sequence = :sequence", {
                sequence: targetBanner.sequence,
              })
              .andWhere("banner.id != :id", { id: targetBanner.id })
              .getOne();

            if (occupyingBanner) {
              // Swap sequences: move occupying banner to origin sequence
              const originBanner = existingBanners.find(
                (b) => b.id === targetBanner.id,
              );
              if (originBanner) {
                await manager.update(
                  Banner,
                  { id: occupyingBanner.id },
                  { sequence: originBanner.sequence },
                );
              }
            }
          }

          // Update all banners with new sequences
          for (const banner of banners) {
            await manager.update(
              Banner,
              { id: banner.id },
              { sequence: banner.sequence },
            );
          }

          return { message: "Banners reordered successfully" };
        },
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        "Failed to reorder banners. Please try again.",
      );
    }
  }

  async moveBanner(id: number, moveDto: MoveBannerDto) {
    try {
      const { new_position } = moveDto;

      // Find the banner to move
      const banner = await this.bannerRepository.findOne({ where: { id } });
      if (!banner) {
        throw new NotFoundException("Banner not found");
      }

      // Get all banners, ordered by sequence
      const allBanners = await this.bannerRepository.find({
        order: { sequence: "ASC" },
      });

      // Remove the banner from its current position
      const bannersWithoutMoved = allBanners.filter((b) => b.id !== id);

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
      return await this.bannerRepository.manager.transaction(
        async (manager) => {
          for (let i = 0; i < reorderedBanners.length; i++) {
            await manager.update(
              Banner,
              { id: reorderedBanners[i].id },
              { sequence: i + 1 },
            );
          }

          return { message: "Banner moved successfully" };
        },
      );
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException("Failed to move banner. Please try again.");
    }
  }

  async normalizeSequences() {
    try {
      const banners = await this.bannerRepository.find({
        order: { sequence: "ASC" },
      });

      // Renumber sequences to eliminate gaps
      return await this.bannerRepository.manager.transaction(
        async (manager) => {
          for (let i = 0; i < banners.length; i++) {
            await manager.update(Banner, banners[i].id, { sequence: i + 1 });
          }

          return { message: "Sequences normalized successfully" };
        },
      );
    } catch (error) {
      throw new BadRequestException(
        "Failed to normalize sequences. Please try again.",
      );
    }
  }
}
