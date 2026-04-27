import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { StoreTimings } from "../../store/entities/store-timings.entity";
import { StoreCloseTimings } from "../../store/entities/store-close-timings.entity";
import { StoreLocation } from "../../store/entities/store-location.entity";
import { TimezoneUtil } from "../utils/timezone.util";

@Injectable()
export class StoreAvailabilityService {
  private readonly logger = new Logger(StoreAvailabilityService.name);

  constructor(
    @InjectRepository(StoreTimings)
    private readonly storeTimingsRepository: Repository<StoreTimings>,
    @InjectRepository(StoreCloseTimings)
    private readonly storeCloseTimingsRepository: Repository<StoreCloseTimings>,
    @InjectRepository(StoreLocation)
    private readonly storeLocationRepository: Repository<StoreLocation>,
  ) {}

  /**
   * Store IDs that have an active special closure window right now (UTC wall clock vs DB timestamps).
   */
  async getStoreIdsWithActiveCloseTimingNow(
    storeIds: number[],
  ): Promise<Set<number>> {
    if (storeIds.length === 0) return new Set();
    const rows = await this.storeCloseTimingsRepository
      .createQueryBuilder("sct")
      .innerJoin("sct.store", "store")
      .select("store.id", "store_id")
      .where("store.id IN (:...storeIds)", { storeIds })
      .andWhere("sct.close_start_datetime <= (NOW() AT TIME ZONE 'UTC')")
      .andWhere("sct.close_end_datetime >= (NOW() AT TIME ZONE 'UTC')")
      .getRawMany<{ store_id: number | string }>();
    return new Set(rows.map((row) => Number(row.store_id)));
  }

  async hasActiveCloseTimingForStore(storeId: number): Promise<boolean> {
    return this.storeCloseTimingsRepository
      .createQueryBuilder("sct")
      .where("sct.storeId = :storeId", { storeId })
      .andWhere("sct.close_start_datetime <= (NOW() AT TIME ZONE 'UTC')")
      .andWhere("sct.close_end_datetime >= (NOW() AT TIME ZONE 'UTC')")
      .getExists();
  }

  /**
   * Store IDs where today (IST) appears in any active location's schedule_holidays.
   */
  async getStoreIdsWithHolidayToday(storeIds: number[]): Promise<Set<number>> {
    if (storeIds.length === 0) return new Set();
    const istComponents = TimezoneUtil.getISTComponents();
    const todayYYYYMMDD = `${istComponents.year}-${String(istComponents.month).padStart(2, "0")}-${String(istComponents.day).padStart(2, "0")}`;
    const locations = await this.storeLocationRepository.find({
      where: { store: { id: In(storeIds) }, status: true },
      relations: ["store"],
    });
    return new Set(
      locations
        .filter(
          (loc) =>
            Array.isArray(loc.schedule_holidays) &&
            loc.schedule_holidays.includes(todayYYYYMMDD),
        )
        .map((loc) => loc.store.id),
    );
  }

  /**
   * Whether the store is accepting orders now (timings + wrapped ranges + close + schedule holidays).
   */
  async isStoreOpen(
    storeId: number,
  ): Promise<{ isOpen: boolean; nextOpenTime?: string }> {
    try {
      const currentDay = TimezoneUtil.getCurrentISTDay();
      const currentTime = TimezoneUtil.getCurrentISTTimeHHMM();

      this.logger.log(
        `Checking store ${storeId} open status - IST Day: ${currentDay}, Time: ${currentTime} (${TimezoneUtil.formatTimeHHMM(currentTime)})`,
      );

      const applicableTimings = await this.storeTimingsRepository
        .createQueryBuilder("st")
        .where("st.storeId = :storeId", { storeId })
        .andWhere(
          `(
            (st.day_from <= st.day_to AND st.day_from <= :day AND st.day_to >= :day)
            OR
            (st.day_from > st.day_to AND (:day >= st.day_from OR :day <= st.day_to))
          )`,
          { day: currentDay },
        )
        .orderBy("st.time_from", "ASC")
        .addOrderBy("st.id", "ASC")
        .getMany();

      if (!applicableTimings.length) {
        return { isOpen: false };
      }

      let isWithinHours = false;
      const nextOpenTime = applicableTimings[0]?.time_from;
      for (const timing of applicableTimings) {
        const openTime = parseInt(timing.time_from, 10);
        const closeTime = parseInt(timing.time_to, 10);
        if (!Number.isFinite(openTime) || !Number.isFinite(closeTime)) {
          continue;
        }
        if (closeTime < openTime) {
          if (currentTime >= openTime || currentTime <= closeTime) {
            isWithinHours = true;
            break;
          }
        } else if (currentTime >= openTime && currentTime <= closeTime) {
          isWithinHours = true;
          break;
        }
      }

      if (!isWithinHours) {
        return nextOpenTime ? { isOpen: false, nextOpenTime } : { isOpen: false };
      }

      const hasActiveSpecialClosure = await this.storeCloseTimingsRepository
        .createQueryBuilder("sct")
        .where("sct.storeId = :storeId", { storeId })
        .andWhere("sct.close_start_datetime <= (NOW() AT TIME ZONE 'UTC')")
        .andWhere("sct.close_end_datetime >= (NOW() AT TIME ZONE 'UTC')")
        .getExists();

      if (hasActiveSpecialClosure) {
        return { isOpen: false };
      }

      const istComponents = TimezoneUtil.getISTComponents();
      const todayYYYYMMDD = `${istComponents.year}-${String(istComponents.month).padStart(2, "0")}-${String(istComponents.day).padStart(2, "0")}`;
      const locationsWithHolidays = await this.storeLocationRepository.find({
        where: { store: { id: storeId }, status: true },
        select: ["id", "schedule_holidays"],
      });
      const isHolidayToday = locationsWithHolidays.some(
        (loc) =>
          Array.isArray(loc.schedule_holidays) &&
          loc.schedule_holidays.includes(todayYYYYMMDD),
      );
      if (isHolidayToday) {
        this.logger.log(
          `Store ${storeId} closed today: ${todayYYYYMMDD} is in location schedule_holidays`,
        );
        return { isOpen: false };
      }

      return { isOpen: true };
    } catch (error: any) {
      this.logger.warn(
        `Failed to check store timing for store ${storeId}: ${error?.message}`,
      );
      return { isOpen: false };
    }
  }
}
