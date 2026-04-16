import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Collection } from "./entities/collection.entity";
import { CreateCollectionDto } from "./dto/create-collection.dto";
import { UpdateCollectionDto } from "./dto/update-collection.dto";
import { PaginationDto } from "../shared/dto/pagination.dto";
import { Item } from "../item/entities/item.entity";
import { ItemPrices } from "../item/entities/item-prices.entity";

@Injectable()
export class CollectionService {
  constructor(
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
  ) {}

  async create(dto: CreateCollectionDto) {
    const maxSequence = await this.collectionRepository
      .createQueryBuilder("collection")
      .select("COALESCE(MAX(collection.sequence), 0)", "max")
      .getRawOne();

    const entity = this.collectionRepository.create({
      title: dto.title,
      filters: dto.filters ?? {},
      status: dto.status ?? true,
      sequence: Number(maxSequence?.max ?? 0) + 1,
    });

    return this.collectionRepository.save(entity);
  }

  async findAll(paginationDto: PaginationDto) {
    const query = this.collectionRepository.createQueryBuilder("collection");

    if (paginationDto.search) {
      query.andWhere("collection.title ILIKE :search", {
        search: `%${paginationDto.search}%`,
      });
    }
    if (paginationDto.status !== undefined) {
      query.andWhere("collection.status = :status", {
        status: paginationDto.status,
      });
    }

    query.orderBy("collection.sequence", "ASC").addOrderBy("collection.id", "ASC");

    const hasPagination =
      paginationDto.page !== undefined || paginationDto.limit !== undefined;
    if (!hasPagination) {
      const data = await query.getMany();
      return {
        data,
        meta: {
          page: 1,
          limit: data.length,
          total: data.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };
    }

    const page = paginationDto.page || 1;
    const limit = paginationDto.limit || 10;
    const [data, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

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
  }

  async findOne(id: number) {
    const collection = await this.collectionRepository.findOne({ where: { id } });
    if (!collection) throw new NotFoundException("Collection not found");
    return collection;
  }

  async update(id: number, dto: UpdateCollectionDto) {
    const existing = await this.findOne(id);
    const updated = this.collectionRepository.merge(existing, dto);
    return this.collectionRepository.save(updated);
  }

  async remove(id: number) {
    const existing = await this.findOne(id);
    await this.collectionRepository.delete(existing.id);
    return { message: "Collection deleted successfully" };
  }

  async moveCollection(id: number, newPosition: number) {
    const collection = await this.collectionRepository.findOne({ where: { id } });
    if (!collection) {
      throw new NotFoundException("Collection not found");
    }

    const allCollections = await this.collectionRepository.find({
      order: { sequence: "ASC", id: "ASC" },
    });

    const withoutMoved = allCollections.filter((c) => c.id !== id);
    const safePosition = Math.max(1, Math.min(newPosition, allCollections.length));

    const reordered: Collection[] = [];
    for (let i = 0; i < withoutMoved.length; i++) {
      if (i === safePosition - 1) {
        reordered.push(collection);
      }
      reordered.push(withoutMoved[i]);
    }
    if (safePosition > withoutMoved.length) {
      reordered.push(collection);
    }

    await this.collectionRepository.manager.transaction(async (manager) => {
      for (let i = 0; i < reordered.length; i++) {
        await manager.update(Collection, { id: reordered[i].id }, { sequence: i + 1 });
      }
    });

    return { message: "Collection moved successfully" };
  }

  async previewItems(
    id: number,
    paginationDto: PaginationDto,
    runtimeOverrides?: {
      user_lat?: number;
      user_lng?: number;
      limit?: number;
    },
  ) {
    const collection = await this.findOne(id);
    return this.resolveItems(
      {
        ...(collection.filters ?? {}),
        ...(runtimeOverrides ?? {}),
      },
      paginationDto,
    );
  }

  async previewActiveItems(
    id: number,
    paginationDto: PaginationDto,
    runtimeOverrides?: {
      user_lat?: number;
      user_lng?: number;
      limit?: number;
    },
  ) {
    const collection = await this.collectionRepository.findOne({
      where: { id, status: true },
    });
    if (!collection) {
      throw new NotFoundException("Collection not found");
    }
    return this.resolveItems(
      {
        ...(collection.filters ?? {}),
        ...(runtimeOverrides ?? {}),
      },
      paginationDto,
    );
  }

  async findActiveCollections(paginationDto: PaginationDto) {
    return this.findAll({ ...paginationDto, status: true });
  }

  async previewByFilters(filters: Record<string, any>, paginationDto: PaginationDto) {
    return this.resolveItems(filters ?? {}, paginationDto);
  }

  private async resolveItems(
    filters: Record<string, any>,
    paginationDto: PaginationDto,
  ) {
    const page = paginationDto.page || 1;
    const rawLimitValue = filters?.limit;
    const parsedLimit =
      rawLimitValue !== undefined ? Number(rawLimitValue) : undefined;
    const filterLimit =
      typeof parsedLimit === "number" &&
      Number.isFinite(parsedLimit) &&
      parsedLimit > 0
        ? Math.min(Math.floor(parsedLimit), 100)
        : undefined;
    const effectiveLimit = filterLimit ?? (paginationDto.limit || 20);
    const name = filters?.name;
    const ratings = Number(filters?.ratings);
    const price = Number(filters?.price);
    const foodTypeIn: string[] = Array.isArray(filters?.food_type_in)
      ? filters.food_type_in
      : [];
    const radiusKm =
      filters?.radius_km !== undefined ? Number(filters.radius_km) : undefined;
    const userLatRaw =
      filters?.user_lat !== undefined ? Number(filters.user_lat) : undefined;
    const userLngRaw =
      filters?.user_lng !== undefined ? Number(filters.user_lng) : undefined;
    const userLat = Number.isFinite(userLatRaw) ? userLatRaw : 9.9252;
    const userLng = Number.isFinite(userLngRaw) ? userLngRaw : 78.1198;
    const sortBy = String(filters?.sort_by || "name").toLowerCase();
    const sortOrder =
      String(filters?.sort_order || "asc").toLowerCase() === "desc"
        ? "DESC"
        : "ASC";

    const distanceSql =
      userLat !== undefined && userLng !== undefined
        ? `(6371 * 2 * atan2(
            sqrt(
              (sin(radians(sl.gps_lat - ${userLat}) / 2) * sin(radians(sl.gps_lat - ${userLat}) / 2)) +
              (cos(radians(${userLat})) * cos(radians(sl.gps_lat)) *
              sin(radians(sl.gps_lng - ${userLng}) / 2) * sin(radians(sl.gps_lng - ${userLng}) / 2))
            ),
            sqrt(
              1 - (
                (sin(radians(sl.gps_lat - ${userLat}) / 2) * sin(radians(sl.gps_lat - ${userLat}) / 2)) +
                (cos(radians(${userLat})) * cos(radians(sl.gps_lat)) *
                sin(radians(sl.gps_lng - ${userLng}) / 2) * sin(radians(sl.gps_lng - ${userLng}) / 2))
              )
            )
          ))`
        : "NULL";

    const query = this.itemRepository
      .createQueryBuilder("item")
      .leftJoin("item.store", "store")
      .leftJoin("store.locations", "sl", "sl.status = true")
      .leftJoin(ItemPrices, "ip", `ip."itemId" = item.id`)
      .leftJoin("item_review", "ir", `ir."itemId" = item.id`)
      .where("item.status = true")
      .andWhere("store.status = true")
      .andWhere("item.type = :type", { type: "item" })
      .select("item.id", "item_id")
      .addSelect("item.name", "item_name")
      .addSelect("item.images", "item_images")
      .addSelect("store.id", "store_id")
      .addSelect("store.name", "store_name")
      .addSelect("store.food_type", "food_type")
      .addSelect("MIN(ip.base_price)", "base_price")
      .addSelect("COALESCE(AVG(ir.rating), 0)", "avg_rating")
      .addSelect(`MIN(${distanceSql})`, "distance_km")
      .groupBy("item.id")
      .addGroupBy("store.id");

    if (name) {
      const normalizedName = String(name).replace(/%/g, "").trim();
      query.andWhere("item.name ILIKE :name", { name: `%${normalizedName}%` });
    }
    if (Number.isFinite(price)) {
      query.andWhere("ip.base_price <= :price", { price });
    }
    if (foodTypeIn.length) {
      query.andWhere("store.food_type IN (:...foodTypeIn)", { foodTypeIn });
    }
    if (Number.isFinite(radiusKm)) {
      query.andWhere(`${distanceSql} <= :radiusKm`, { radiusKm });
    }

    query.having(
      "COALESCE(AVG(ir.rating), 0) >= :ratings",
      { ratings: Number.isFinite(ratings) ? ratings : 0 },
    );
    if (sortBy === "rating") {
      query.andHaving("COALESCE(AVG(ir.rating), 0) > 0");
    }

    if (sortBy === "price") {
      query
        .orderBy("MIN(ip.base_price)", sortOrder)
        .addOrderBy("item.name", "ASC")
        .addOrderBy("item.id", "ASC");
    } else if (sortBy === "rating") {
      query
        .orderBy("COALESCE(AVG(ir.rating), 0)", sortOrder)
        .addOrderBy("item.name", "ASC")
        .addOrderBy("item.id", "ASC");
    } else if (sortBy === "distance") {
      query
        .orderBy(`MIN(${distanceSql})`, sortOrder)
        .addOrderBy("item.name", "ASC")
        .addOrderBy("item.id", "ASC");
    } else {
      query
        .orderBy("item.name", sortOrder)
        .addOrderBy("MIN(ip.base_price)", "ASC")
        .addOrderBy("item.id", "ASC");
    }

    const rows = await query.getRawMany();
    let mapped = rows.map((row) => {
      const rawImages = row.item_images;
      let imageUrl = "";
      if (Array.isArray(rawImages) && rawImages.length) {
        imageUrl = String(rawImages[0]);
      } else if (typeof rawImages === "string") {
        try {
          const parsed = JSON.parse(rawImages);
          imageUrl = Array.isArray(parsed) ? String(parsed[0] || "") : rawImages;
        } catch {
          imageUrl = rawImages;
        }
      }

      return {
        item_id: Number(row.item_id),
        item_name: row.item_name,
        store_id: Number(row.store_id),
        store_name: row.store_name,
        food_type: row.food_type,
        base_price: Number(row.base_price || 0),
        avg_rating: Number(row.avg_rating || 0),
        distance_km:
          row.distance_km !== null && row.distance_km !== undefined
            ? Number(row.distance_km)
            : null,
        image_url: imageUrl,
      };
    });

    const total = mapped.length;
    const start = (page - 1) * effectiveLimit;
    const data = mapped.slice(start, start + effectiveLimit);

    return {
      data,
      meta: {
        page,
        limit: effectiveLimit,
        total,
        totalPages: Math.ceil(total / effectiveLimit),
        hasNext: page < Math.ceil(total / effectiveLimit),
        hasPrev: page > 1,
      },
    };
  }
}

