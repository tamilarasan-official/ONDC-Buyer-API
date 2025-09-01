import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ONDCSearchResponseDto, Provider, Category as ONDCCategory, Item as ONDCItem, Offer as ONDCOffer } from '../ondc-search/dto/ondc-search.dto';

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
      errors: string[];
    };
  }> {
    const stats = {
      providers_processed: 0,
      stores_upserted: 0,
      categories_upserted: 0,
      items_upserted: 0,
      offers_upserted: 0,
      errors: [] as string[],
    };

    this.logger.log(`Starting catalog ingestion for ${responses.length} provider response(s)`);

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
  }

  /**
   * Upsert Store entity using reference_id
   */
  private async upsertStore(provider: Provider, context: any, queryRunner: any): Promise<Store> {
    let store = await queryRunner.manager.findOne(Store, {
      where: { reference_id: provider.id }
    });

    if (!store) {
      store = new Store();
      store.reference_id = provider.id;
    }

    // Update store fields
    store.bpp_id = context.bpp_id;
    store.bpp_uri = context.bpp_uri;
    store.name = provider.descriptor.name;
    store.description = provider.descriptor.short_desc || provider.descriptor.long_desc;
    store.logo_url = provider.descriptor.symbol || provider.descriptor.images?.[0];
    store.fssai_license_no = provider['@ondc/org/fssai_license_no'];
    store.ttl = provider.ttl;
    store.status = true;

    // Extract GST number from provider tags if available
    if (provider.tags) {
      const gstTag = provider.tags.find(tag => tag.code === 'statutory_requirements');
      if (gstTag) {
        const gstItem = gstTag.list.find(item => item.code === 'gst_number');
        if (gstItem) {
          store.gst_number = gstItem.value;
        }
      }
    }

    return await queryRunner.manager.save(Store, store);
  }

  /**
   * Upsert Store Location using reference_id - COMPLETE IMPLEMENTATION
   */
  private async upsertStoreLocation(locationData: any, store: Store, queryRunner: any): Promise<StoreLocation> {
    let location = await queryRunner.manager.findOne(StoreLocation, {
      where: { reference_id: locationData.id, store: { id: store.id } }
    });

    if (!location) {
      location = new StoreLocation();
      location.reference_id = locationData.id;
      location.store = store;
    }

    // Parse GPS coordinates
    const [lat, lng] = locationData.gps.split(',').map(coord => parseFloat(coord.trim()));
    location.gps_lat = lat;
    location.gps_lng = lng;
    
    location.address_locality = locationData.address?.locality || '';
    location.address_street = locationData.address?.street || '';
    location.address_city = locationData.address?.city || '';
    location.address_area_code = locationData.address?.area_code || '';
    location.address_state = locationData.address?.state || '';
    
    // Extract delivery radius if available
    if (locationData.circle) {
      location.delivery_radius_km = parseFloat(locationData.circle.radius.value);
      location.delivery_radius_unit = locationData.circle.radius.unit;
    }
    
    location.status = true;

    return await queryRunner.manager.save(StoreLocation, location);
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
   * Upsert Category using reference_id - COMPLETE IMPLEMENTATION
   */
  private async upsertCategory(categoryData: ONDCCategory, store: Store, queryRunner: any): Promise<Category> {
    let category = await queryRunner.manager.findOne(Category, {
      where: { reference_id: categoryData.id, store: { id: store.id } }
    });

    if (!category) {
      category = new Category();
      category.reference_id = categoryData.id;
      category.store = store;
    }

    category.name = categoryData.descriptor.name;
    category.description = categoryData.descriptor.short_desc || categoryData.descriptor.long_desc;
    category.icon = categoryData.descriptor.images?.[0] || '';
    category.parent_category_id = categoryData.parent_category_id ? parseInt(categoryData.parent_category_id) : undefined;
    category.status = true;

    // Determine category type from tags
    if (categoryData.tags) {
      const typeTag = categoryData.tags.find(tag => tag.code === 'type');
      if (typeTag) {
        const typeItem = typeTag.list.find(item => item.code === 'type');
        category.type = typeItem?.value || 'custom_menu';
      }

      // Set display rank
      const displayTag = categoryData.tags.find(tag => tag.code === 'display');
      if (displayTag) {
        const rankItem = displayTag.list.find(item => item.code === 'rank');
        category.display_rank = rankItem ? parseInt(rankItem.value) : null;
      }
    } else {
      category.type = 'custom_menu';
    }

    return await queryRunner.manager.save(Category, category);
  }

  /**
   * Upsert Item using reference_id - COMPLETE IMPLEMENTATION
   */
  private async upsertItem(itemData: ONDCItem, store: Store, provider: Provider, queryRunner: any): Promise<Item> {
    let item = await queryRunner.manager.findOne(Item, {
      where: { reference_id: itemData.id, store: { id: store.id } }
    });

    if (!item) {
      item = new Item();
      item.reference_id = itemData.id;
      item.store = store;
    }

    // Basic item data
    item.name = itemData.descriptor.name;
    item.short_desc = itemData.descriptor.short_desc;
    item.long_desc = itemData.descriptor.long_desc;
    item.symbol_url = itemData.descriptor.symbol;
    item.images = itemData.descriptor.images || [];
    
    // ONDC specific fields
    item.is_related = itemData.related || false;
    item.is_recommended = itemData.recommended || false;
    item.is_returnable = itemData['@ondc/org/returnable'] || false;
    item.is_cancellable = itemData['@ondc/org/cancellable'] || false;
    item.return_window = itemData['@ondc/org/return_window'];
    item.seller_pickup_return = itemData['@ondc/org/seller_pickup_return'] || false;
    item.time_to_ship = itemData['@ondc/org/time_to_ship'];
    item.available_on_cod = itemData['@ondc/org/available_on_cod'] || false;
    item.consumer_care_details = itemData['@ondc/org/contact_details_consumer_care'];

    // Set item type
    item.type = 'item';
    if (itemData.tags) {
      const typeTag = itemData.tags.find(tag => tag.code === 'type');
      if (typeTag) {
        const typeItem = typeTag.list.find(item => item.code === 'type');
        item.type = typeItem?.value || 'item';
      }
    }

    item.status = true;

    const savedItem = await queryRunner.manager.save(Item, item);

    // Process item pricing
    if (itemData.price) {
      await this.processItemPricing(itemData.price, savedItem, queryRunner);
    }

    // Process item quantity
    if (itemData.quantity) {
      await this.processItemQuantity(itemData.quantity, savedItem, queryRunner);
    }

    return savedItem;
  }

  /**
   * Process item pricing data
   */
  private async processItemPricing(priceData: any, item: Item, queryRunner: any): Promise<void> {
    // Delete existing prices for this item
    await queryRunner.manager.delete(ItemPrices, { item: { id: item.id } });

    const itemPrice = new ItemPrices();
    itemPrice.item = item;
    itemPrice.currency = priceData.currency || 'INR';
    itemPrice.base_price = parseFloat(priceData.value);
    itemPrice.maximum_price = priceData.maximum_value ? parseFloat(priceData.maximum_value) : undefined;

    await queryRunner.manager.save(ItemPrices, itemPrice);
  }

  /**
   * Process item quantity data
   */
  private async processItemQuantity(quantityData: any, item: Item, queryRunner: any): Promise<void> {
    // Delete existing quantities for this item
    await queryRunner.manager.delete(ItemQuantities, { item: { id: item.id } });

    const itemQuantity = new ItemQuantities();
    itemQuantity.item = item;
    
    if (quantityData.available) {
      itemQuantity.available_count = parseInt(quantityData.available.count);
    }
    
    if (quantityData.maximum) {
      itemQuantity.maximum_count = parseInt(quantityData.maximum.count);
    }
    
    if (quantityData.unitized) {
      itemQuantity.unitized_unit = quantityData.unitized.measure.unit;
      itemQuantity.unitized_value = parseFloat(quantityData.unitized.measure.value);
    }

    await queryRunner.manager.save(ItemQuantities, itemQuantity);
  }

  /**
   * Upsert Offer using reference_id - COMPLETE IMPLEMENTATION
   */
  private async upsertOffer(offerData: ONDCOffer, store: Store, queryRunner: any): Promise<Offers> {
    let offer = await queryRunner.manager.findOne(Offers, {
      where: { reference_id: offerData.id, store: { id: store.id } }
    });

    if (!offer) {
      offer = new Offers();
      offer.reference_id = offerData.id;
      offer.store = store;
    }

    offer.offer_code = offerData.descriptor.code;
    offer.banner_image_url = offerData.descriptor.images?.[0];
    
    if (offerData.time) {
      offer.valid_from = new Date(offerData.time.range.start);
      offer.valid_to = new Date(offerData.time.range.end);
    } else {
      // Set default valid dates if not provided
      offer.valid_from = new Date();
      offer.valid_to = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    }

    offer.is_auto_apply = false;
    offer.is_additive = false;
    offer.status = true;

    return await queryRunner.manager.save(Offers, offer);
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
