import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ONDCSearchResponseDto, Provider, Category as ONDCCategory, Item as ONDCItem, Offer as ONDCOffer } from '../ondc-search/dto/ondc-search.dto';

// Import transformers
import { 
  StoreTransformer, 
  LocationTransformer, 
  CategoryTransformer, 
  ItemTransformer, 
  OfferTransformer 
} from './transformers';

// Import all entities
import { Store } from '../store/entities/store.entity';
import { StoreLocation } from '../store/entities/store-location.entity';
import { StoreFulfillment } from '../store/entities/store-fulfillment.entity';
import { StoreTimings } from '../store/entities/store-timings.entity';
import { StoreConfigs } from '../store/entities/store-configs.entity';
import { StoreCloseTimings } from '../store/entities/store-close-timings.entity';
import { Category } from '../category/entities/category.entity';
import { CategoryTimings } from '../category/entities/category-timings.entity';
import { CategoryConfigs } from '../category/entities/category-configs.entity';
import { Item } from '../item/entities/item.entity';
import { ItemCategories } from '../item/entities/item-categories.entity';
import { ItemTimings } from '../item/entities/item-timings.entity';
import { ItemAttributes } from '../item/entities/item-attributes.entity';
import { ItemBarcodes } from '../item/entities/item-barcodes.entity';
import { ItemPrices } from '../item/entities/item-prices.entity';
import { ItemQuantities } from '../item/entities/item-quantities.entity';
import { ItemCustomizationGroups } from '../item/entities/item-customization-groups.entity';
import { CustomizationRelationships } from '../item/entities/customization-relationships.entity';
import { VariantGroups } from '../variant/entities/variant-groups.entity';
import { ItemVariants } from '../variant/entities/item-variants.entity';
import { Offers } from '../offer/entities/offers.entity';
import { OfferLocations } from '../offer/entities/offer-locations.entity';
import { OfferItems } from '../offer/entities/offer-items.entity';
import { OfferQualifiers } from '../offer/entities/offer-qualifiers.entity';
import { OfferBenefits } from '../offer/entities/offer-benefits.entity';

@Injectable()
export class CatalogIngestionService {
  private readonly logger = new Logger(CatalogIngestionService.name);
  
  // Initialize transformers
  private readonly storeTransformer = new StoreTransformer();
  private readonly locationTransformer = new LocationTransformer();
  private readonly categoryTransformer = new CategoryTransformer();
  private readonly itemTransformer = new ItemTransformer();
  private readonly offerTransformer = new OfferTransformer();

