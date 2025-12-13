import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AppSettings } from "../entities/app-settings.entity";

@Injectable()
export class AppSettingsService {
  private readonly logger = new Logger(AppSettingsService.name);
  private settingsCache: Map<string, string> = new Map();
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute cache

  constructor(
    @InjectRepository(AppSettings)
    private readonly appSettingsRepository: Repository<AppSettings>,
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
   * Get a setting value by key with caching
   */
  async get(key: string, defaultValue?: string): Promise<string | null> {
    // Check if cache needs refresh
    if (Date.now() - this.cacheTimestamp > this.CACHE_TTL) {
      await this.refreshCache();
    }

    // Return from cache
    if (this.settingsCache.has(key)) {
      return this.settingsCache.get(key) || null;
    }

    // Return default if provided
    if (defaultValue !== undefined) {
      return defaultValue;
    }

    return null;
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
  async delete(id: number): Promise<void> {
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
  async toggleActive(id: number): Promise<AppSettings> {
    const setting = await this.appSettingsRepository.findOne({ where: { id } });

    if (!setting) {
      throw new NotFoundException(`Setting with ID ${id} not found`);
    }

    setting.is_active = !setting.is_active;
    const saved = await this.appSettingsRepository.save(setting);
    await this.refreshCache();

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
    }>,
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
