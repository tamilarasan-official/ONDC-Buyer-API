import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { BuyerController } from './buyer.controller';
import { BuyerService } from './buyer.service';
import { CartService } from './cart.service';
import { OrderService } from './order.service';
import { RazorpayService } from './razorpay.service';
import { NotificationService } from './notification.service';
import { ReviewService } from './review.service';
import { SellerPushService } from './seller-push.service';
import { SellerStatusService } from '../shared/services/seller-status.service';
import { LocationService } from '../shared/services/location.service';
import { FCMService } from './fcm.service';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { SharedNotificationModule } from '../shared/notification.module';

// Import entities
import { Store } from '../store/entities/store.entity';
import { StoreLocation } from '../store/entities/store-location.entity';
import { StoreTimings } from '../store/entities/store-timings.entity';
import { StoreConfigs } from '../store/entities/store-configs.entity';
import { Category } from '../category/entities/category.entity';
import { Item } from '../item/entities/item.entity';
import { ItemPrices } from '../item/entities/item-prices.entity';
import { ItemQuantities } from '../item/entities/item-quantities.entity';
import { ItemAttributes } from '../item/entities/item-attributes.entity';
import { ItemCustomizationGroups } from '../item/entities/item-customization-groups.entity';
import { CustomizationRelationships } from '../item/entities/customization-relationships.entity';
import { VariantGroups } from '../variant/entities/variant-groups.entity';
import { ItemVariants } from '../variant/entities/item-variants.entity';
import { Offers } from '../offer/entities/offers.entity';
import { User } from '../user/entities/user.entity';
import { UserAddress } from '../user/entities/user-address.entity';
import { Cart } from '../cart/entities/cart.entity';
import { CartItem } from '../cart/entities/cart-item.entity';
import { Order } from '../order/entities/order.entity';
import { OrderItem } from '../order/entities/order-item.entity';
import { OrderTracking } from '../order/entities/order-tracking.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Notification } from '../notification/entities/notification.entity';
import { RestaurantReview } from '../review/entities/restaurant-review.entity';
import { ItemReview } from '../review/entities/item-review.entity';
import { UserDeviceToken } from '../user/entities/user-device-token.entity';
import { Dish } from '../dish/entities/dish.entity';
import { UserFavoriteRestaurant } from '../favorites/entities/user-favorite-restaurant.entity';
import { UserFavoriteItem } from '../favorites/entities/user-favorite-item.entity';
import { Banner } from '../banner/entities/banner.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Store,
      StoreLocation,
      StoreTimings,
      StoreConfigs,
      Category,
      Item,
      ItemPrices,
      ItemQuantities,
      ItemAttributes,
      ItemCustomizationGroups,
      CustomizationRelationships,
      VariantGroups,
      ItemVariants,
      Offers,
      User,
      UserAddress,
      Cart,
      CartItem,
      Order,
      OrderItem,
      OrderTracking,
      Payment,
      Notification,
      RestaurantReview,
      ItemReview,
      UserDeviceToken,
      Dish,
      UserFavoriteRestaurant,
      UserFavoriteItem,
      Banner,
    ]),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    SharedNotificationModule,
  ],
  controllers: [BuyerController, InvoiceController],
  providers: [BuyerService, CartService, OrderService, RazorpayService, NotificationService, ReviewService, SellerPushService, SellerStatusService, LocationService, FCMService, InvoiceService],
  exports: [BuyerService, CartService, OrderService, RazorpayService, NotificationService, ReviewService, SellerPushService, SellerStatusService, LocationService, FCMService, InvoiceService],
})
export class BuyerModule {}
