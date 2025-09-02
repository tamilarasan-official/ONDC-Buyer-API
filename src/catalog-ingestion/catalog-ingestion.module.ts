import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogIngestionService } from './catalog-ingestion.service';

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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Store entities
      Store,
      StoreLocation,
      StoreFulfillment,
      StoreTimings,
      StoreConfigs,
      StoreCloseTimings,
      // Category entities
      Category,
      CategoryTimings,
      CategoryConfigs,
      // Item entities
      Item,
      ItemCategories,
      ItemTimings,
      ItemAttributes,
      ItemBarcodes,
      ItemPrices,
      ItemQuantities,
      ItemCustomizationGroups,
      CustomizationRelationships,
      // Variant entities
      VariantGroups,
      ItemVariants,
      // Offer entities
      Offers,
      OfferLocations,
      OfferItems,
      OfferQualifiers,
      OfferBenefits,
    ]),
  ],
  providers: [CatalogIngestionService],
  exports: [CatalogIngestionService],
})
export class CatalogIngestionModule {}
