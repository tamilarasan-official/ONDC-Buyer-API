import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CreateDishDto } from "./dto/create-dish.dto";
import { UpdateDishDto } from "./dto/update-dish.dto";
import { ReorderDishesDto, MoveDishDto } from "./dto/reorder-dishes.dto";
import { Dish } from "./entities/dish.entity";
import { DishSession } from "./entities/dish-session.entity";
import { QueryFailedError, Repository, In } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { PaginationDto } from "src/shared/dto/pagination.dto";
import { UploadService } from "src/shared/upload.service";
import { TimezoneUtil } from "src/shared/utils/timezone.util";
import { isValidHHMM, normalizeHHMMValue } from "./utils/hhmm.util";
import { normalizeSessionsPayload } from "./utils/session-input.util";
import { isDishActiveNow } from "./utils/dish-visibility.util";

@Injectable()
export class DishService {
  constructor(
    @InjectRepository(Dish)
    private readonly dishRepository: Repository<Dish>,
    @InjectRepository(DishSession)
    private readonly dishSessionRepository: Repository<DishSession>,
    private readonly uploadService: UploadService,
  ) {}

  async create(
    createDishDto: CreateDishDto,
    iconFile: Express.Multer.File,
    rawSessionsInput?: unknown,
  ) {
    try {
      const normalizedSessions = this.parseSessionsInput(
        rawSessionsInput ?? (createDishDto as any).sessions,
      ) ?? [];
      if ((createDishDto as any).schedule_enabled === true && normalizedSessions.length === 0) {
        throw new BadRequestException(
          "At least one session is required when schedule is enabled.",
        );
      }
      this.validateSessions(normalizedSessions);

      // Generate file name from dish name (remove spaces and special characters)
      const fileName = createDishDto.name.replace(/[^a-zA-Z0-9]/g, "");
      const fileExtension = iconFile.originalname.split(".").pop();
      const s3Key = `dishes/${fileName}.${fileExtension}`;

      // Upload file to S3
      const iconUrl = await this.uploadService.uploadFile(
        iconFile.buffer,
        iconFile.mimetype,
        s3Key,
      );

      // Get next sequence number for this food type
      const maxSequence = await this.dishRepository
        .createQueryBuilder("dish")
        .where("dish.food_type = :foodType", {
          foodType: createDishDto.food_type,
        })
        .select("MAX(dish.sequence)", "max")
        .getRawOne();

      const nextSequence = (maxSequence?.max || 0) + 1;

      // Create dish with icon URL and sequence
      return await this.dishRepository.manager.transaction(async (manager) => {
        const { schedule_enabled, sessions: _omitSessions, ...dishFields } =
          createDishDto as any;
        const dish = manager.create(Dish, {
          ...dishFields,
          icon: iconUrl,
          sequence: nextSequence,
          schedule_enabled: schedule_enabled ?? false,
        });
        const savedDish = await manager.save(Dish, dish);
        await this.replaceSessionsInTransaction(
          manager.getRepository(DishSession),
          savedDish.id,
          normalizedSessions,
        );
        const [enrichedDish] = await this.attachSessionMetadata([savedDish]);
        return enrichedDish;
      });
    } catch (error) {
      if (error instanceof QueryFailedError) {
        throw new ConflictException("Dish with this name already exists");
      }
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to create dish. ${error instanceof Error ? error.message : "Please check your data and try again."}`,
      );
    }
  }

  async findAll(
    paginationDto: PaginationDto,
    orderBy?: string,
    includeAll = false,
  ) {
    try {
      // Validate order_by parameter
      const allowedOrderFields = [
        "sequence",
        "name",
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
        const baseQueryBuilder = this.dishRepository.createQueryBuilder("dish");

        // Apply search filter if provided (only on text fields)
        if (paginationDto.search) {
          baseQueryBuilder.andWhere(
            "(dish.name ILIKE :search OR dish.description ILIKE :search OR dish.food_type ILIKE :search)",
            { search: `%${paginationDto.search}%` },
          );
        }

        // Apply status filter if provided (boolean field - direct comparison)
        if (paginationDto.status !== undefined) {
          baseQueryBuilder.andWhere("dish.status = :status", {
            status: paginationDto.status,
          });
        }

        // Apply food_type filter if provided
        if (paginationDto.food_type) {
          baseQueryBuilder.andWhere("dish.food_type = :foodType", {
            foodType: paginationDto.food_type,
          });
        }

        // Get total count
        const total = await baseQueryBuilder.getCount();

        // Create a new query builder for getting paginated results
        const dataQueryBuilder = this.dishRepository.createQueryBuilder("dish");

        // Apply the same filters to data query
        if (paginationDto.search) {
          dataQueryBuilder.andWhere(
            "(dish.name ILIKE :search OR dish.description ILIKE :search OR dish.food_type ILIKE :search)",
            { search: `%${paginationDto.search}%` },
          );
        }

        if (paginationDto.status !== undefined) {
          dataQueryBuilder.andWhere("dish.status = :status", {
            status: paginationDto.status,
          });
        }

        if (paginationDto.food_type) {
          dataQueryBuilder.andWhere("dish.food_type = :foodType", {
            foodType: paginationDto.food_type,
          });
        }

        // Apply ordering - sequence always in ASC order
        if (orderField === "sequence") {
          dataQueryBuilder
            .orderBy("dish.sequence", "ASC")
            .addOrderBy("dish.id", "ASC");
        } else {
          dataQueryBuilder.orderBy(
            `dish.${orderField}`,
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
        const enrichedData = await this.attachSessionMetadata(data);
        const filteredData = this.filterVisibleDishes(enrichedData, includeAll);

        return {
          data: filteredData,
          meta: {
            page,
            limit,
            total: filteredData.length,
            totalPages: filteredData.length > 0 ? 1 : 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      } else {
        // Return all dishes without pagination
        return this.findAllWithoutPagination(paginationDto, orderField, includeAll);
      }
    } catch (error) {
      throw new BadRequestException(
        "Failed to retrieve dishes. Please check your parameters and try again.",
      );
    }
  }

  private async findAllWithoutPagination(
    paginationDto: PaginationDto,
    orderField: string,
    includeAll = false,
  ) {
    const queryBuilder = this.dishRepository.createQueryBuilder("dish");

    // Apply search filter if provided
    if (paginationDto.search) {
      queryBuilder.andWhere(
        "(dish.name ILIKE :search OR dish.description ILIKE :search OR dish.food_type ILIKE :search)",
        { search: `%${paginationDto.search}%` },
      );
    }

    // Apply status filter if provided
    if (paginationDto.status !== undefined) {
      queryBuilder.andWhere("dish.status = :status", {
        status: paginationDto.status,
      });
    }

    // Apply food_type filter if provided (from controller query)
    if (paginationDto.food_type) {
      queryBuilder.andWhere("dish.food_type = :foodType", {
        foodType: paginationDto.food_type,
      });
    }

    // Apply ordering - sequence always in ASC order
    if (orderField === "sequence") {
      queryBuilder.orderBy("dish.sequence", "ASC").addOrderBy("dish.id", "ASC");
    } else {
      queryBuilder.orderBy(
        `dish.${orderField}`,
        paginationDto.sortOrder || "ASC",
      );
    }

    const dishes = await queryBuilder.getMany();
    const enrichedData = await this.attachSessionMetadata(dishes);
    const filteredData = this.filterVisibleDishes(enrichedData, includeAll);

    return {
      data: filteredData,
      meta: {
        page: 1,
        limit: filteredData.length,
        total: filteredData.length,
        totalPages: filteredData.length > 0 ? 1 : 0,
        hasNext: false,
        hasPrev: false,
      },
    };
  }


  private filterVisibleDishes(dishes: any[], includeAll: boolean): any[] {
    if (includeAll) return dishes;
    return dishes.filter(
      (dish) => Boolean(dish?.status) && Boolean(dish?.is_active_now),
    );
  }

  async getVisibleDishes(options?: {
    foodTypes?: string[];
    limit?: number;
  }): Promise<any[]> {
    const queryBuilder = this.dishRepository
      .createQueryBuilder("dish")
      .where("dish.status = :status", { status: true })
      .orderBy("dish.sequence", "ASC")
      .addOrderBy("dish.id", "ASC");

    if (options?.foodTypes?.length) {
      queryBuilder.andWhere("dish.food_type IN (:...foodTypes)", {
        foodTypes: options.foodTypes,
      });
    }

    const dishes = await queryBuilder.getMany();
    const enrichedData = await this.attachSessionMetadata(dishes);
    const filteredData = this.filterVisibleDishes(enrichedData, false);

    if (options?.limit && options.limit > 0) {
      return filteredData.slice(0, options.limit);
    }
    return filteredData;
  }

  async findOne(id: number) {
    try {
      const dish = await this.dishRepository.findOne({ where: { id } });
      if (!dish) {
        throw new NotFoundException("Dish not found");
      }
      const [enriched] = await this.attachSessionMetadata([dish]);
      return enriched;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException("Failed to retrieve dish details.");
    }
  }

  async update(
    id: number,
    updateDishDto: UpdateDishDto,
    iconFile?: Express.Multer.File,
    rawSessionsInput?: unknown,
  ) {
    try {
      const scheduleEnabledFlag =
        (updateDishDto as any).schedule_enabled === true ||
        (updateDishDto as any).schedule_enabled === "true";
      const normalizedSessions =
        (rawSessionsInput ?? (updateDishDto as any).sessions) !== undefined
          ? this.parseSessionsInput(
              rawSessionsInput ?? (updateDishDto as any).sessions,
            )
          : undefined;
      if (scheduleEnabledFlag && normalizedSessions !== undefined && normalizedSessions.length === 0) {
        throw new BadRequestException(
          "At least one session is required when schedule is enabled.",
        );
      }
      this.validateSessions(normalizedSessions);

      const dish = await this.dishRepository.findOne({ where: { id } });
      if (!dish) {
        throw new NotFoundException("Dish not found");
      }

      const { schedule_enabled, sessions: _omitSessions, ...updateData } =
        updateDishDto as any;

      // Handle file upload if provided
      if (iconFile) {
        // Delete old file if it exists
        if (dish.icon) {
          try {
            await this.uploadService.deleteFileFromUrl(dish.icon);
          } catch (error) {
            console.warn("Failed to delete old icon file:", error.message);
          }
        }

        // Generate new file name
        const fileName = (updateDishDto.name || dish.name).replace(
          /[^a-zA-Z0-9]/g,
          "",
        );
        const fileExtension = iconFile.originalname.split(".").pop();
        const s3Key = `dishes/${fileName}.${fileExtension}`;

        // Upload new file
        const iconUrl = await this.uploadService.uploadFile(
          iconFile.buffer,
          iconFile.mimetype,
          s3Key,
        );

        (updateData as any).icon = iconUrl;
      }

      await this.dishRepository.manager.transaction(async (manager) => {
        await manager.update(Dish, id, {
          ...updateData,
          ...(schedule_enabled !== undefined
            ? { schedule_enabled }
            : {}),
        });
        if (normalizedSessions !== undefined) {
          await this.replaceSessionsInTransaction(
            manager.getRepository(DishSession),
            id,
            normalizedSessions,
          );
        }
      });
      return { message: "Dish updated successfully", data: await this.findOne(id) };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (error instanceof QueryFailedError) {
        throw new ConflictException("Dish with this name already exists");
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to update dish. ${error instanceof Error ? error.message : "Please check your data and try again."}`,
      );
    }
  }

  async remove(id: number) {
    try {
      const dish = await this.dishRepository.findOne({ where: { id } });
      if (!dish) {
        throw new NotFoundException("Dish not found");
      }

      // Delete file from S3 if it exists
      if (dish.icon) {
        try {
          await this.uploadService.deleteFileFromUrl(dish.icon);
        } catch (error) {
          console.warn("Failed to delete icon file:", error.message);
        }
      }

      await this.dishRepository.delete(id);
      return { message: "Dish deleted successfully" };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException("Failed to delete dish. Please try again.");
    }
  }

  async reorderDishes(reorderDto: ReorderDishesDto) {
    try {
      const { dishes, food_type_id } = reorderDto;

      // Validate all dish IDs exist
      const dishIds = dishes.map((d) => d.id);
      const existingDishes = await this.dishRepository.find({
        where: { id: In(dishIds) },
      });

      if (existingDishes.length !== dishIds.length) {
        throw new BadRequestException("Some dishes not found");
      }

      // If food_type_id is provided, validate all dishes belong to that food type
      if (food_type_id) {
        const invalidDishes = existingDishes.filter(
          (dish) => dish.food_type !== food_type_id.toString(),
        );
        if (invalidDishes.length > 0) {
          throw new BadRequestException(
            "Some dishes do not belong to the specified food type",
          );
        }
      }

      // Start transaction
      return await this.dishRepository.manager.transaction(async (manager) => {
        // If reordering a single item, check if target sequence is already occupied by another dish
        if (dishes.length === 1) {
          const targetDish = dishes[0];
          const occupyingDish = await manager
            .createQueryBuilder(Dish, "dish")
            .where("dish.sequence = :sequence", {
              sequence: targetDish.sequence,
            })
            .andWhere("dish.id != :id", { id: targetDish.id })
            .getOne();

          if (occupyingDish) {
            // Swap sequences: move occupying dish to origin sequence
            const originDish = existingDishes.find(
              (d) => d.id === targetDish.id,
            );
            if (originDish) {
              await manager.update(
                Dish,
                { id: occupyingDish.id },
                { sequence: originDish.sequence },
              );
            }
          }
        }

        // Update all dishes with new sequences
        for (const dish of dishes) {
          await manager.update(
            Dish,
            { id: dish.id },
            { sequence: dish.sequence },
          );
        }

        return { message: "Dishes reordered successfully" };
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        "Failed to reorder dishes. Please try again.",
      );
    }
  }

  async moveDish(id: number, moveDto: MoveDishDto) {
    try {
      const { new_position, food_type_id } = moveDto;

      // Find the dish to move
      const dish = await this.dishRepository.findOne({ where: { id } });
      if (!dish) {
        throw new NotFoundException("Dish not found");
      }

      // If food_type_id is provided, validate the dish belongs to that food type
      if (food_type_id && dish.food_type !== food_type_id.toString()) {
        throw new BadRequestException(
          "Dish does not belong to the specified food type",
        );
      }

      // Get all dishes in the same food type, ordered by sequence
      const queryBuilder = this.dishRepository
        .createQueryBuilder("dish")
        .where("dish.food_type = :foodType", { foodType: dish.food_type })
        .orderBy("dish.sequence", "ASC")
        .addOrderBy("dish.id", "ASC");

      const allDishes = await queryBuilder.getMany();

      // Remove the dish from its current position
      const dishesWithoutMoved = allDishes.filter((d) => d.id !== id);

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
      return await this.dishRepository.manager.transaction(async (manager) => {
        for (let i = 0; i < reorderedDishes.length; i++) {
          await manager.update(
            Dish,
            { id: reorderedDishes[i].id },
            { sequence: i + 1 },
          );
        }

        return { message: "Dish moved successfully" };
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException("Failed to move dish. Please try again.");
    }
  }

  async normalizeSequences(food_type?: string) {
    try {
      const queryBuilder = this.dishRepository
        .createQueryBuilder("dish")
        .orderBy("dish.sequence", "ASC")
        .addOrderBy("dish.id", "ASC");

      if (food_type) {
        queryBuilder.where("dish.food_type = :foodType", {
          foodType: food_type,
        });
      }

      const dishes = await queryBuilder.getMany();

      // Renumber sequences to eliminate gaps
      return await this.dishRepository.manager.transaction(async (manager) => {
        for (let i = 0; i < dishes.length; i++) {
          await manager.update(Dish, dishes[i].id, { sequence: i + 1 });
        }

        return { message: "Sequences normalized successfully" };
      });
    } catch (error) {
      throw new BadRequestException(
        "Failed to normalize sequences. Please try again.",
      );
    }
  }

  private validateSessions(sessions?: CreateDishDto["sessions"]): void {
    if (!sessions) return;
    for (const [index, session] of sessions.entries()) {
      const rawStart =
        (session as any).start_hhmm ??
        (session as any).start_time ??
        (session as any).startTime ??
        (session as any).from;
      const rawEnd =
        (session as any).end_hhmm ??
        (session as any).end_time ??
        (session as any).endTime ??
        (session as any).to;
      const normalizedStart = normalizeHHMMValue(rawStart);
      const normalizedEnd = normalizeHHMMValue(rawEnd);

      (session as any).start_hhmm = normalizedStart;
      (session as any).end_hhmm = normalizedEnd;
      (session as any).day_from = Number((session as any).day_from);
      (session as any).day_to = Number((session as any).day_to);

      if (
        !isValidHHMM((session as any).start_hhmm) ||
        !isValidHHMM((session as any).end_hhmm)
      ) {
        throw new BadRequestException(
          `Invalid session time at index ${index}. Use HHMM format between 0000 and 2359. Received rawStart=${JSON.stringify(rawStart)}, rawEnd=${JSON.stringify(rawEnd)}, start=${JSON.stringify((session as any).start_hhmm)}, end=${JSON.stringify((session as any).end_hhmm)}.`,
        );
      }
      if ((session as any).start_hhmm === (session as any).end_hhmm) {
        throw new BadRequestException(
          `Session start and end cannot be same at index ${index}.`,
        );
      }
      if (Number((session as any).day_from) > Number((session as any).day_to)) {
        throw new BadRequestException(
          `At session index ${index}, end day must be on or after start day (Mon=1 … Sun=7).`,
        );
      }
      const inclusiveDaySpan =
        Number((session as any).day_to) - Number((session as any).day_from) + 1;
      if (
        Number((session as any).end_hhmm) < Number((session as any).start_hhmm) &&
        inclusiveDaySpan >= 6
      ) {
        throw new BadRequestException(
          `At session index ${index}, when the day range covers six or more days, end time must be after start time on the clock (no overnight-style wrap for long ranges).`,
        );
      }
      if (
        Number((session as any).day_from) === Number((session as any).day_to) &&
        Number((session as any).end_hhmm) <= Number((session as any).start_hhmm)
      ) {
        throw new BadRequestException(
          `For same-day session at index ${index}, end time must be after start time.`,
        );
      }
    }
  }

  private parseSessionsInput(input: unknown): CreateDishDto["sessions"] {
    const normalized = normalizeSessionsPayload(input);
    if (normalized === undefined) return [];
    return normalized.map((row) => this.materializeSessionRow(row)) as any;
  }

  /**
   * Build plain session rows with explicit HHMM extraction. Does not rely on
   * nested class-transformer output (avoids missing fields on some multipart/DTO paths).
   */
  private materializeSessionRow(row: unknown): {
    day_from: number;
    day_to: number;
    start_hhmm: number;
    end_hhmm: number;
    label?: string;
    status: boolean;
  } {
    const src =
      row !== null && typeof row === "object"
        ? (row as Record<string, unknown>)
        : {};

    const pick = (keys: string[]): unknown => {
      for (const k of keys) {
        if (Object.prototype.hasOwnProperty.call(src, k)) {
          return src[k];
        }
      }
      for (const k of keys) {
        if (k in src) {
          return (src as Record<string, unknown>)[k];
        }
      }
      return undefined;
    };

    const rawStart = pick([
      "start_hhmm",
      "start_time",
      "startTime",
      "from",
    ]);
    const rawEnd = pick(["end_hhmm", "end_time", "endTime", "to"]);

    const start = normalizeHHMMValue(rawStart);
    const end = normalizeHHMMValue(rawEnd);

    const dayFrom = Number(pick(["day_from", "dayFrom"]) ?? 1);
    const dayTo = Number(pick(["day_to", "dayTo"]) ?? 7);

    const labelRaw = pick(["label"]);
    const statusRaw = pick(["status"]);

    return {
      day_from: Number.isFinite(dayFrom) ? dayFrom : 1,
      day_to: Number.isFinite(dayTo) ? dayTo : 7,
      start_hhmm: start,
      end_hhmm: end,
      label:
        labelRaw !== undefined && labelRaw !== null
          ? String(labelRaw)
          : undefined,
      status: statusRaw !== false,
    };
  }

  private async replaceSessionsInTransaction(
    sessionRepo: Repository<DishSession>,
    dishId: number,
    sessions?: CreateDishDto["sessions"],
  ): Promise<void> {
    await sessionRepo
      .createQueryBuilder()
      .delete()
      .from(DishSession)
      .where(`"dishId" = :dishId`, { dishId })
      .execute();
    if (!sessions || sessions.length === 0) return;
    const rows = sessions.map((session) =>
      sessionRepo.create({
        dish: { id: dishId } as Dish,
        day_from: session.day_from,
        day_to: session.day_to,
        start_hhmm: session.start_hhmm,
        end_hhmm: session.end_hhmm,
        label: session.label,
        status: session.status ?? true,
      }),
    );
    await sessionRepo.save(rows);
  }

  private async attachSessionMetadata(dishes: Dish[]): Promise<any[]> {
    if (dishes.length === 0) return [];
    const ids = dishes.map((d) => d.id);
    const sessions = await this.dishSessionRepository.find({
      where: { dish: { id: In(ids) } },
      relations: ["dish"],
      order: { day_from: "ASC", start_hhmm: "ASC" },
    });
    const map = new Map<number, DishSession[]>();
    for (const session of sessions) {
      const dishId = session.dish?.id;
      if (!dishId) continue;
      const list = map.get(dishId) ?? [];
      list.push(session);
      map.set(dishId, list);
    }

    const currentDay = TimezoneUtil.getCurrentISTDay();
    const currentTime = TimezoneUtil.getCurrentISTTimeHHMM();

    return dishes.map((dish) => {
      const dishSessions = map.get(dish.id) ?? [];
      const isActiveNow = isDishActiveNow(
        dish.schedule_enabled,
        dishSessions,
        currentDay,
        currentTime,
      );
      return {
        ...dish,
        sessions: dishSessions,
        is_active_now: isActiveNow,
      };
    });
  }

}
