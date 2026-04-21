import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import {
  Collection,
  CollectionPage,
  CollectionType,
} from "./entities/collection.entity";
import { CreateCollectionDto } from "./dto/create-collection.dto";
import { UpdateCollectionDto } from "./dto/update-collection.dto";
import { PaginationDto } from "../shared/dto/pagination.dto";
import { Item } from "../item/entities/item.entity";
import { Store } from "../store/entities/store.entity";
import { CollectionEntry } from "./entities/collection-entry.entity";
import { TimezoneUtil } from "../shared/utils/timezone.util";

@Injectable()
export class CollectionService {
  private static readonly MAX_COLLECTION_ENTRIES = 50;

  constructor(
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
    @InjectRepository(CollectionEntry)
    private readonly collectionEntryRepository: Repository<CollectionEntry>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
  ) {}

  async create(dto: CreateCollectionDto) {
    await this.validateUniqueActivePageType(
      dto.page,
      dto.type,
      dto.status ?? true,
    );

    const maxSequence = await this.collectionRepository
      .createQueryBuilder("collection")
      .select("COALESCE(MAX(collection.sequence), 0)", "max")
      .getRawOne();

    const entity = this.collectionRepository.create({
      title: dto.title,
      description: dto.description,
      image_url: dto.image_url,
      type: dto.type,
      page: dto.page,
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

  async listSelectableStores(paginationDto: PaginationDto) {
    const page = paginationDto.page || 1;
    const limit = paginationDto.limit || 50;
    const query = this.storeRepository
      .createQueryBuilder("store")
      .where("store.status = :status", { status: true })
      .orderBy("store.name", "ASC");

    if (paginationDto.search) {
      query.andWhere("store.name ILIKE :search", {
        search: `%${paginationDto.search}%`,
      });
    }

    const [rows, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: rows.map((store) => ({
        id: store.id,
        name: store.name,
      })),
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

  async listSelectableItems(storeId: number, paginationDto: PaginationDto) {
    const page = paginationDto.page || 1;
    const limit = paginationDto.limit || 50;
    const query = this.itemRepository
      .createQueryBuilder("item")
      .leftJoinAndSelect("item.store", "store")
      .where("item.status = :status", { status: true })
      .andWhere("item.type = :type", { type: "item" })
      .andWhere("store.status = :storeStatus", { storeStatus: true })
      .orderBy("item.name", "ASC");

    if (storeId > 0) {
      query.andWhere("store.id = :storeId", { storeId });
    }
    if (paginationDto.search) {
      query.andWhere("item.name ILIKE :search", {
        search: `%${paginationDto.search}%`,
      });
    }

    const [rows, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: rows.map((item) => ({
        id: item.id,
        name: item.name,
        store_id: item.store?.id ?? null,
        store_name: item.store?.name ?? null,
      })),
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

    await this.validateUniqueActivePageType(
      dto.page ?? existing.page,
      dto.type ?? existing.type,
      dto.status ?? existing.status,
      existing.id,
    );

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
    },
  ) {
    const collection = await this.findOne(id);
    return this.resolveCollectionEntries(collection, paginationDto, runtimeOverrides);
  }

  async previewActiveItems(
    id: number,
    paginationDto: PaginationDto,
    runtimeOverrides?: {
      user_lat?: number;
      user_lng?: number;
    },
  ) {
    const collection = await this.collectionRepository.findOne({
      where: { id, status: true },
    });
    if (!collection) {
      throw new NotFoundException("Collection not found");
    }
    return this.resolveCollectionEntries(collection, paginationDto, runtimeOverrides);
  }

  async findActiveCollections(paginationDto: PaginationDto) {
    return this.findAll({ ...paginationDto, status: true });
  }

  async findSingleActiveCollectionForPage(
    page: CollectionPage,
    type: CollectionType,
    paginationDto: PaginationDto,
  ) {
    const rows = await this.collectionRepository.find({
      where: { status: true, page, type },
      order: { sequence: "ASC", id: "ASC" },
    });

    if (rows.length === 0) {
      throw new NotFoundException(
        `No active ${type} collection configured for ${page} page`,
      );
    }

    if (rows.length > 1) {
      throw new BadRequestException(
        `Multiple active ${type} collections configured for ${page} page. Keep only one active collection.`,
      );
    }

    const collection = rows[0];
    const resolved = await this.resolveCollectionEntries(collection, paginationDto);

    return {
      collection: {
        id: collection.id,
        title: collection.title,
        description: collection.description,
        image_url: collection.image_url,
        type: collection.type,
        page: collection.page,
      },
      ...resolved,
    };
  }

  async findActiveHomeCollection(
    paginationDto: PaginationDto,
    runtimeOverrides?: {
      user_lat?: number;
      user_lng?: number;
    },
  ) {
    const rows = await this.collectionRepository.find({
      where: { status: true, page: CollectionPage.HOME },
      order: { sequence: "ASC", id: "ASC" },
    });

    if (rows.length === 0) {
      return null;
    }

    const collection = rows[0];
    const resolved = await this.resolveCollectionEntries(
      collection,
      paginationDto,
      runtimeOverrides,
    );
    return {
      collection: {
        id: collection.id,
        title: collection.title,
        description: collection.description,
        image_url: collection.image_url,
        type: collection.type,
        page: collection.page,
      },
      ...resolved,
    };
  }

  async addEntries(collectionId: number, entityIds: number[]) {
    const collection = await this.findOne(collectionId);
    const ids = Array.from(new Set(entityIds)).filter((id) => Number.isInteger(id));
    if (ids.length === 0) {
      throw new BadRequestException("entity_ids must contain at least one valid id");
    }

    const existingEntries = await this.collectionEntryRepository.find({
      where: { collection_id: collectionId },
      select: ["entity_id"],
    });
    const existingEntityIds = new Set(
      existingEntries.map((entry) => Number(entry.entity_id)),
    );
    const incomingNewUniqueCount = ids.filter(
      (id) => !existingEntityIds.has(Number(id)),
    ).length;
    const totalAfterInsert = existingEntries.length + incomingNewUniqueCount;
    if (totalAfterInsert > CollectionService.MAX_COLLECTION_ENTRIES) {
      throw new BadRequestException(
        `Collection entry limit exceeded. Maximum ${CollectionService.MAX_COLLECTION_ENTRIES} entries are allowed per collection.`,
      );
    }

    await this.validateEntityIds(collection.type, ids);

    const maxSequence = await this.collectionEntryRepository
      .createQueryBuilder("entry")
      .select("COALESCE(MAX(entry.sequence), 0)", "max")
      .where("entry.collection_id = :collectionId", { collectionId })
      .getRawOne();

    let sequence = Number(maxSequence?.max ?? 0) + 1;
    const toInsert = ids.map((entityId) =>
      this.collectionEntryRepository.create({
        collection_id: collectionId,
        entity_id: entityId,
        sequence: sequence++,
      }),
    );

    await this.collectionEntryRepository
      .createQueryBuilder()
      .insert()
      .into(CollectionEntry)
      .values(toInsert)
      .orIgnore()
      .execute();

    return this.getEntries(collectionId);
  }

  async getEntries(collectionId: number) {
    await this.findOne(collectionId);
    return this.collectionEntryRepository.find({
      where: { collection_id: collectionId },
      order: { sequence: "ASC", id: "ASC" },
    });
  }

  async removeEntry(collectionId: number, entryId: number) {
    await this.findOne(collectionId);
    await this.collectionEntryRepository.delete({ id: entryId, collection_id: collectionId });
    return { message: "Collection entry removed successfully" };
  }

  async reorderEntries(
    collectionId: number,
    updates: Array<{ entry_id: number; new_position: number }>,
  ) {
    await this.findOne(collectionId);
    const entries = await this.collectionEntryRepository.find({
      where: { collection_id: collectionId },
      order: { sequence: "ASC", id: "ASC" },
    });
    const map = new Map(entries.map((entry) => [entry.id, entry]));
    for (const row of updates) {
      const item = map.get(row.entry_id);
      if (item) {
        item.sequence = row.new_position;
      }
    }
    await this.collectionEntryRepository.save(entries);
    return { message: "Collection entries reordered successfully" };
  }

  private async resolveCollectionEntries(
    collection: Collection,
    paginationDto: PaginationDto,
    runtimeOverrides?: {
      user_lat?: number;
      user_lng?: number;
    },
  ) {
    const page = paginationDto.page || 1;
    const effectiveLimit = paginationDto.limit || 20;
    const userLatRaw =
      runtimeOverrides?.user_lat !== undefined
        ? Number(runtimeOverrides.user_lat)
        : undefined;
    const userLngRaw =
      runtimeOverrides?.user_lng !== undefined
        ? Number(runtimeOverrides.user_lng)
        : undefined;
    const userLat = Number.isFinite(userLatRaw) ? userLatRaw : undefined;
    const userLng = Number.isFinite(userLngRaw) ? userLngRaw : undefined;

    const entryRows = await this.collectionEntryRepository.find({
      where: { collection_id: collection.id },
      order: { sequence: "ASC", id: "ASC" },
    });
    const entityIds = entryRows.map((row) => row.entity_id);
    const mapped =
      collection.type === CollectionType.STORE
        ? await this.resolveStoreEntries(entityIds, userLat, userLng)
        : await this.resolveItemEntries(entityIds, userLat, userLng);

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

  private async resolveItemEntries(
    entityIds: number[],
    userLat?: number,
    userLng?: number,
  ) {
    if (entityIds.length === 0) return [];
    const items = await this.itemRepository.find({
      where: { id: In(entityIds), status: true, type: "item" },
      relations: ["store", "store.locations", "prices", "quantities", "attributes"],
    });
    const mapById = new Map(items.map((item) => [item.id, item]));
    const orderedItems = entityIds
      .map((id) => mapById.get(id))
      .filter((item): item is Item => Boolean(item));

    return Promise.all(
      orderedItems.map(async (item) => {
        const ratingData = await this.getItemRatingData(item.id);
        const storeDistance = this.getStoreDistanceKm(
          item.store as unknown as Store,
          userLat,
          userLng,
        );
        const deliveryTime = this.calculateDeliveryTime(
          storeDistance,
          ratingData.rating,
          item.store?.preparation_time || undefined,
        );
        const firstPrice = item.prices?.[0];
        const firstQuantity = item.quantities?.[0];
        const availableCount = Number(firstQuantity?.available_count ?? 0);
        const isAvailable = availableCount > 0;
        const dietaryAttr = (item.attributes || []).find(
          (attr: any) => attr?.attribute_code === "veg_nonveg",
        );
        return {
          id: item.id,
          name: item.name,
          short_desc: item.short_desc || "",
          long_desc: item.long_desc || "",
          images: Array.isArray(item.images) ? item.images : [],
          price: {
            base_price: Number(firstPrice?.base_price || 0),
            currency: String(firstPrice?.currency || "INR"),
            maximum_price: Number(firstPrice?.maximum_price || 0),
          },
          quantity: {
            unit_type: String(firstQuantity?.unit_type || "unit"),
            unit_value: Number(firstQuantity?.unit_value || 1),
            available_count: availableCount,
            maximum_count: Number(firstQuantity?.maximum_count || 99),
          },
          attributes: item.attributes || [],
          customizations: [],
          has_variants: false,
          variants: [],
          rating: ratingData.rating,
          is_available: isAvailable,
          is_recommended: Boolean(item.is_recommended),
          tax_rate: item.tax_rate ?? null,
          tax_type: item.tax_type || null,
          hsn_code: item.hsn_code || null,
          is_favorite: false,
          dietary_preference: dietaryAttr?.attribute_value || null,
          // Keep existing supplemental fields used in collection/home cards.
          store: {
            id: item.store?.id ?? null,
            name: item.store?.name ?? "",
            logo_url: item.store?.logo_url ?? "",
          },
          distance: storeDistance,
          total_reviews: ratingData.total_reviews,
          delivery_time: deliveryTime,
          offers_count: await this.getStoreOffersCount(item.store?.id),
          food_type: item.store?.food_type ?? null,
          cuisine_tags: Array.isArray(item.store?.tags)
            ? item.store.tags.join(", ")
            : undefined,
          image_url: this.getFirstImage(item.images),
          store_id: item.store?.id ?? null,
          store_name: item.store?.name ?? null,
          base_price: Number(firstPrice?.base_price || 0),
        };
      }),
    );
  }

  private async resolveStoreEntries(
    entityIds: number[],
    userLat?: number,
    userLng?: number,
  ) {
    if (entityIds.length === 0) return [];
    const stores = await this.storeRepository.find({
      where: { id: In(entityIds), status: true },
      relations: ["locations", "fulfillments", "timings"],
    });
    const mapById = new Map(stores.map((store) => [store.id, store]));
    const orderedStores = entityIds
      .map((id) => mapById.get(id))
      .filter((store): store is Store => Boolean(store));

    return Promise.all(
      orderedStores.map(async (store) => {
        const ratingData = await this.getStoreRatingData(store.id);
        const distance = this.getStoreDistanceKm(store, userLat, userLng);
        const deliveryTime = this.calculateDeliveryTime(
          distance,
          ratingData.rating,
          store.preparation_time || undefined,
        );
        const primaryLocation = Array.isArray(store.locations)
          ? store.locations.find((loc: any) => loc?.status === true) ||
            store.locations[0]
          : undefined;
        return {
        id: store.id,
        name: store.name,
        description: store.description || "",
        logo_url: store.logo_url || "",
        fssai_license: store.fssai_license_no || "",
        food_type: store.food_type || null,
        cuisine_tags: Array.isArray(store.tags) ? store.tags.join(", ") : undefined,
        location: {
          lat: primaryLocation?.gps_lat ?? null,
          lng: primaryLocation?.gps_lng ?? null,
          city: primaryLocation?.address_city ?? "",
          locality: primaryLocation?.address_locality ?? "",
        },
        distance,
        rating: ratingData.rating,
        total_reviews: ratingData.total_reviews,
        delivery_time: deliveryTime,
        offers_count: await this.getStoreOffersCount(store.id),
        is_favorite: false,
        timings: this.buildStoreTimings(store),
        is_open: this.isStoreOpenNow(store),
        phone_number:
          store.fulfillments?.find((f: any) => f.type === "Delivery")
            ?.contact_phone || null,
        email:
          store.fulfillments?.find((f: any) => f.type === "Delivery")
            ?.contact_email || null,
        // Backward-compatible aliases for existing collection UI usage.
        image_url: store.logo_url || "",
      };
      }),
    );
  }

  private getFirstImage(images?: string[] | null): string {
    if (Array.isArray(images) && images.length > 0) {
      return String(images[0] || "");
    }
    return "";
  }

  private async getItemRatingData(itemId: number): Promise<{
    rating: number;
    total_reviews: number;
  }> {
    const row = await this.itemRepository
      .createQueryBuilder("item")
      .leftJoin("item_review", "ir", `ir."itemId" = item.id`)
      .where("item.id = :itemId", { itemId })
      .select("COALESCE(AVG(ir.rating), 0)", "avg_rating")
      .addSelect("COUNT(ir.id)", "total_reviews")
      .groupBy("item.id")
      .getRawOne<{ avg_rating?: string; total_reviews?: string }>();

    return {
      rating: Number(row?.avg_rating || 0),
      total_reviews: Number(row?.total_reviews || 0),
    };
  }

  private async getStoreRatingData(storeId: number): Promise<{
    rating: number;
    total_reviews: number;
  }> {
    const row = await this.storeRepository
      .createQueryBuilder("store")
      .leftJoin("restaurant_review", "sr", `sr."storeId" = store.id`)
      .where("store.id = :storeId", { storeId })
      .select("COALESCE(AVG(sr.rating), 0)", "avg_rating")
      .addSelect("COUNT(sr.id)", "total_reviews")
      .groupBy("store.id")
      .getRawOne<{ avg_rating?: string; total_reviews?: string }>();

    return {
      rating: Number(row?.avg_rating || 0),
      total_reviews: Number(row?.total_reviews || 0),
    };
  }

  private async getStoreOffersCount(storeId?: number | null): Promise<number> {
    if (!storeId) return 0;
    const row = await this.storeRepository
      .createQueryBuilder("store")
      .leftJoin("offers", "offer", `offer."storeId" = store.id`)
      .where("store.id = :storeId", { storeId })
      .andWhere("offer.status = :status", { status: true })
      .select("COUNT(offer.id)", "offers_count")
      .groupBy("store.id")
      .getRawOne<{ offers_count?: string }>();
    return Number(row?.offers_count || 0);
  }

  private getStoreDistanceKm(
    store: Store,
    userLat?: number,
    userLng?: number,
  ): number | null {
    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
      return null;
    }
    const locations = Array.isArray((store as any).locations)
      ? (store as any).locations
      : [];
    const activeLocations = locations.filter((loc: any) => loc?.status === true);
    const candidateLocations = activeLocations.length > 0 ? activeLocations : locations;
    if (candidateLocations.length === 0) return null;

    const distances = candidateLocations
      .map((loc: any) => {
        const lat = Number(loc?.gps_lat);
        const lng = Number(loc?.gps_lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return this.calculateDistanceHaversine(userLat!, userLng!, lat, lng);
      })
      .filter((distance): distance is number => Number.isFinite(distance));

    if (distances.length === 0) return null;
    return Math.round(Math.min(...distances) * 100) / 100;
  }

  private calculateDistanceHaversine(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private calculateDeliveryTime(
    distanceKm: number | null,
    storeRating?: number,
    storePreparationTime?: string,
  ): string {
    try {
      const distance = Number.isFinite(distanceKm as number)
        ? Number(distanceKm)
        : 0;
      const travelTime = this.calculateTravelTimeFromDistance(distance);
      let prepTime = this.calculatePrepTime(storeRating);
      if (storePreparationTime) {
        const parsed = this.parseISO8601Duration(storePreparationTime);
        if (parsed > 0) prepTime = parsed;
      }
      const rounded = Math.max(15, Math.ceil((prepTime + travelTime) / 5) * 5);
      return `${rounded}-${Math.min(60, rounded + 5)} mins`;
    } catch {
      return "25-30 mins";
    }
  }

  private calculateTravelTimeFromDistance(distance: number): number {
    if (distance <= 1) return 3 + Math.round(distance);
    if (distance <= 2) return 4 + Math.round(distance * 1.5);
    if (distance <= 5) return 6 + Math.round(distance * 1.3);
    if (distance <= 10) return 10 + Math.round(distance);
    return Math.max(12, Math.round(distance * 1.2));
  }

  private calculatePrepTime(storeRating?: number): number {
    if (storeRating !== undefined && storeRating > 0) {
      if (storeRating >= 4.5) return 8;
      if (storeRating >= 4.0) return 9;
      if (storeRating >= 3.0) return 10;
      return 12;
    }
    return 10;
  }

  private parseISO8601Duration(duration: string): number {
    const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i);
    if (!match) return 0;
    const hours = Number(match[1] || 0);
    const minutes = Number(match[2] || 0);
    return hours * 60 + minutes;
  }

  private buildStoreTimings(store: Store): Array<{
    day: number;
    open_time: string;
    close_time: string;
    is_open: boolean;
  }> {
    const timings = Array.isArray((store as any).timings)
      ? ((store as any).timings as any[])
      : [];
    if (timings.length === 0) {
      return [];
    }

    const expanded: Array<{
      day: number;
      open_time: string;
      close_time: string;
      is_open: boolean;
    }> = [];

    const currentDayDb = TimezoneUtil.getCurrentISTDay();
    const currentTime = String(TimezoneUtil.getCurrentISTTimeHHMM());

    for (const timing of timings) {
      const dayFromDb = Number(timing.day_from);
      const dayToDb = Number(timing.day_to);
      const daysDb: number[] = [];

      if (dayFromDb <= dayToDb) {
        for (let day = dayFromDb; day <= dayToDb; day++) {
          daysDb.push(day);
        }
      } else {
        for (let day = dayFromDb; day <= 7; day++) {
          daysDb.push(day);
        }
        for (let day = 1; day <= dayToDb; day++) {
          daysDb.push(day);
        }
      }

      for (const dayDb of daysDb) {
        const openTime = String(timing.time_from || "0000");
        const closeTime = String(timing.time_to || "0000");
        expanded.push({
          day: this.convertDbDayToDisplayDay(dayDb),
          open_time: openTime,
          close_time: closeTime,
          is_open:
            dayDb === currentDayDb &&
            this.isTimeInRange(currentTime, openTime, closeTime),
        });
      }
    }

    return expanded.sort((a, b) => a.day - b.day);
  }

  private isStoreOpenNow(store: Store): boolean {
    const currentDay = TimezoneUtil.getCurrentISTDay();
    const currentTime = String(TimezoneUtil.getCurrentISTTimeHHMM());
    const timings = Array.isArray((store as any).timings)
      ? ((store as any).timings as any[])
      : [];
    const matched = timings.find(
      (t) =>
        Number(t.day_from) <= currentDay &&
        Number(t.day_to) >= currentDay,
    );
    if (!matched) return false;
    return this.isTimeInRange(
      currentTime,
      String(matched.time_from || "0000"),
      String(matched.time_to || "0000"),
    );
  }

  private convertDbDayToDisplayDay(dbDay: number): number {
    return dbDay === 7 ? 1 : dbDay + 1;
  }

  private isTimeInRange(
    currentHHMM: string,
    openHHMM: string,
    closeHHMM: string,
  ): boolean {
    const current = Number(currentHHMM);
    const open = Number(openHHMM);
    const close = Number(closeHHMM);
    if (!Number.isFinite(current) || !Number.isFinite(open) || !Number.isFinite(close)) {
      return false;
    }
    if (open <= close) {
      return current >= open && current <= close;
    }
    // Overnight timing window (e.g., 2200 -> 0200).
    return current >= open || current <= close;
  }

  private async validateEntityIds(type: CollectionType, ids: number[]) {
    if (type === CollectionType.ITEM) {
      const count = await this.itemRepository.count({
        where: { id: In(ids), status: true, type: "item" },
      });
      if (count !== ids.length) {
        throw new BadRequestException(
          "One or more item IDs are invalid or inactive",
        );
      }
      return;
    }

    const count = await this.storeRepository.count({
      where: { id: In(ids), status: true },
    });
    if (count !== ids.length) {
      throw new BadRequestException(
        "One or more store IDs are invalid or inactive",
      );
    }
  }

  private async validateUniqueActivePageType(
    page: CollectionPage,
    type: CollectionType,
    status: boolean,
    ignoreId?: number,
  ) {
    if (!status) return;

    const rows =
      page === CollectionPage.HOME
        ? await this.collectionRepository.find({
            where: { page, status: true },
          })
        : await this.collectionRepository.find({
            where: { page, type, status: true },
          });

    const conflict = rows.find((row) => row.id !== ignoreId);
    if (conflict) {
      if (page === CollectionPage.HOME) {
        throw new BadRequestException(
          "An active collection already exists for page=home. Only one active home collection is allowed.",
        );
      }
      throw new BadRequestException(
        `An active collection already exists for page=${page} and type=${type}`,
      );
    }
  }
}