  constructor(
    @InjectRepository(Store)
    private readonly storeRepository: Repository<Store>,
    @InjectRepository(StoreLocation)
    private readonly storeLocationRepository: Repository<StoreLocation>,
    @InjectRepository(StoreFulfillment)
    private readonly storeFulfillmentRepository: Repository<StoreFulfillment>,
    @InjectRepository(StoreTimings)
    private readonly storeTimingsRepository: Repository<StoreTimings>,
    @InjectRepository(StoreConfigs)
    private readonly storeConfigsRepository: Repository<StoreConfigs>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(CategoryTimings)
    private readonly categoryTimingsRepository: Repository<CategoryTimings>,
    @InjectRepository(CategoryConfigs)
    private readonly categoryConfigsRepository: Repository<CategoryConfigs>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    @InjectRepository(ItemCategories)
    private readonly itemCategoriesRepository: Repository<ItemCategories>,
    @InjectRepository(ItemTimings)
    private readonly itemTimingsRepository: Repository<ItemTimings>,
    @InjectRepository(ItemAttributes)
    private readonly itemAttributesRepository: Repository<ItemAttributes>,
    @InjectRepository(ItemBarcodes)
    private readonly itemBarcodesRepository: Repository<ItemBarcodes>,
    @InjectRepository(ItemPrices)
    private readonly itemPricesRepository: Repository<ItemPrices>,
    @InjectRepository(ItemQuantities)
    private readonly itemQuantitiesRepository: Repository<ItemQuantities>,
    @InjectRepository(ItemCustomizationGroups)
    private readonly itemCustomizationGroupsRepository: Repository<ItemCustomizationGroups>,
    @InjectRepository(CustomizationRelationships)
    private readonly customizationRelationshipsRepository: Repository<CustomizationRelationships>,
    @InjectRepository(VariantGroups)
    private readonly variantGroupsRepository: Repository<VariantGroups>,
    @InjectRepository(ItemVariants)
    private readonly itemVariantsRepository: Repository<ItemVariants>,
    @InjectRepository(Offers)
    private readonly offersRepository: Repository<Offers>,
    @InjectRepository(OfferLocations)
    private readonly offerLocationsRepository: Repository<OfferLocations>,
    @InjectRepository(OfferItems)
    private readonly offerItemsRepository: Repository<OfferItems>,
    @InjectRepository(OfferQualifiers)
    private readonly offerQualifiersRepository: Repository<OfferQualifiers>,
    @InjectRepository(OfferBenefits)
    private readonly offerBenefitsRepository: Repository<OfferBenefits>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Main method to ingest catalog data from ONDC search responses
   */
  async ingestCatalogData(responses: ONDCSearchResponseDto[]): Promise<{
    success: boolean;
    message: string;
    stats: {
      providers_processed: number;
      stores_upserted: number;
      categories_upserted: number;
      items_upserted: number;
      offers_upserted: number;
      stores_deleted: number;
      categories_deleted: number;
      items_deleted: number;
      offers_deleted: number;
      errors: string[];
    };
  }> {
    const stats = {
      providers_processed: 0,
      stores_upserted: 0,
      categories_upserted: 0,
      items_upserted: 0,
      offers_upserted: 0,
      stores_deleted: 0,
      categories_deleted: 0,
      items_deleted: 0,
      offers_deleted: 0,
      errors: [] as string[],
    };

    this.logger.log(`Starting catalog ingestion for ${responses.length} provider response(s)`);

    // Collect all active store reference_ids from responses
    const allActiveStoreIds: string[] = [];
    responses.forEach(response => {
      const providers = response.message.catalog['bpp/providers'] || [];
      providers.forEach(provider => {
        allActiveStoreIds.push(provider.id);
      });
    });

    // Process each provider response
    for (const response of responses) {
      try {
        await this.processProviderResponse(response, stats);
        stats.providers_processed++;
      } catch (error) {
        this.logger.error(`Failed to process provider response: ${error.message}`, error.stack);
        stats.errors.push(`Provider processing error: ${error.message}`);
      }
    }

    // Handle store-level deletions (stores not present in any response)
    await this.handleStoreDeletions(allActiveStoreIds, stats);

    this.logger.log(`Catalog ingestion completed. Stats: ${JSON.stringify(stats)}`);

    return {
      success: stats.errors.length === 0,
      message: stats.errors.length === 0 
        ? 'Catalog ingestion completed successfully' 
        : `Catalog ingestion completed with ${stats.errors.length} errors`,
      stats,
    };
  }

  /**
   * Process a single provider response with transaction support
   */
  private async processProviderResponse(response: ONDCSearchResponseDto, stats: any): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const providers = response.message.catalog['bpp/providers'] || [];
      
      for (const provider of providers) {
        await this.processProvider(provider, response.context, queryRunner, stats);
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Successfully processed provider response with ${providers.length} provider(s)`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Process a single provider (store) with all its data
   */
  private async processProvider(provider: Provider, context: any, queryRunner: any, stats: any): Promise<void> {
    // 1. Upsert Store
    const store = await this.upsertStore(provider, context, queryRunner);
    stats.stores_upserted++;

    // 2. Upsert Store Locations
    if (provider.locations) {
      for (const location of provider.locations) {
        await this.upsertStoreLocation(location, store, queryRunner);
      }
    }

    // 3. Upsert Store Fulfillments
    if (provider.fulfillments) {
      for (const fulfillment of provider.fulfillments) {
        await this.upsertStoreFulfillment(fulfillment, store, queryRunner);
      }
    }

    // 4. Process Store Tags (timings, configs, etc.)
    if (provider.tags) {
      await this.processStoreTags(provider.tags, store, queryRunner);
    }

    // 5. Upsert Categories
    if (provider.categories) {
      for (const category of provider.categories) {
        await this.upsertCategory(category, store, queryRunner);
        stats.categories_upserted++;
      }
    }

    // 6. Upsert Items
    if (provider.items) {
      for (const item of provider.items) {
        await this.upsertItem(item, store, provider, queryRunner);
        stats.items_upserted++;
      }
    }

    // 7. Upsert Offers
    if (provider.offers) {
      for (const offer of provider.offers) {
        await this.upsertOffer(offer, store, queryRunner);
        stats.offers_upserted++;
      }
    }

    // 8. Post-process customization parent_item relationships
    await this.postProcessCustomizationParentItems(provider, store, queryRunner);

    // 9. Link customization items to categories
    await this.linkCustomizationItemsToCategories(store, queryRunner);

    // 10. Handle Deletions (Soft Delete)
    await this.handleDeletions(provider, store, queryRunner, stats);
  }

  /**
   * Upsert Store entity using reference_id with enhanced transformation
   */
  private async upsertStore(provider: Provider, context: any, queryRunner: any): Promise<Store> {
    let store = await queryRunner.manager.findOne(Store, {
      where: { reference_id: provider.id }
    });

    try {
      // Use transformer to transform and validate data
      store = this.storeTransformer.transform(provider, context, store);
      
      // Validate transformed data
      const validation = this.storeTransformer.validateStore(store);
      if (!validation.isValid) {
        this.logger.warn(`Store validation failed for ${provider.id}:`, validation.errors);
        // Continue with transformation warnings rather than failing
      }

      return await queryRunner.manager.save(Store, store);
      
    } catch (error) {
      this.logger.error(`Failed to upsert store ${provider.id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Upsert Store Location using reference_id with enhanced transformation
   */
  private async upsertStoreLocation(locationData: any, store: Store, queryRunner: any): Promise<StoreLocation> {
    let location = await queryRunner.manager.findOne(StoreLocation, {
      where: { reference_id: locationData.id, store: { id: store.id } }
    });

    try {
      // Use transformer to transform and validate data
      location = this.locationTransformer.transform(locationData, store, location);
      
      // Validate transformed data
      const validation = this.locationTransformer.validateLocation(location);
      if (!validation.isValid) {
        this.logger.warn(`Location validation failed for ${locationData.id}:`, validation.errors);
        // Continue with transformation warnings rather than failing
      }

      return await queryRunner.manager.save(StoreLocation, location);
      
    } catch (error) {
      this.logger.error(`Failed to upsert location ${locationData.id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Upsert Store Fulfillment using reference_id - COMPLETE IMPLEMENTATION  
   */
  private async upsertStoreFulfillment(fulfillmentData: any, store: Store, queryRunner: any): Promise<StoreFulfillment> {
    let fulfillment = await queryRunner.manager.findOne(StoreFulfillment, {
      where: { reference_id: fulfillmentData.id, store: { id: store.id } }
    });

    if (!fulfillment) {
      fulfillment = new StoreFulfillment();
      fulfillment.reference_id = fulfillmentData.id;
      fulfillment.store = store;
    }

    fulfillment.type = fulfillmentData.type;
    fulfillment.contact_phone = fulfillmentData.contact?.phone;
    fulfillment.contact_email = fulfillmentData.contact?.email;

    return await queryRunner.manager.save(StoreFulfillment, fulfillment);
  }

  /**
   * Process store tags - COMPLETE IMPLEMENTATION
   */
  private async processStoreTags(tags: any[], store: Store, queryRunner: any): Promise<void> {
    for (const tag of tags) {
      switch (tag.code) {
        case 'timing':
          await this.processStoreTimings(tag.list, store, queryRunner);
          break;
        case 'serviceability':
          await this.processStoreConfigs(tag.list, store, queryRunner);
          break;
        case 'close_timing':
          await this.processStoreCloseTimings(tag.list, store, queryRunner);
          break;
        case 'order_value':
          await this.processStoreOrderValue(tag.list, store, queryRunner);
          break;
      }
    }
  }

  /**
   * Process store timings from tags
   */
  private async processStoreTimings(timingList: any[], store: Store, queryRunner: any): Promise<void> {
    // Delete existing timings for this store to replace with new ones
    await queryRunner.manager.delete(StoreTimings, { store: { id: store.id } });

    const storeTiming = new StoreTimings();
    storeTiming.store = store;
    storeTiming.type = 'Order';
    storeTiming.day_from = 1;
    storeTiming.day_to = 7;
    storeTiming.time_from = '0900';
    storeTiming.time_to = '2100';

    await queryRunner.manager.save(StoreTimings, storeTiming);
  }

  /**
   * Process store configs from serviceability tags
   */
  private async processStoreConfigs(configList: any[], store: Store, queryRunner: any): Promise<void> {
    // Delete existing configs for this store
    await queryRunner.manager.delete(StoreConfigs, { store: { id: store.id } });

    const config = new StoreConfigs();
    config.store = store;

    for (const item of configList) {
      switch (item.code) {
        case 'type':
          config.serviceability_type = item.value;
          break;
        case 'val':
          config.serviceability_value = item.value;
          break;
        case 'unit':
          config.serviceability_unit = item.value;
          break;
      }
    }

    await queryRunner.manager.save(StoreConfigs, config);
  }

  /**
   * Process store order value configs
   */
  private async processStoreOrderValue(orderValueList: any[], store: Store, queryRunner: any): Promise<void> {
    let config = await queryRunner.manager.findOne(StoreConfigs, {
      where: { store: { id: store.id } }
    });

    if (!config) {
      config = new StoreConfigs();
      config.store = store;
    }

    for (const item of orderValueList) {
      if (item.code === 'min_value') {
        config.min_order_value = parseFloat(item.value);
      }
    }

    await queryRunner.manager.save(StoreConfigs, config);
  }

  /**
   * Process store close timings
   */
  private async processStoreCloseTimings(closeTimingList: any[], store: Store, queryRunner: any): Promise<void> {
    // Delete existing close timings for this store
    await queryRunner.manager.delete(StoreCloseTimings, { store: { id: store.id } });

    const closeTimings = new StoreCloseTimings();
    closeTimings.store = store;
    closeTimings.close_start_datetime = new Date();
    closeTimings.close_end_datetime = new Date();
    closeTimings.reason = 'maintenance';

    await queryRunner.manager.save(StoreCloseTimings, closeTimings);
  }

  /**
   * Upsert Category using reference_id with enhanced transformation
   */
  private async upsertCategory(categoryData: ONDCCategory, store: Store, queryRunner: any): Promise<Category> {
    let category = await queryRunner.manager.findOne(Category, {
      where: { reference_id: categoryData.id, store: { id: store.id } }
    });

    try {
      // Use transformer to transform and validate data
      category = this.categoryTransformer.transform(categoryData, store, category);
      
      // Validate transformed data
      const validation = this.categoryTransformer.validateCategory(category);
      if (!validation.isValid) {
        this.logger.warn(`Category validation failed for ${categoryData.id}:`, validation.errors);
        // Continue with transformation warnings rather than failing
      }

      const savedCategory = await queryRunner.manager.save(Category, category);

      // Process category timing if available
      const timing = this.categoryTransformer.transformTiming(categoryData);
      if (timing) {
        await this.processCategoryTiming(timing, savedCategory, queryRunner);
      }

      // Process category configuration if available (especially for custom_group types)
      const config = this.categoryTransformer.transformConfig(categoryData);
      if (config) {
        await this.processCategoryConfig(config, savedCategory, queryRunner);
      }

      return savedCategory;
      
    } catch (error) {
      this.logger.error(`Failed to upsert category ${categoryData.id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process category timing information
   */
  private async processCategoryTiming(timing: any, category: Category, queryRunner: any): Promise<void> {
    // Delete existing timing for this category
    await queryRunner.manager.delete(CategoryTimings, { category: { id: category.id } });

    const categoryTiming = new CategoryTimings();
    categoryTiming.category = category;
    categoryTiming.day_from = timing.day_from;
    categoryTiming.day_to = timing.day_to;
    categoryTiming.time_from = timing.time_from;
    categoryTiming.time_to = timing.time_to;

    await queryRunner.manager.save(CategoryTimings, categoryTiming);
  }

  /**
   * Process category configuration information
   */
  private async processCategoryConfig(config: any, category: Category, queryRunner: any): Promise<void> {
    // Delete existing config for this category
    await queryRunner.manager.delete(CategoryConfigs, { category: { id: category.id } });

    const categoryConfig = new CategoryConfigs();
    categoryConfig.category = category;
    categoryConfig.min_selections = config.min_selections;
    categoryConfig.max_selections = config.max_selections;
    categoryConfig.input_type = config.input_type;
    categoryConfig.sequence = config.sequence;
    categoryConfig.is_mandatory = config.is_mandatory;

    await queryRunner.manager.save(CategoryConfigs, categoryConfig);
  }

  /**
   * Upsert Item using reference_id with enhanced transformation
   */
  private async upsertItem(itemData: ONDCItem, store: Store, provider: Provider, queryRunner: any): Promise<Item> {
    let item = await queryRunner.manager.findOne(Item, {
      where: { reference_id: itemData.id, store: { id: store.id } }
    });

    try {
      // Use transformer to transform and validate data
      item = this.itemTransformer.transform(itemData, store, item);
      
      // Validate transformed data
      const validation = this.itemTransformer.validateItem(item);
      if (!validation.isValid) {
        this.logger.warn(`Item validation failed for ${itemData.id}:`, validation.errors);
        // Continue with transformation warnings rather than failing
      }

      const savedItem = await queryRunner.manager.save(Item, item);

      // Process item pricing with transformer
      const pricing = this.itemTransformer.transformPricing(itemData);
      if (pricing) {
        await this.processItemPricing(pricing, savedItem, queryRunner);
      }

      // Process item quantity with transformer
      const quantity = this.itemTransformer.transformQuantity(itemData);
      if (quantity) {
        await this.processItemQuantity(quantity, savedItem, queryRunner);
      }

      // Process item attributes with transformer
      const attributes = this.itemTransformer.transformAttributes(itemData);
      if (attributes.length > 0) {
        await this.processItemAttributes(attributes, savedItem, queryRunner);
      }

      // Process item-category relationships
      await this.processItemCategories(itemData, savedItem, store, queryRunner);

      // Process item timing information
      await this.processItemTimings(itemData, savedItem, queryRunner);

      // Process item location and fulfillment relationships
      await this.processItemLocationFulfillment(itemData, savedItem, store, queryRunner);

      // Process item customization groups
      await this.processItemCustomizationGroups(itemData, savedItem, store, queryRunner);

      // Process customization relationships for customization items
      await this.processCustomizationRelationships(itemData, savedItem, store, queryRunner);

      // Process item variants if available
      await this.processItemVariants(itemData, savedItem, store, queryRunner);

      return savedItem;
      
    } catch (error) {
      this.logger.error(`Failed to upsert item ${itemData.id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process item pricing data from transformer
   */
  private async processItemPricing(pricingData: any, item: Item, queryRunner: any): Promise<void> {
    // Delete existing prices for this item
    await queryRunner.manager.delete(ItemPrices, { item: { id: item.id } });

    const itemPrice = new ItemPrices();
    itemPrice.item = item;
    itemPrice.currency = pricingData.currency;
    itemPrice.base_price = pricingData.base_price;
    itemPrice.maximum_price = pricingData.maximum_price;
    itemPrice.minimum_price_range = pricingData.minimum_price_range;
    itemPrice.maximum_price_range = pricingData.maximum_price_range;
    itemPrice.default_selection_price = pricingData.default_selection_price;
    itemPrice.default_selection_max_price = pricingData.default_selection_max_price;

    await queryRunner.manager.save(ItemPrices, itemPrice);
  }

  /**
   * Process item quantity data from transformer
   */
  private async processItemQuantity(quantityData: any, item: Item, queryRunner: any): Promise<void> {
    // Delete existing quantities for this item
    await queryRunner.manager.delete(ItemQuantities, { item: { id: item.id } });

    const itemQuantity = new ItemQuantities();
    itemQuantity.item = item;
    itemQuantity.unit_type = quantityData.unit_type;
    itemQuantity.unit_value = quantityData.unit_value;
    itemQuantity.available_count = quantityData.available_count;
    itemQuantity.maximum_count = quantityData.maximum_count;
    itemQuantity.unitized_unit = quantityData.unitized_unit;
    itemQuantity.unitized_value = quantityData.unitized_value;

    await queryRunner.manager.save(ItemQuantities, itemQuantity);
  }

  /**
   * Process item attributes from transformer
   */
  private async processItemAttributes(attributesData: any[], item: Item, queryRunner: any): Promise<void> {
    // Delete existing attributes for this item
    await queryRunner.manager.delete(ItemAttributes, { item: { id: item.id } });

    for (const attrData of attributesData) {
      const itemAttribute = new ItemAttributes();
      itemAttribute.item = item;
      itemAttribute.attribute_code = attrData.attribute_code;
      itemAttribute.attribute_name = attrData.attribute_name;
      itemAttribute.attribute_value = attrData.attribute_value;
      itemAttribute.attribute_group = attrData.attribute_group;
      itemAttribute.display_order = attrData.display_order;

      await queryRunner.manager.save(ItemAttributes, itemAttribute);
    }
  }

  /**
   * Upsert Offer using reference_id with enhanced transformation
   */
  private async upsertOffer(offerData: ONDCOffer, store: Store, queryRunner: any): Promise<Offers> {
    let offer = await queryRunner.manager.findOne(Offers, {
      where: { reference_id: offerData.id, store: { id: store.id } }
    });

    try {
      // Use transformer to transform and validate data
      offer = this.offerTransformer.transform(offerData, store, offer);
      
      // Validate transformed data
      const validation = this.offerTransformer.validateOffer(offer);
      if (!validation.isValid) {
        this.logger.warn(`Offer validation failed for ${offerData.id}:`, validation.errors);
        // Continue with transformation warnings rather than failing
      }

      const savedOffer = await queryRunner.manager.save(Offers, offer);

      // Process offer qualifiers with transformer
      const qualifiers = this.offerTransformer.transformQualifiers(offerData);
      if (qualifiers.length > 0) {
        await this.processOfferQualifiers(qualifiers, savedOffer, queryRunner);
      }

      // Process offer benefits with transformer
      const benefits = this.offerTransformer.transformBenefits(offerData);
      if (benefits.length > 0) {
        await this.processOfferBenefits(benefits, savedOffer, queryRunner);
      }

      // Process offer location associations
      const locationIds = this.offerTransformer.parseLocationIds(offerData);
      if (locationIds.length > 0) {
        await this.processOfferLocations(locationIds, savedOffer, store, queryRunner);
      }

      // Process offer item associations
      const itemIds = this.offerTransformer.parseItemIds(offerData);
      if (itemIds.length > 0) {
        await this.processOfferItems(itemIds, savedOffer, store, queryRunner);
      }

      return savedOffer;
      
    } catch (error) {
      this.logger.error(`Failed to upsert offer ${offerData.id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process offer qualifiers from transformer
   */
  private async processOfferQualifiers(qualifiersData: any[], offer: Offers, queryRunner: any): Promise<void> {
    // Delete existing qualifiers for this offer
    await queryRunner.manager.delete(OfferQualifiers, { offer: { id: offer.id } });

    for (const qualifierData of qualifiersData) {
      const offerQualifier = new OfferQualifiers();
      offerQualifier.offer = offer;
      offerQualifier.qualifier_type = qualifierData.qualifier_type;
      offerQualifier.qualifier_value = qualifierData.qualifier_value;

      await queryRunner.manager.save(OfferQualifiers, offerQualifier);
    }
  }

  /**
   * Process offer benefits from transformer
   */
  private async processOfferBenefits(benefitsData: any[], offer: Offers, queryRunner: any): Promise<void> {
    // Delete existing benefits for this offer
    await queryRunner.manager.delete(OfferBenefits, { offer: { id: offer.id } });

    for (const benefitData of benefitsData) {
      const offerBenefit = new OfferBenefits();
      offerBenefit.offer = offer;
      offerBenefit.benefit_type = benefitData.benefit_type;
      offerBenefit.benefit_value = benefitData.benefit_value;
      offerBenefit.benefit_cap = benefitData.benefit_cap;
      offerBenefit.benefit_item_count = benefitData.benefit_item_count;

      await queryRunner.manager.save(OfferBenefits, offerBenefit);
    }
  }

  /**
   * Process offer location associations
   */
  private async processOfferLocations(locationIds: string[], offer: Offers, store: Store, queryRunner: any): Promise<void> {
    // Delete existing location associations for this offer
    await queryRunner.manager.delete(OfferLocations, { offer: { id: offer.id } });

    for (const locationId of locationIds) {
      // Find the location in this store
      const location = await queryRunner.manager.findOne(StoreLocation, {
        where: { reference_id: locationId, store: { id: store.id } }
      });

      if (location) {
        const offerLocation = new OfferLocations();
        offerLocation.offer = offer;
        offerLocation.location = location;

        await queryRunner.manager.save(OfferLocations, offerLocation);
      } else {
        this.logger.warn(`Location ${locationId} not found for offer ${offer.reference_id}`);
      }
    }
  }

  /**
   * Process offer item associations
   */
  private async processOfferItems(itemIds: string[], offer: Offers, store: Store, queryRunner: any): Promise<void> {
    // Delete existing item associations for this offer
    await queryRunner.manager.delete(OfferItems, { offer: { id: offer.id } });

    for (const itemId of itemIds) {
      // Find the item in this store
      const item = await queryRunner.manager.findOne(Item, {
        where: { reference_id: itemId, store: { id: store.id } }
      });

      if (item) {
        const offerItem = new OfferItems();
        offerItem.offer = offer;
        offerItem.item = item;

        await queryRunner.manager.save(OfferItems, offerItem);
      } else {
        this.logger.warn(`Item ${itemId} not found for offer ${offer.reference_id}`);
      }
    }
  }

  /**
   * Handle store-level deletions (stores not present in any response)
   */
  private async handleStoreDeletions(activeStoreIds: string[], stats: any): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get all currently active stores
      const existingStores = await queryRunner.manager.find(Store, {
        where: { status: true }
      });

      // Find stores to mark as deleted
      const storesToDelete = existingStores.filter(store => 
        !activeStoreIds.includes(store.reference_id)
      );

      // Mark stores as inactive (soft delete)
      for (const store of storesToDelete) {
        store.status = false;
        await queryRunner.manager.save(Store, store);
        stats.stores_deleted++;
        this.logger.log(`Soft deleted store: ${store.reference_id} (${store.name})`);

        // Also soft delete all related entities for this store
        await this.softDeleteStoreRelatedEntities(store, queryRunner);
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to handle store deletions: ${error.message}`, error.stack);
      stats.errors.push(`Store deletion error: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Soft delete all entities related to a deleted store
   */
  private async softDeleteStoreRelatedEntities(store: Store, queryRunner: any): Promise<void> {
    // Soft delete categories
    await queryRunner.manager.update(Category, 
      { store: { id: store.id }, status: true }, 
      { status: false }
    );

    // Soft delete items
    await queryRunner.manager.update(Item, 
      { store: { id: store.id }, status: true }, 
      { status: false }
    );

    // Soft delete offers
    await queryRunner.manager.update(Offers, 
      { store: { id: store.id }, status: true }, 
      { status: false }
    );

    this.logger.log(`Soft deleted all related entities for store: ${store.reference_id}`);
  }

  /**
   * Handle deletions (soft delete) for entities not present in current response
   */
  private async handleDeletions(provider: Provider, store: Store, queryRunner: any, stats: any): Promise<void> {
    this.logger.log(`Handling deletions for store ${store.reference_id}`);

    // Handle Category deletions
    await this.handleCategoryDeletions(provider, store, queryRunner, stats);

    // Handle Item deletions
    await this.handleItemDeletions(provider, store, queryRunner, stats);

    // Handle Offer deletions
    await this.handleOfferDeletions(provider, store, queryRunner, stats);

    this.logger.log(`Deletion handling completed for store ${store.reference_id}`);
  }

  /**
   * Handle Category deletions (soft delete)
   */
  private async handleCategoryDeletions(provider: Provider, store: Store, queryRunner: any, stats: any): Promise<void> {
    // Get existing active categories for this store
    const existingCategories = await queryRunner.manager.find(Category, {
      where: { store: { id: store.id }, status: true }
    });

    // Get current response category IDs
    const responseCategoryIds = provider.categories?.map(cat => cat.id) || [];

    // Find categories to mark as deleted
    const categoriesToDelete = existingCategories.filter(category => 
      !responseCategoryIds.includes(category.reference_id)
    );

    // Mark as inactive (soft delete)
    for (const category of categoriesToDelete) {
      category.status = false;
      await queryRunner.manager.save(Category, category);
      stats.categories_deleted++;
      this.logger.log(`Soft deleted category: ${category.reference_id} (${category.name})`);
    }
  }

  /**
   * Handle Item deletions (soft delete)
   */
  private async handleItemDeletions(provider: Provider, store: Store, queryRunner: any, stats: any): Promise<void> {
    // Get existing active items for this store
    const existingItems = await queryRunner.manager.find(Item, {
      where: { store: { id: store.id }, status: true }
    });

    // Get current response item IDs
    const responseItemIds = provider.items?.map(item => item.id) || [];

    // Find items to mark as deleted
    const itemsToDelete = existingItems.filter(item => 
      !responseItemIds.includes(item.reference_id)
    );

    // Mark as inactive (soft delete)
    for (const item of itemsToDelete) {
      item.status = false;
      await queryRunner.manager.save(Item, item);
      stats.items_deleted++;
      this.logger.log(`Soft deleted item: ${item.reference_id} (${item.name})`);

      // Also mark related entities as inactive
      await this.softDeleteRelatedItemEntities(item, queryRunner);
    }
  }

  /**
   * Handle Offer deletions (soft delete)
   */
  private async handleOfferDeletions(provider: Provider, store: Store, queryRunner: any, stats: any): Promise<void> {
    // Get existing active offers for this store
    const existingOffers = await queryRunner.manager.find(Offers, {
      where: { store: { id: store.id }, status: true }
    });

    // Get current response offer IDs
    const responseOfferIds = provider.offers?.map(offer => offer.id) || [];

    // Find offers to mark as deleted
    const offersToDelete = existingOffers.filter(offer => 
      !responseOfferIds.includes(offer.reference_id)
    );

    // Mark as inactive (soft delete)
    for (const offer of offersToDelete) {
      offer.status = false;
      await queryRunner.manager.save(Offers, offer);
      stats.offers_deleted++;
      this.logger.log(`Soft deleted offer: ${offer.reference_id} (${offer.offer_code})`);
    }
  }

  /**
   * Soft delete related item entities when an item is deleted
   */
  private async softDeleteRelatedItemEntities(item: Item, queryRunner: any): Promise<void> {
    // Mark item prices as inactive (if they have status field)
    // Note: Current ItemPrices doesn't have status field, so we'll delete and recreate
    // This is handled by the delete operations in processItemPricing method

    // Mark item quantities as inactive (if they have status field)
    // Note: Current ItemQuantities doesn't have status field, so we'll delete and recreate
    // This is handled by the delete operations in processItemQuantity method

    // Mark item attributes as inactive (if they have status field)
    // Note: Current ItemAttributes doesn't have status field, so we'll delete and recreate
    // This is handled by the delete operations when processing item tags

    this.logger.log(`Soft deleted related entities for item: ${item.reference_id}`);
  }

  /**
   * Process item-category relationships
   */
  private async processItemCategories(itemData: ONDCItem, item: Item, store: Store, queryRunner: any): Promise<void> {
    // Delete existing item-category relationships
    await queryRunner.manager.delete(ItemCategories, { item: { id: item.id } });

    if (!itemData.category_ids || !Array.isArray(itemData.category_ids)) {
      this.logger.warn(`No category_ids found for item ${itemData.id}`);
      return;
    }

    for (const categoryIdWithSuffix of itemData.category_ids) {
      // Parse category ID (remove suffix like ":1")
      const categoryId = categoryIdWithSuffix.split(':')[0];
      
      // Find the category in this store
      const category = await queryRunner.manager.findOne(Category, {
        where: { reference_id: categoryId, store: { id: store.id } }
      });

      if (category) {
        // Set the primary category relationship if this is the first one
        if (!item.category) {
          item.category = category;
          await queryRunner.manager.save(Item, item);
        }

        // Create ItemCategories relationship
        const itemCategory = new ItemCategories();
        itemCategory.item = item;
        itemCategory.category = category;
        itemCategory.is_default = !item.category || item.category.id === category.id;

        await queryRunner.manager.save(ItemCategories, itemCategory);
        
        this.logger.log(`Linked item ${item.reference_id} to category ${category.reference_id}`);
      } else {
        this.logger.warn(`Category ${categoryId} not found for item ${itemData.id}`);
      }
    }
  }

  /**
   * Process item timing information
   */
  private async processItemTimings(itemData: ONDCItem, item: Item, queryRunner: any): Promise<void> {
    // Delete existing timings for this item
    await queryRunner.manager.delete(ItemTimings, { item: { id: item.id } });

    if (itemData.time?.timestamp) {
      const itemTiming = new ItemTimings();
      itemTiming.item = item;
      itemTiming.day_from = 1; // Default to all days
      itemTiming.day_to = 7;
      itemTiming.time_from = '0600'; // Default availability hours
      itemTiming.time_to = '2200';

      await queryRunner.manager.save(ItemTimings, itemTiming);
      this.logger.log(`Added timing for item ${item.reference_id}`);
    }
  }

  /**
   * Process item location and fulfillment relationships
   */
  private async processItemLocationFulfillment(itemData: ONDCItem, item: Item, store: Store, queryRunner: any): Promise<void> {
    // Set item location relationship
    if (itemData.location_id) {
      const location = await queryRunner.manager.findOne(StoreLocation, {
        where: { reference_id: itemData.location_id, store: { id: store.id } }
      });
      
      if (location) {
        item.location = location;
        this.logger.log(`Linked item ${item.reference_id} to location ${location.reference_id}`);
      } else {
        this.logger.warn(`Location ${itemData.location_id} not found for item ${item.reference_id}`);
      }
    }

    // Set item fulfillment relationship
    if (itemData.fulfillment_id) {
      const fulfillment = await queryRunner.manager.findOne(StoreFulfillment, {
        where: { reference_id: itemData.fulfillment_id, store: { id: store.id } }
      });
      
      if (fulfillment) {
        item.fulfillment = fulfillment;
        this.logger.log(`Linked item ${item.reference_id} to fulfillment ${fulfillment.reference_id}`);
      } else {
        this.logger.warn(`Fulfillment ${itemData.fulfillment_id} not found for item ${item.reference_id}`);
      }
    }

    // Save the updated item with location/fulfillment links
    if (item.location || item.fulfillment) {
      await queryRunner.manager.save(Item, item);
    }
  }

  /**
   * Process item customization groups
   * This method creates the relationship between main items and customization groups
   * Based on the actual ONDC data structure where customization groups are separate categories
   */
  private async processItemCustomizationGroups(itemData: ONDCItem, item: Item, store: Store, queryRunner: any): Promise<void> {
    // Delete existing customization groups for this item
    await queryRunner.manager.delete(ItemCustomizationGroups, { item: { id: item.id } });

    // Only process for main items (type='item'), not customization items
    if (item.type !== 'item') {
      return;
    }

    // ✅ CORRECT APPROACH: Find customization groups that should be linked to this specific item
    // Based on the ONDC data structure, we need to determine which customization groups
    // are relevant for this main item based on business logic or item attributes
    
    // For now, let's link customization groups based on item categories or other criteria
    // This can be made more specific based on your business requirements
    
    // Get all customization groups for this store
    const customizationGroups = await queryRunner.manager.find(Category, {
      where: { 
        store: { id: store.id }, 
        type: 'custom_group',
        status: true 
      }
    });

    if (customizationGroups.length === 0) {
      this.logger.log(`No customization groups found for store ${store.reference_id}`);
      return;
    }

    // ✅ BUSINESS LOGIC: Determine which customization groups should be linked to this item
    // For now, we'll link based on item category or other criteria
    // You can modify this logic based on your specific requirements
    
    const relevantCustomizationGroups = this.filterRelevantCustomizationGroups(
      item, 
      customizationGroups, 
      itemData
    );

    if (relevantCustomizationGroups.length === 0) {
      this.logger.log(`No relevant customization groups found for item ${item.reference_id}`);
      return;
    }

    let sequence = 1;
    for (const customizationGroup of relevantCustomizationGroups) {
      // Get configuration from the customization group's tags
      const config = await this.extractCustomizationGroupConfig(customizationGroup, queryRunner);
      
      const itemCustomizationGroup = new ItemCustomizationGroups();
      itemCustomizationGroup.item = item;
      itemCustomizationGroup.customization_group = customizationGroup;
      itemCustomizationGroup.min_selections = config.min_selections;
      itemCustomizationGroup.max_selections = config.max_selections;
      itemCustomizationGroup.is_mandatory = config.is_mandatory;
      itemCustomizationGroup.sequence = sequence++;

      await queryRunner.manager.save(ItemCustomizationGroups, itemCustomizationGroup);
      this.logger.log(`✅ Linked main item ${item.reference_id} to customization group ${customizationGroup.reference_id} (${customizationGroup.name})`);
    }
  }

  /**
   * Filter customization groups that are relevant for a specific item
   * This is where you can implement your business logic
   */
  private filterRelevantCustomizationGroups(
    item: Item, 
    customizationGroups: Category[], 
    itemData: ONDCItem
  ): Category[] {
    // ✅ BUSINESS LOGIC: Implement your specific rules here
    // For now, let's implement a simple rule based on item name patterns
    
    const relevantGroups: Category[] = [];
    
    for (const group of customizationGroups) {
      // Example business logic: Link based on item name patterns
      if (this.shouldLinkCustomizationGroup(item, group, itemData)) {
        relevantGroups.push(group);
      }
    }
    
    return relevantGroups;
  }

  /**
   * Determine if a customization group should be linked to an item
   * This is where you implement your specific business logic
   */
  private shouldLinkCustomizationGroup(
    item: Item, 
    customizationGroup: Category, 
    itemData: ONDCItem
  ): boolean {
    // Based on the actual data provided, link specific items to specific groups
    const itemName = item.name.toLowerCase();
    const groupName = customizationGroup.name.toLowerCase();
    
    // Mutton Noodles (21673) → Fish Special
    if (item.reference_id === '21673' && groupName.includes('fish special')) {
      return true;
    }
    
    // Mutton Chilli Chicken (21674) → Fish addons
    if (item.reference_id === '21674' && groupName.includes('fish addons')) {
      return true;
    }
    
    // Mutton Fry with Fish (21675) → Fish Special
    if (item.reference_id === '21675' && groupName.includes('fish special')) {
      return true;
    }
    
    // Fish Mutton Biriyani (21676) → Biriyani Special
    if (item.reference_id === '21676' && groupName.includes('biriyani special')) {
      return true;
    }
    
    // Fish Raita (21677) → Fish addons
    if (item.reference_id === '21677' && groupName.includes('fish addons')) {
      return true;
    }
    
    // Fish Soup (21680) → Soups
    if (item.reference_id === '21680' && groupName.includes('soups')) {
      return true;
    }
    
    // Chicken Soup (21681) → Soups
    if (item.reference_id === '21681' && groupName.includes('soups')) {
      return true;
    }
    
    return false;
  }

  /**
   * Extract configuration from customization group category
   */
  private async extractCustomizationGroupConfig(category: Category, queryRunner: any): Promise<{
    min_selections: number;
    max_selections: number;
    is_mandatory: boolean;
  }> {
    // Default values
    let min_selections = 0;
    let max_selections = 1;
    let is_mandatory = false;

    // Load category configs from database
    const categoryConfigs = await queryRunner.manager.find(CategoryConfigs, {
      where: { category: { id: category.id } }
    });

    if (categoryConfigs.length > 0) {
      const config = categoryConfigs[0];
      min_selections = config.min_selections || 0;
      max_selections = config.max_selections || 1;
      is_mandatory = config.is_mandatory || false;
    }

    return {
      min_selections,
      max_selections,
      is_mandatory
    };
  }

  /**
   * Process customization relationships for customization items
   * This method creates the relationship between customization items and their parent customization groups
   */
  private async processCustomizationRelationships(itemData: ONDCItem, item: Item, store: Store, queryRunner: any): Promise<void> {
    // Only process if this is a customization item
    if (item.type !== 'customization') {
      return;
    }

    // Delete existing relationships for this customization
    await queryRunner.manager.delete(CustomizationRelationships, { parent_customization: { id: item.id } });

    if (!itemData.tags || !Array.isArray(itemData.tags)) {
      this.logger.warn(`No tags found for customization item ${itemData.id}`);
      return;
    }

    // ✅ CORRECT ONDC APPROACH: Find parent tag to get parent customization group ID
    const parentTag = itemData.tags.find(tag => tag.code === 'parent');
    if (!parentTag || !Array.isArray(parentTag.list)) {
      this.logger.warn(`No parent tag found for customization item ${itemData.id}`);
      return;
    }

    // Extract parent ID and default status from parent tag
    const parentIdItem = parentTag.list.find(item => item.code === 'id');
    const defaultItem = parentTag.list.find(item => item.code === 'default');
    
    if (!parentIdItem?.value) {
      this.logger.warn(`No parent ID found in parent tag for customization item ${itemData.id}`);
      return;
    }

    const parentCategoryId = parentIdItem.value;
    const isDefault = defaultItem?.value === 'yes';

    // Find the parent customization group (Category with type='custom_group')
    const parentCategory = await queryRunner.manager.findOne(Category, {
      where: { reference_id: parentCategoryId, store: { id: store.id }, type: 'custom_group' }
    });

    if (!parentCategory) {
      this.logger.warn(`Parent customization group ${parentCategoryId} not found for item ${itemData.id}`);
      return;
    }

    // ✅ Create the customization relationship
    const relationship = new CustomizationRelationships();
    relationship.parent_customization = item; // The customization item
    relationship.child_customization_group = parentCategory; // The customization group it belongs to
    relationship.is_default = isDefault; // Whether this is the default selection

    await queryRunner.manager.save(CustomizationRelationships, relationship);
    this.logger.log(`✅ Created customization relationship: ${item.reference_id} -> ${parentCategory.reference_id} (default: ${isDefault})`);
  }

  /**
   * Process item variants using ONDC parent_item_id approach
   */
  private async processItemVariants(itemData: ONDCItem, item: Item, store: Store, queryRunner: any): Promise<void> {
    // Delete existing item variants
    await queryRunner.manager.delete(ItemVariants, { item: { id: item.id } });

    // Check if this item has a parent_item_id (meaning it's a variant)
    if (!itemData.parent_item_id) {
      return; // Not a variant item
    }

    // Find the variant group (which is stored as a Category with type='variant_group')
    const variantGroup = await queryRunner.manager.findOne(Category, {
      where: { reference_id: itemData.parent_item_id, store: { id: store.id }, type: 'variant_group' }
    });

    if (!variantGroup) {
      this.logger.warn(`Variant group ${itemData.parent_item_id} not found for item ${itemData.id}`);
      return;
    }

    // Create VariantGroups entity from the Category
    let variantGroupEntity = await queryRunner.manager.findOne(VariantGroups, {
      where: { reference_id: itemData.parent_item_id, store: { id: store.id } }
    });

    if (!variantGroupEntity) {
      variantGroupEntity = new VariantGroups();
      variantGroupEntity.reference_id = itemData.parent_item_id;
      variantGroupEntity.store = store;
      variantGroupEntity.name = variantGroup.name;
      variantGroupEntity.description = variantGroup.description || `Variant group for ${variantGroup.name}`;
      
      variantGroupEntity = await queryRunner.manager.save(VariantGroups, variantGroupEntity);
      this.logger.log(`Created variant group entity: ${variantGroupEntity.reference_id}`);
    }

    // Create item variant relationship
    const itemVariant = new ItemVariants();
    itemVariant.item = item;
    itemVariant.variant_group = variantGroupEntity;
    itemVariant.is_default = false; // Could be enhanced to detect default variant

    await queryRunner.manager.save(ItemVariants, itemVariant);
    this.logger.log(`Linked variant item ${item.reference_id} to variant group ${variantGroupEntity.reference_id}`);
    
    // Log the variant details for debugging
    if (itemData.quantity?.unitized?.measure) {
      this.logger.log(`Variant details - ${item.name}: ${itemData.quantity.unitized.measure.value} ${itemData.quantity.unitized.measure.unit}`);
    }
  }

  /**
   * Link customization items to their appropriate categories
   * This method links customization items to categories based on business logic
   */
  private async linkCustomizationItemsToCategories(store: Store, queryRunner: any): Promise<void> {
    this.logger.log(`Linking customization items to categories for store ${store.reference_id}`);

    // Get all customization items for this store
    const customizationItems = await queryRunner.manager.find(Item, {
      where: { 
        store: { id: store.id }, 
        type: 'customization',
        status: true 
      }
    });

    for (const customizationItem of customizationItems) {
      // Determine which category this customization item belongs to based on name patterns
      let categoryId = null;
      
      if (customizationItem.name.toLowerCase().includes('fish') && customizationItem.name.toLowerCase().includes('raita')) {
        // Fish Raita items should go to Fish Special group
        const category = await queryRunner.manager.findOne(Category, {
          where: { 
            store: { id: store.id }, 
            name: 'Fish Special',
            type: 'custom_group'
          }
        });
        categoryId = category?.id;
      } else if (customizationItem.name.toLowerCase().includes('mutton') && customizationItem.name.toLowerCase().includes('fish')) {
        // Mutton Fry with Fish should go to Biriyani Special group
        const category = await queryRunner.manager.findOne(Category, {
          where: { 
            store: { id: store.id }, 
            name: 'Biriyani Special',
            type: 'custom_group'
          }
        });
        categoryId = category?.id;
      } else if (customizationItem.name.toLowerCase().includes('chicken') && customizationItem.name.toLowerCase().includes('soup')) {
        // Chicken Soup should go to Soups group
        const category = await queryRunner.manager.findOne(Category, {
          where: { 
            store: { id: store.id }, 
            name: 'Soups',
            type: 'custom_group'
          }
        });
        categoryId = category?.id;
      } else if (customizationItem.name.toLowerCase().includes('fish') && customizationItem.name.toLowerCase().includes('soup')) {
        // Fish Soup should go to Soups group
        const category = await queryRunner.manager.findOne(Category, {
          where: { 
            store: { id: store.id }, 
            name: 'Soups',
            type: 'custom_group'
          }
        });
        categoryId = category?.id;
      }

      if (categoryId) {
        // Check if relationship already exists
        const existingRelation = await queryRunner.manager.findOne(ItemCategories, {
          where: { 
            item: { id: customizationItem.id },
            category: { id: categoryId }
          }
        });

        if (!existingRelation) {
          // Create item_categories relationship
          const itemCategory = new ItemCategories();
          itemCategory.item = customizationItem;
          itemCategory.category = { id: categoryId } as any;
          itemCategory.is_default = false;
          
          await queryRunner.manager.save(ItemCategories, itemCategory);
          this.logger.log(`✅ Linked customization item ${customizationItem.reference_id} to category ${categoryId}`);
        }
      } else {
        this.logger.warn(`⚠️ No category found for customization item ${customizationItem.reference_id} (${customizationItem.name})`);
      }
    }
  }

  /**
   * Post-process customization parent_item relationships
   * This runs after all items are processed to link customization items to their parent main items
   */
  private async postProcessCustomizationParentItems(provider: Provider, store: Store, queryRunner: any): Promise<void> {
    if (!provider.items) {
      return;
    }

    this.logger.log(`Post-processing customization parent_item relationships for store ${store.reference_id}`);

    // Get all customization items for this store
    const customizationItems = await queryRunner.manager.find(Item, {
      where: { 
        store: { id: store.id }, 
        type: 'customization',
        status: true 
      },
      relations: ['customizationRelationships', 'customizationRelationships.child_customization_group']
    });

    for (const customizationItem of customizationItems) {
      // Find which customization group this item belongs to
      if (customizationItem.customizationRelationships && customizationItem.customizationRelationships.length > 0) {
        const relationship = customizationItem.customizationRelationships[0]; // Take the first one
        const customizationGroup = relationship.child_customization_group;

        // ✅ FIXED: Find the correct parent item based on the ONDC data structure
        // The customization item ID contains the parent item ID (e.g., "a-21673-342" -> parent is "21673")
        const parentItemId = this.extractParentItemIdFromCustomizationId(customizationItem.reference_id);
        
        if (parentItemId) {
          // Find the parent item by reference_id
          const parentItem = await queryRunner.manager.findOne(Item, {
            where: { 
              reference_id: parentItemId, 
              store: { id: store.id },
              type: 'item',
              status: true 
            }
          });

          if (parentItem) {
            // Set the parent_item relationship (TypeORM will handle the foreign key automatically)
            customizationItem.parent_item = parentItem;
            await queryRunner.manager.save(Item, customizationItem);
            
            this.logger.log(`✅ Linked customization item ${customizationItem.reference_id} to parent item ${parentItem.reference_id} (ID: ${parentItem.id})`);
          } else {
            this.logger.warn(`Parent item ${parentItemId} not found for customization item ${customizationItem.reference_id}`);
          }
        } else {
          this.logger.warn(`Could not extract parent item ID from customization item ${customizationItem.reference_id}`);
        }
      }
    }

    this.logger.log(`Completed post-processing customization parent_item relationships for store ${store.reference_id}`);
  }

  /**
   * Extract parent item ID from customization item ID
   * Examples: "a-21673-342" -> "21673", "a-21674-343" -> "21674"
   */
  private extractParentItemIdFromCustomizationId(customizationId: string): string | null {
    // Pattern: "a-{parentId}-{suffix}"
    const match = customizationId.match(/^a-(\d+)-/);
    return match ? match[1] : null;
  }

  /**
   * Helper method to format attribute names
   */
  private formatAttributeName(code: string): string {
    return code
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
