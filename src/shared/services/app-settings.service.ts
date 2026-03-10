import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AppSettings } from "../entities/app-settings.entity";
import { AdminAccessService } from "src/super-admin-access/super-admin-access.service";

@Injectable()
export class AppSettingsService {
  private readonly logger = new Logger(AppSettingsService.name);
  private settingsCache: Map<string, string> = new Map();
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute cache

  constructor(
    @InjectRepository(AppSettings)
    private readonly appSettingsRepository: Repository<AppSettings>,

    private readonly adminAccessService: AdminAccessService,
  ) {
    this.initializeCache();
  }

  /**
   * Initialize cache on startup
   */
  private async initializeCache() {
    try {
      await this.refreshCache();
      this.logger.log("✅ App settings cache initialized");
    } catch (error) {
      this.logger.error(`❌ Failed to initialize settings cache: ${error.message}`);
    }
  }

  /**
   * Refresh cache from database
   */
  private async refreshCache() {
    const settings = await this.appSettingsRepository.find({
      where: { is_active: true },
    });

    this.settingsCache.clear();
    settings.forEach((setting) => {
      this.settingsCache.set(setting.key, setting.value);
    });

    this.cacheTimestamp = Date.now();
    this.logger.log(`🔄 Cache refreshed with ${settings.length} settings`);
  }

  /**
   * Get a setting value by key directly from DB (bypasses cache).
   * Use for settings that must always reflect latest value (e.g. platform fee for cart).
   */
  async getFromDb(key: string): Promise<string | null> {
    const setting = await this.appSettingsRepository.findOne({
      where: { key, is_active: true },
      select: ["value"],
    });
    return setting?.value ?? null;
  }

  /**
   * Get a setting value by key with caching
   */
  async get(
    key: string,
    defaultValue?: string
  ): Promise<string | null> {

    // refresh cache if stale
    if (Date.now() - this.cacheTimestamp > this.CACHE_TTL) {
      await this.refreshCache();
    }

    // Normal lookup from cache
    if (this.settingsCache.has(key)) {
      return this.settingsCache.get(key) ?? null;
    }

    if (defaultValue !== undefined) {
      return defaultValue;
    }

    return null;
  }

  async getRestaurantCardConfig() {
    if (Date.now() - this.cacheTimestamp > this.CACHE_TTL) {
      await this.refreshCache();
    }

    return {
      default: this.settingsCache.get("HOME_SCREEN_RESTAURANT_CARD_STYLE") || null,
      image: this.settingsCache.get("HOME_SCREEN_RESTAURANT_CARD_IMAGE") || null,
      css: this.settingsCache.get("HOME_SCREEN_RESTAURANT_CARD_CSS") || null,
    };
  }

  /**
   * Get a setting as number
   */
  async getNumber(key: string, defaultValue?: number): Promise<number | null> {
    const value = await this.get(key);
    if (value === null) {
      return defaultValue !== undefined ? defaultValue : null;
    }
    return parseFloat(value);
  }

  /**
   * Get a setting as boolean
   */
  async getBoolean(key: string, defaultValue?: boolean): Promise<boolean> {
    const value = await this.get(key);
    if (value === null) {
      return defaultValue !== undefined ? defaultValue : false;
    }
    return value.toLowerCase() === "true" || value === "1";
  }

  /**
   * Get all settings by category
   */
  async getByCategory(category: string): Promise<Record<string, string>> {
    const settings = await this.appSettingsRepository.find({
      where: { category, is_active: true },
    });

    const result: Record<string, string> = {};
    settings.forEach((setting) => {
      result[setting.key] = setting.value;
    });

    return result;
  }

  /**
   * Get all settings
   */
  async getAll(): Promise<AppSettings[]> {
    return this.appSettingsRepository.find({
      order: { category: "ASC", key: "ASC" },
    });
  }

  /**
   * Create or update a setting
   */
  async set(
    key: string,
    value: string,
    category?: string,
    description?: string,
    role?: string
  ): Promise<AppSettings> {
    let setting = await this.appSettingsRepository.findOne({ where: { key } });

    if (setting) {
      setting.value = value;
      if (category) setting.category = category;
      if (description) setting.description = description;
    } else {
      setting = this.appSettingsRepository.create({
        key,
        value,
        category,
        description,
      });
    }

    const saved = await this.appSettingsRepository.save(setting);
    await this.refreshCache();

    this.logger.log(`✅ Setting updated: ${key} = ${value}`);
    return saved;
  }

  /**
   * Update a setting
   */
  async update(id: number, value: string): Promise<AppSettings> {
    const setting = await this.appSettingsRepository.findOne({ where: { id } });

    if (!setting) {
      throw new NotFoundException(`Setting with ID ${id} not found`);
    }

    setting.value = value;
    const saved = await this.appSettingsRepository.save(setting);
    await this.refreshCache();

    this.logger.log(`✅ Setting updated: ${setting.key} = ${value}`);
    return saved;
  }

  /**
   * Delete a setting
   */
  async delete(id: number, role?: string): Promise<void> {
    const setting = await this.appSettingsRepository.findOne({ where: { id } });

    if (!setting) {
      throw new NotFoundException(`Setting with ID ${id} not found`);
    }

    await this.appSettingsRepository.remove(setting);
    await this.refreshCache();

    this.logger.log(`✅ Setting deleted: ${setting.key}`);
  }

  /**
   * Toggle setting active status
   */
  async toggleActive(id: number, role?: string): Promise<AppSettings> {
    const setting = await this.appSettingsRepository.findOne({ where: { id } });

    if (!setting) {
      throw new NotFoundException(`Setting with ID ${id} not found`);
    }

    setting.is_active = !setting.is_active;
    const saved = await this.appSettingsRepository.save(setting);
    await this.refreshCache();

    await this.adminAccessService.createLog(
      role,
      setting.key,
      setting.is_active,
    );

    this.logger.log(
      `✅ Setting ${setting.is_active ? "activated" : "deactivated"}: ${setting.key}`,
    );
    return saved;
  }

  /**
   * Bulk create/update settings
   */
  async bulkSet(
    settings: Array<{
      key: string;
      value: string;
      category?: string;
      description?: string;
    }>
  ): Promise<void> {
    for (const setting of settings) {
      await this.set(
        setting.key,
        setting.value,
        setting.category,
        setting.description,
      );
    }

    this.logger.log(`✅ Bulk updated ${settings.length} settings`);
  }
}
