import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  UseGuards,
  Req,
  Param,
  Body,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  Res,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from "@nestjs/swagger";
import { BuyerService } from "./buyer.service";
import { JwtAuthGuard } from "../authentication/jwt-auth.guard";
import { GuestOrUserAuthGuard } from "../authentication/guest-or-user-auth.guard";
import { HomeResponseDto } from "./dto/home-response.dto";
import { DietaryPreference } from "../shared/enums/dietary-preference.enum";
import { VegMode } from "../shared/enums/veg-mode.enum";
import {
  SearchRequestDto,
  SearchSuggestionsRequestDto,
} from "./dto/search-request.dto";
import {
  SearchResponseDto,
  SearchSuggestionsResponseDto,
} from "./dto/search-response.dto";
import { RestaurantDetailsResponseDto } from "./dto/restaurant-details.dto";
import { MenuRequestDto } from "./dto/menu-request.dto";
import { MenuResponseDto } from "./dto/menu-response.dto";
import {
  AddToCartDto,
  UpdateCartItemDto,
  RemoveFromCartDto,
  ApplyOfferDto,
  UpdateTipDto,
} from "./dto/cart-request.dto";
import { ApplyCouponDto } from "./dto/apply-coupon.dto";
import { RemoveCouponDto } from "./dto/apply-coupon.dto";
import { TestNotificationDto } from "./dto/test-notification.dto";
import { RegisterDeviceTokenDto, BroadcastNotificationDto } from "./dto/notification-request.dto";
import {
  CartResponseDto,
  AddToCartResponseDto,
  UpdateCartResponseDto,
  RemoveFromCartResponseDto,
  ApplyOfferResponseDto,
} from "./dto/cart-response.dto";
import {
  CreateOrderDto,
  CreatePaymentDto,
  VerifyPaymentDto,
  UpdateOrderStatusDto,
} from "./dto/order-request.dto";
import {
  CreateOrderResponseDto,
  OrderResponseDto,
  OrderListResponseDto,
  PaymentResponseDto,
  VerifyPaymentResponseDto,
} from "./dto/order-response.dto";
import { SellerStatusUpdateDto } from "./dto/seller-status-update.dto";
import {
  StoreStatusUpdateDto,
  StoreStatusUpdateItemDto,
} from "../store/dto/store-status-update.dto";
import {
  StoreCloseTimingDto,
  StoreCloseTimingItemDto,
} from "../store/dto/store-close-timing.dto";
import { CartService } from "./cart.service";
import { OrderService } from "./order.service";
import { NotificationService } from "./notification.service";
import { ReviewService } from "./review.service";
import { RazorpayService } from "./razorpay.service";
import { StoreService } from "../store/store.service";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { WebhookEvent } from "../payment/entities/webhook-event.entity";
import { OrderCancelDto } from "./dto/cancel-order.dto";
import { AppSettings } from "../shared/entities/app-settings.entity";
import { UserDeviceToken } from "../user/entities/user-device-token.entity";
import { CollectionService } from "../collection/collection.service";
import { PaginationDto } from "../shared/dto/pagination.dto";

@ApiTags("Buyer App APIs")
@Controller("api/buyer")
export class BuyerController {
  private readonly logger = new Logger(BuyerController.name);
  constructor(
    private readonly buyerService: BuyerService,
    private readonly cartService: CartService,
    private readonly orderService: OrderService,
    private readonly notificationService: NotificationService,
    private readonly reviewService: ReviewService,
    private readonly razorpayService: RazorpayService,
    private readonly storeService: StoreService,
    private readonly collectionService: CollectionService,
    @InjectRepository(WebhookEvent)
    private readonly webhookEventRepository: Repository<WebhookEvent>,
    @InjectRepository(AppSettings)
    private readonly appSettingsRepository: Repository<AppSettings>,
    @InjectRepository(UserDeviceToken)
    private readonly userDeviceTokenRepository: Repository<UserDeviceToken>,
  ) { }

  @Get("collections")
  @UseGuards(GuestOrUserAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get active collections for buyer",
    description: "Returns active collections configured in buyer config.",
  })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  getCollections(@Query() paginationDto: PaginationDto) {
    return this.collectionService.findActiveCollections(paginationDto);
  }

  @Get("collections/:id/items")
  @UseGuards(GuestOrUserAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get items for an active collection",
    description: "Returns collection items resolved by stored filters.",
  })
  @ApiQuery({ name: "lat", required: false, type: Number, example: 9.9252 })
  @ApiQuery({ name: "lng", required: false, type: Number, example: 78.1198 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1 })
  getCollectionItems(
    @Param("id") id: string,
    @Query() paginationDto: PaginationDto,
    @Query("lat") lat?: string,
    @Query("lng") lng?: string,
    @Query("limit") limit?: string,
  ) {
    return this.collectionService.previewActiveItems(+id, paginationDto, {
      ...(lat !== undefined ? { user_lat: Number(lat) } : {}),
      ...(lng !== undefined ? { user_lng: Number(lng) } : {}),
      ...(limit !== undefined ? { limit: Number(limit) } : {}),
    });
  }

  @Get("home")
  @UseGuards(GuestOrUserAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get home page data",
    description:
      'Retrieve home page data including nearby restaurants, "What\'s On Your Mind?" dishes, promotional banners (dynamically fetched from banner management system - returns all active banners ordered by sequence), and app operation hours status. Uses location-based filtering with Haversine formula for distance calculation. Supports pagination for restaurants. App operation status indicates if ordering is currently available. Supports both user and guest JWTs.',
  })
  @ApiQuery({
    name: "lat",
    required: false,
    type: String,
    description: "Device latitude for location-based filtering",
    example: "9.9352300",
  })
  @ApiQuery({
    name: "lng",
    required: false,
    type: String,
    description: "Device longitude for location-based filtering",
    example: "78.1304040",
  })
  @ApiQuery({
    name: "veg_mode",
    required: false,
    type: String,
    description:
      "Vegetarian filter mode: 'all' (show all restaurants with only veg products) or 'pure' (show only pure-veg restaurants). If not provided or false, shows all restaurants.",
    enum: VegMode,
    enumName: "VegMode",
    example: "all",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number for pagination (default: 1)",
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Number of restaurants per page (default: 10)",
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: "Home page data retrieved successfully",
    type: HomeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid parameters",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: {
          type: "string",
          example: "Invalid latitude or longitude values",
        },
        error: { type: "string", example: "BAD_REQUEST" },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - JWT token required",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Unauthorized" },
        error: { type: "string", example: "UNAUTHORIZED" },
      },
    },
  })
  @ApiResponse({
    status: 426,
    description: "Upgrade Required - App version is outdated and needs to be updated",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Please update your app to the latest version from the Play Store to continue using Tazty." },
        error: { type: "string", example: "FORCE_UPDATE_REQUIRED" },
        data: {
          type: "object",
          properties: {
            current_version: { type: "number", example: 1 },
            minimum_required_version: { type: "number", example: 2 },
            play_store_url: { type: "string", example: "https://play.google.com/store/apps/details?id=com.tazty.buyer" },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: "Internal server error",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Internal server error" },
        error: { type: "string", example: "INTERNAL_SERVER_ERROR" },
      },
    },
  })
  async getHomeData(
    @Query("lat") deviceLat?: string,
    @Query("lng") deviceLng?: string,
    @Query("veg_mode") vegMode?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Req() req?: any,
  ) {
    const userId = req?.user?.id;

    // Check if force update is required for Android users
    if (userId) {
      const userDeviceToken = await this.userDeviceTokenRepository.findOne({
        where: { userId, platform: 'android', is_active: true },
        order: { updated_at: 'DESC' },
      });

      if (userDeviceToken && userDeviceToken.version_code) {
        const minVersionSetting = await this.appSettingsRepository.findOne({
          where: { key: 'BUYER_APP_ANDROID_MINIMAL_FORCE_UPDATE_VERSION_CODE', is_active: true },
        });

        if (minVersionSetting) {
          const minRequiredVersion = parseInt(minVersionSetting.value);
          
          if (userDeviceToken.version_code < minRequiredVersion) {
            throw new HttpException({
              success: false,
              message: 'Please update your app to the latest version from the Play Store to continue using Tazty.',
              error: 'FORCE_UPDATE_REQUIRED',
              data: {
                current_version: userDeviceToken.version_code,
                minimum_required_version: minRequiredVersion,
                play_store_url: 'https://play.google.com/store/apps/details?id=in.tazty.buyer',
              },
            }, 426);
          }
        }
      }
    }

    const lat = deviceLat ? parseFloat(deviceLat) : undefined;
    const lng = deviceLng ? parseFloat(deviceLng) : undefined;
    // Parse veg_mode: accept enum values or "false" for disabled
    const vegModeValue =
      vegMode && vegMode !== "false" ? (vegMode as VegMode) : undefined;
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;

    return this.buyerService.getHomeData(
      userId,
      lat,
      lng,
      vegModeValue,
      pageNum,
      limitNum,
    );
  }

  @Get("search")
  @UseGuards(GuestOrUserAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Search restaurants, items, and categories",
    description:
      "Comprehensive search functionality with location-based filtering. Search across restaurants, food items, and categories with advanced filtering options including distance, rating, price, and category filters. Items include preorder campaign info if available. Response includes app operation hours status. Supports both user and guest JWTs.",
  })
  @ApiResponse({
    status: 200,
    description: "Search completed successfully",
    type: SearchResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid search parameters",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Invalid search parameters" },
        error: { type: "string", example: "BAD_REQUEST" },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: "Internal server error",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Internal server error" },
        error: { type: "string", example: "INTERNAL_SERVER_ERROR" },
      },
    },
  })
  async search(@Query() searchParams: SearchRequestDto, @Req() req?: any) {
    const userId = req?.user?.id;
    return this.buyerService.search(searchParams, userId);
  }

  @Post("search/suggestions")
  @UseGuards(GuestOrUserAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get search suggestions",
    description:
      "Get real-time search suggestions based on dishes, restaurants, and categories with advanced filtering. Returns suggestions prioritized by dishes (60%), restaurants (30%), and categories (10%). Supports both user and guest JWTs.",
  })
  @ApiBody({
    type: SearchSuggestionsRequestDto,
    description:
      "Search suggestions request payload with query, location, filters, and limit",
    examples: {
      basic: {
        summary: "Basic search suggestions",
        description: "Simple search with just a query string",
        value: {
          query: "burgl",
          limit: 10,
        },
      },
      advanced: {
        summary: "Advanced search with filters",
        description: "Search with location and dietary filters",
        value: {
          query: "pizza",
          location: {
            lat: 9.93523,
            lng: 78.130404,
          },
          filters: {
            dietary_preference: "veg",
            min_price: 100,
            max_price: 500,
            category_id: 1,
          },
          limit: 15,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Search suggestions retrieved successfully",
    type: SearchSuggestionsResponseDto,
    content: {
      "application/json": {
        example: {
          success: true,
          message: "Search suggestions retrieved successfully",
          data: {
            query: "burgl",
            suggestions: [
              {
                id: 1,
                name: "Burger",
                type: "dish",
                description: "Delicious burgers",
                icon: "https://example.com/burger-icon.jpg",
                image: "https://example.com/burger-image.jpg",
                restaurant_count: 15,
                item_count: 25,
              },
              {
                id: 2,
                name: "Burger Palace",
                type: "restaurant",
                description: "Best burgers in town",
                icon: "https://example.com/logo.jpg",
                image: "https://example.com/logo.jpg",
                restaurant_count: 1,
                item_count: 12,
              },
            ],
            total_suggestions: 2,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid query or parameters",
    content: {
      "application/json": {
        example: {
          success: false,
          message: "Query must be at least 2 characters",
          error: "BAD_REQUEST",
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: "Internal server error",
    content: {
      "application/json": {
        example: {
          success: false,
          message: "Internal server error",
          error: "INTERNAL_SERVER_ERROR",
        },
      },
    },
  })
  async getSearchSuggestions(
    @Body() request: SearchSuggestionsRequestDto,
    @Req() req: any,
  ) {
    if (!request.query || request.query.trim().length < 2) {
      throw new BadRequestException("Query must be at least 2 characters");
    }
    const userId = req?.user?.id;
    return this.buyerService.getSearchSuggestions(request, userId);
  }

  @Get("restaurants/:id")
  @UseGuards(GuestOrUserAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get restaurant details",
    description:
      "Get detailed information about a specific restaurant including menu with item availability timings, offers, restaurant operating hours, locations, and statistics. Each menu item includes timing windows showing when the item is available (e.g., breakfast items 6AM-11AM). Items include preorder campaign info if available. Response includes app operation hours status. Supports both user and guest JWTs.",
  })
  @ApiParam({
    name: "id",
    description: "Restaurant ID",
    example: 1,
    type: "number",
  })
  @ApiQuery({
    name: "lat",
    required: false,
    type: String,
    description: "Device latitude for distance calculation",
    example: "9.9352300",
  })
  @ApiQuery({
    name: "lng",
    required: false,
    type: String,
    description: "Device longitude for distance calculation",
    example: "78.1304040",
  })
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "Search term to filter items by name",
    example: "pizza",
  })
  @ApiQuery({
    name: "dietary_preference",
    required: false,
    type: String,
    description: "Dietary preference filter: veg, non-veg, egg",
    enum: DietaryPreference,
    enumName: "DietaryPreference",
    example: "veg",
  })
  @ApiQuery({
    name: "include_items",
    required: false,
    type: Boolean,
    description: "Include categorized items in response",
    example: true,
  })
  @ApiResponse({
    status: 200,
    description: "Restaurant details retrieved successfully",
    type: RestaurantDetailsResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Restaurant not found",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Restaurant not found" },
        error: { type: "string", example: "NOT_FOUND" },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: "Internal server error",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Internal server error" },
        error: { type: "string", example: "INTERNAL_SERVER_ERROR" },
      },
    },
  })
  async getRestaurantDetails(
    @Param("id") restaurantId: string,
    @Query("lat") deviceLat?: string,
    @Query("lng") deviceLng?: string,
    @Query("search") search?: string,
    @Query("dietary_preference") dietaryPreference?: string,
    @Query("include_items") includeItems?: string,
    @Req() req?: any,
  ) {
    const userId = req?.user?.id;
    const lat = deviceLat ? parseFloat(deviceLat) : undefined;
    const lng = deviceLng ? parseFloat(deviceLng) : undefined;
    const shouldIncludeItems = includeItems === "true";

    return this.buyerService.getRestaurantDetails(
      parseInt(restaurantId),
      userId,
      lat,
      lng,
      shouldIncludeItems,
      search,
      dietaryPreference,
    );
  }

  @Get("restaurants/:id/menu")
  @UseGuards(GuestOrUserAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get restaurant menu",
    description:
      "Get restaurant menu with categories, items, pricing, customizations, and variants. Supports filtering by category, price range, dietary preferences, and search. Items include preorder campaign info if available. Response includes app operation hours status. Supports both user and guest JWTs.",
  })
  @ApiParam({
    name: "id",
    description: "Restaurant ID",
    example: 1,
    type: "number",
  })
  @ApiResponse({
    status: 200,
    description: "Menu retrieved successfully",
    type: MenuResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Restaurant not found",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Restaurant not found" },
        error: { type: "string", example: "NOT_FOUND" },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: "Internal server error",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Internal server error" },
        error: { type: "string", example: "INTERNAL_SERVER_ERROR" },
      },
    },
  })
  async getRestaurantMenu(
    @Param("id") restaurantId: string,
    @Query() menuParams: MenuRequestDto,
    @Req() req?: any,
  ) {
    const userId = req?.user?.id;
    return this.buyerService.getRestaurantMenu(
      parseInt(restaurantId),
      menuParams,
      userId,
    );
  }

  @Get("items/:id/customizations")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get item customizations",
    description:
      'Get all available customization options for a specific main item. This endpoint is useful when user clicks "Add to Cart" to show customization options.',
  })
  @ApiParam({
    name: "id",
    description: "Main item ID",
    example: 1,
    type: "number",
  })
  @ApiResponse({
    status: 200,
    description: "Item customizations retrieved successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: {
          type: "string",
          example: "Item customizations retrieved successfully",
        },
        data: {
          type: "object",
          properties: {
            item_id: { type: "number", example: 1 },
            item_name: { type: "string", example: "Mutton Biriyani" },
            has_customizations: { type: "boolean", example: true },
            customizations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "number", example: 1 },
                  name: { type: "string", example: "Fish Special" },
                  description: {
                    type: "string",
                    example: "Choose your fish preparation",
                  },
                  min_selections: { type: "number", example: 0 },
                  max_selections: { type: "number", example: 1 },
                  input_type: { type: "string", example: "select" },
                  is_mandatory: { type: "boolean", example: false },
                  options: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "number", example: 1 },
                        name: { type: "string", example: "Fish Raita" },
                        price: { type: "number", example: 25 },
                        is_default: { type: "boolean", example: false },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Item not found",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Item not found" },
        error: { type: "string", example: "NOT_FOUND" },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Item is not a main item",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Item is not a main item" },
        error: { type: "string", example: "BAD_REQUEST" },
      },
    },
  })
  async getItemCustomizations(@Param("id") itemId: string) {
    return this.buyerService.getItemCustomizations(parseInt(itemId));
  }

  @Get("cart")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get user cart",
    description:
      "Retrieve the current user's active cart with all items, pricing, and summary. Includes preorder campaign info for preorder items.",
  })
  @ApiResponse({
    status: 200,
    description: "Cart retrieved successfully",
    type: CartResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - JWT token required",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Unauthorized" },
        error: { type: "string", example: "UNAUTHORIZED" },
      },
    },
  })
  async getCart(@Req() req: any) {
    const userId = req.user.id;
    return this.cartService.getCart(userId);
  }

  @Post("cart/add")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Add item to cart",
    description:
      "Add an item to the user's cart with quantity, customizations, and variants. Supports preorder items with is_preorder flag. Preorder items automatically apply coupon and have quantity=1 restriction. Note: Orders are not accepted when app operation hours are closed.",
  })
  @ApiBody({ type: AddToCartDto })
  @ApiResponse({
    status: 201,
    description: "Item added to cart successfully",
    type: AddToCartResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid item or insufficient quantity",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Insufficient quantity available" },
        error: { type: "string", example: "BAD_REQUEST" },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Item not found",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Item not found" },
        error: { type: "string", example: "NOT_FOUND" },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: "Service unavailable - App operation hours are closed",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        statusCode: { type: "number", example: 503 },
        message: {
          type: "string",
          example: "Restaurants not accepting orders right now. Ordering will be available again at 8 AM.",
        },
        timestamp: { type: "string", example: "2025-01-15T22:30:00.000Z" },
        path: { type: "string", example: "/api/buyer/cart/add" },
      },
    },
  })
  async addToCart(@Req() req: any, @Body() addToCartDto: AddToCartDto) {
    const userId = req.user.id;
    return this.cartService.addToCart(userId, addToCartDto);
  }

  @Put("cart/update")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Update cart item or reactivate cart",
    description:
      "Update quantity, customizations, or variants of an existing cart item. Note: Preorder items cannot have quantity changed (must be 1). Alternatively, reactivate a cart by providing cart_id and is_active=true (works with or without items).",
  })
  @ApiBody({ type: UpdateCartItemDto })
  @ApiResponse({
    status: 200,
    description: "Cart item updated successfully",
    type: UpdateCartResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Cart item not found",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Cart item not found" },
        error: { type: "string", example: "NOT_FOUND" },
      },
    },
  })
  async updateCartItem(
    @Req() req: any,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ) {
    const userId = req.user.id;
    return this.cartService.updateCartItem(userId, updateCartItemDto);
  }

  @Delete("cart/remove")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Remove item from cart",
    description: "Remove a specific item from the user's cart.",
  })
  @ApiBody({ type: RemoveFromCartDto })
  @ApiResponse({
    status: 200,
    description: "Item removed from cart successfully",
    type: RemoveFromCartResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Cart item not found",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Cart item not found" },
        error: { type: "string", example: "NOT_FOUND" },
      },
    },
  })
  async removeFromCart(
    @Req() req: any,
    @Body() removeFromCartDto: RemoveFromCartDto,
  ) {
    const userId = req.user.id;
    return this.cartService.removeFromCart(userId, removeFromCartDto);
  }

  @Delete("cart/clear")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Clear cart",
    description: "Remove all items from the user's cart.",
  })
  @ApiResponse({
    status: 200,
    description: "Cart cleared successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Cart cleared successfully" },
      },
    },
  })
  async clearCart(@Req() req: any) {
    const userId = req.user.id;
    return this.cartService.clearCart(userId);
  }

  @Post("cart/apply-offer")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Apply offer to cart",
    description:
      "Apply a discount offer to the user's cart using offer code or offer ID.",
  })
  @ApiBody({ type: ApplyOfferDto })
  @ApiResponse({
    status: 200,
    description: "Offer applied successfully",
    type: ApplyOfferResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Cart is empty or offer not applicable",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Cart is empty" },
        error: { type: "string", example: "BAD_REQUEST" },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Offer not found",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: {
          type: "string",
          example: "Offer not found or not applicable",
        },
        error: { type: "string", example: "NOT_FOUND" },
      },
    },
  })
  async applyOffer(@Req() req: any, @Body() applyOfferDto: ApplyOfferDto) {
    const userId = req.user.id;
    return this.cartService.applyOffer(userId, applyOfferDto);
  }

  @Put("cart/tip")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Update tip amount in cart",
    description:
      "Update the tip amount for the current cart. Tip amount is validated against maximum allowed tip (constant: ₹100.00).",
  })
  @ApiBody({
    type: UpdateTipDto,
    description: "Tip amount to add to cart",
    examples: {
      tip50: {
        summary: "Add ₹50 tip",
        value: {
          tip_amount: 50.0,
        },
      },
      tip100: {
        summary: "Add ₹100 tip",
        value: {
          tip_amount: 100.0,
        },
      },
      noTip: {
        summary: "Remove tip (set to 0)",
        value: {
          tip_amount: 0.0,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Tip amount updated successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Tip amount updated successfully" },
        data: {
          type: "object",
          properties: {
            tip_amount: { type: "number", example: 50.0 },
            max_tip_amount: {
              type: "number",
              example: 100.0,
              description: "Maximum tip amount (constant: ₹100.00)",
            },
            cart_summary: {
              type: "object",
              properties: {
                subtotal: { type: "number", example: 500.0 },
                delivery_fee: { type: "number", example: 30.0 },
                tax_amount: { type: "number", example: 50.0 },
                discount_amount: { type: "number", example: 0.0 },
                tip_amount: { type: "number", example: 50.0 },
                max_tip_amount: {
                  type: "number",
                  example: 100.0,
                  description: "Maximum tip amount (constant: ₹100.00)",
                },
                platform_fee: {
                  type: "number",
                  example: 50.0,
                  description: "Platform fee amount (always shown for display). If include_platform_fee is false, show this amount with strikethrough and use 0 in total calculation.",
                },
                include_platform_fee: {
                  type: "boolean",
                  example: true,
                  description: "Whether platform fee is included in final_amount calculation. If false, platform_fee is shown but not added to total (show with strikethrough in UI).",
                },
                final_amount: { type: "number", example: 630.0 },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Invalid tip amount or exceeds maximum limit",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: {
          type: "string",
          example:
            "Tip amount cannot exceed maximum allowed tip of ₹100.00",
        },
        error: { type: "string", example: "Bad Request" },
      },
    },
  })
  async updateTip(@Req() req: any, @Body() updateTipDto: UpdateTipDto) {
    const userId = req.user.id;
    return this.cartService.updateTip(userId, updateTipDto.tip_amount);
  }

  @Post("cart/apply-coupon")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Apply coupon to cart",
    description:
      "Apply a coupon code to the user's active cart. Validates the coupon and reserves it automatically.",
  })
  @ApiBody({
    type: ApplyCouponDto,
    description: "Coupon code to apply",
    examples: {
      summerCoupon: {
        summary: "Apply summer coupon",
        value: {
          coupon_code: "SUMMER2025",
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Coupon applied successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Coupon applied successfully" },
        data: {
          type: "object",
          properties: {
            coupon_code: { type: "string", example: "SUMMER2025" },
            discount_amount: { type: "number", example: 100.0 },
            delivery_waived: { type: "boolean", example: false },
            reservation_token: { type: "string", example: "550e8400-e29b-41d4-a716-446655440000" },
            cart_summary: { type: "object" },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Invalid coupon code or validation failed",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Guest users must register before applying coupons",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        statusCode: { type: "number", example: 403 },
        message: {
          type: "string",
          example: "Please register as a Tazty user first to apply a coupon.",
        },
        timestamp: { type: "string", example: "2026-03-20T12:00:00.000Z" },
        path: { type: "string", example: "/api/buyer/cart/apply-coupon" },
      },
    },
  })
  async applyCoupon(@Req() req: any, @Body() applyCouponDto: ApplyCouponDto) {
    const userId = req.user.id;
    return this.cartService.applyCoupon(userId, applyCouponDto);
  }

  @Delete("cart/remove-coupon")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Remove coupon from cart",
    description:
      "Remove the applied coupon from the user's active cart and rollback the reservation.",
  })
  @ApiResponse({
    status: 200,
    description: "Coupon removed successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Coupon removed successfully" },
        data: {
          type: "object",
          properties: {
            cart_summary: { type: "object" },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "No coupon applied to cart",
  })
  async removeCoupon(@Req() req: any) {
    const userId = req.user.id;
    return this.cartService.removeCoupon(userId);
  }

  @Post("orders")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Create order from cart",
    description:
      "Create a new order from the user's active cart with delivery address and payment method. For preorder items, validates campaign status, reserves quota, and redeems coupon automatically. Note: Orders are not accepted when app operation hours are closed.",
  })
  @ApiBody({ type: CreateOrderDto })
  @ApiResponse({
    status: 201,
    description: "Order created successfully",
    type: CreateOrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Cart is empty or invalid data",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Cart is empty" },
        error: { type: "string", example: "BAD_REQUEST" },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Delivery address not found",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Delivery address not found" },
        error: { type: "string", example: "NOT_FOUND" },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: "Service unavailable - App operation hours are closed",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        statusCode: { type: "number", example: 503 },
        message: {
          type: "string",
          example: "Restaurants not accepting orders right now. Ordering will be available again at 8 AM.",
        },
        timestamp: { type: "string", example: "2025-01-15T22:30:00.000Z" },
        path: { type: "string", example: "/api/buyer/orders" },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Guest users must register before placing orders",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        statusCode: { type: "number", example: 403 },
        message: {
          type: "string",
          example: "Please register as a Tazty user first to place an order.",
        },
        timestamp: { type: "string", example: "2026-03-20T12:00:00.000Z" },
        path: { type: "string", example: "/api/buyer/orders" },
      },
    },
  })
  async createOrder(@Req() req: any, @Body() createOrderDto: CreateOrderDto) {
    const userId = req.user.id;
    return this.orderService.createOrder(userId, createOrderDto);
  }

  @Get("orders")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get user orders",
    description:
      "Retrieve paginated list of user's orders with tracking information.",
  })
  @ApiQuery({
    name: "page",
    description: "Page number",
    example: 1,
    required: false,
    type: "number",
  })
  @ApiQuery({
    name: "limit",
    description: "Number of orders per page",
    example: 10,
    required: false,
    type: "number",
  })
  @ApiResponse({
    status: 200,
    description: "Orders retrieved successfully",
    type: OrderListResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Guest users must register before viewing orders",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        statusCode: { type: "number", example: 403 },
        message: {
          type: "string",
          example: "Please register as a Tazty user first to view your orders.",
        },
        timestamp: { type: "string", example: "2026-03-20T12:00:00.000Z" },
        path: { type: "string", example: "/api/buyer/orders" },
      },
    },
  })
  async getUserOrders(
    @Req() req: any,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const userId = req.user.id;
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    return this.orderService.getUserOrders(userId, pageNum, limitNum);
  }

  @Get("orders/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get order details",
    description:
      "Retrieve detailed information about a specific order including items, tracking, and payment status.",
  })
  @ApiParam({
    name: "id",
    description: "Order ID",
    example: 1,
    type: "number",
  })
  @ApiResponse({
    status: 200,
    description: "Order retrieved successfully",
    type: OrderResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Order not found" },
        error: { type: "string", example: "NOT_FOUND" },
      },
    },
  })
  async getOrderById(@Req() req: any, @Param("id") orderId: string) {
    const userId = req.user.id;
    return this.orderService.getOrderById(parseInt(orderId), userId);
  }

  @Post("orders/cancel")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Cancel order",
    description:
      "Cancel an order using order number with a specific cancel reason. Use GET /cancel-reason to fetch available cancellation reasons. Refunds will be automatically processed for paid orders. Orders can only be cancelled before they are out for delivery.\n\n**Note:** This endpoint is for buyer cancellations only. Sellers should use the webhook endpoint to update order status to cancelled.",
  })
  @ApiBody({ 
    type: OrderCancelDto,
    description: "Cancel order request with order number, reason code and description from cancel-reason API",
    examples: {
      'Duplicate Order': {
        value: {
          order_number: "ORD-20250117-001",
          code: "100",
          reason: "Placed duplicate order",
          cancelled_by: "buyer"
        }
      },
      'Ordered by Mistake': {
        value: {
          order_number: "ORD-20250117-002",
          code: "101",
          reason: "Ordered by mistake",
          cancelled_by: "buyer"
        }
      },
      'Change Address': {
        value: {
          order_number: "ORD-20250117-003",
          code: "104",
          reason: "Need to change delivery address",
          cancelled_by: "buyer"
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: "Order cancelled successfully with refund details",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        statusCode: { type: "number", example: 200 },
        message: { type: "string", example: "Order cancelled successfully" },
        data: {
          type: "object",
          properties: {
            order_number: { type: "string", example: "ORD-20250117-001" },
            status: { type: "string", example: "cancelled" },
            payment_status: { type: "string", example: "refunded" },
            cancel_reason: {
              type: "object",
              properties: {
                code: { type: "string", example: "100" },
                reason: { type: "string", example: "Placed duplicate order" },
                cancelled_by: { type: "string", example: "buyer" }
              }
            },
            refund_amount: { type: "number", example: 566.40 },
            refund_method: { type: "string", example: "original_payment" },
            estimated_refund_time: { type: "string", example: "3-5 business days" },
            cancelled_at: { type: "string", example: "2026-01-17T12:30:00Z" }
          }
        },
        timestamp: { type: "string", example: "2026-01-17T12:30:00Z" }
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Order cannot be cancelled - invalid status or already delivered/cancelled",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        statusCode: { type: "number", example: 400 },
        message: { 
          type: "string", 
          example: "Order cannot be cancelled. It is already out for delivery or delivered." 
        },
        timestamp: { type: "string", example: "2026-01-17T12:30:00Z" },
        path: { type: "string", example: "/api/buyer/orders/1/cancel" }
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Order not found or does not belong to user",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        statusCode: { type: "number", example: 404 },
        message: { type: "string", example: "Order not found" },
        timestamp: { type: "string", example: "2026-01-17T12:30:00Z" },
        path: { type: "string", example: "/api/buyer/orders/cancel" }
      },
    },
  })
  async cancelOrder(
    @Req() req: any,
    @Body() cancelOrderDto: OrderCancelDto,
  ) {
    const userId = req.user.id;
    return this.orderService.cancelOrder(cancelOrderDto, userId);
  }

  @Post("payments/create")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Create payment for order",
    description:
      "Create a Razorpay payment order for online payment processing.",
  })
  @ApiBody({ type: CreatePaymentDto })
  @ApiResponse({
    status: 201,
    description: "Payment initiated successfully",
    type: PaymentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Order already paid or invalid data",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Order is already paid" },
        error: { type: "string", example: "BAD_REQUEST" },
      },
    },
  })
  async createPayment(
    @Req() req: any,
    @Body() createPaymentDto: CreatePaymentDto,
  ) {
    const userId = req.user.id;
    return this.orderService.createPayment(userId, createPaymentDto);
  }

  @Post("payment/initiate/:orderId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Initiate payment for an order",
    description:
      "Initiate payment for an order that is in pending_payment status",
  })
  @ApiParam({
    name: "orderId",
    description: "Order ID to initiate payment for",
    type: "number",
    example: 123,
  })
  @ApiBody({
    description: "Customer details for payment",
    schema: {
      type: "object",
      properties: {
        name: { type: "string", example: "John Doe" },
        email: { type: "string", example: "john@example.com" },
        phone: { type: "string", example: "9876543210" },
      },
      required: ["name", "email", "phone"],
    },
  })
  @ApiResponse({
    status: 200,
    description: "Payment initiated successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Payment initiated successfully" },
        payment_details: {
          type: "object",
          properties: {
            razorpay_order_id: {
              type: "string",
              example: "order_29QQoUBi66xm2f",
            },
            amount: { type: "number", example: 68564 },
            currency: { type: "string", example: "INR" },
            key: { type: "string", example: "rzp_test_1DP5mmOlF5G5ag" },
            name: { type: "string", example: "Restaurant Name" },
            description: { type: "string", example: "Order #ORD-20250115-001" },
            prefill: {
              type: "object",
              properties: {
                name: { type: "string", example: "John Doe" },
                email: { type: "string", example: "john@example.com" },
                contact: { type: "string", example: "9876543210" },
              },
            },
          },
        },
      },
    },
  })
  async initiatePayment(
    @Req() req: any,
    @Param("orderId") orderId: string,
    @Body() customerDetails: any,
  ) {
    const userId = req.user.id;
    return this.orderService.initiatePayment(
      userId,
      parseInt(orderId),
      customerDetails,
    );
  }

  @Post("payment/failure/:orderId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Handle payment failure",
    description: "Record payment failure and allow retry",
  })
  @ApiParam({
    name: "orderId",
    description: "Order ID where payment failed",
    type: "number",
    example: 123,
  })
  @ApiBody({
    description: "Payment failure details",
    schema: {
      type: "object",
      properties: {
        reason: { type: "string", example: "Payment declined by bank" },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Payment failure recorded successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: {
          type: "string",
          example: "Payment failure recorded. You can retry payment.",
        },
        order_id: { type: "number", example: 123 },
        can_retry: { type: "boolean", example: true },
      },
    },
  })
  async handlePaymentFailure(
    @Req() req: any,
    @Param("orderId") orderId: string,
    @Body() failureData: any,
  ) {
    const userId = req.user.id;
    return this.orderService.handlePaymentFailure(
      userId,
      parseInt(orderId),
      failureData.reason,
    );
  }

  @Get("orders/pending-payment")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get orders pending payment",
    description: "Retrieve orders that are waiting for payment completion",
  })
  @ApiResponse({
    status: 200,
    description: "Pending payment orders retrieved successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: {
          type: "string",
          example: "Pending payment orders retrieved successfully",
        },
        data: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "number", example: 123 },
              order_number: { type: "string", example: "ORD-20250115-001" },
              status: { type: "string", example: "pending_payment" },
              payment_status: { type: "string", example: "pending" },
              total_amount: { type: "number", example: 685.64 },
            },
          },
        },
        count: { type: "number", example: 2 },
      },
    },
  })
  async getPendingPaymentOrders(@Req() req: any) {
    const userId = req.user.id;
    return this.orderService.getPendingPaymentOrders(userId);
  }

  // ==================== NOTIFICATION ENDPOINTS ====================

  @Get("notifications")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get user notifications",
    description:
      "Retrieve user notifications with pagination and filtering options",
  })
  @ApiResponse({
    status: 200,
    description: "Notifications retrieved successfully",
  })
  async getNotifications(
    @Req() req: any,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("type") type?: string,
    @Query("unread_only") unreadOnly?: string,
  ) {
    const userId = req.user?.id;
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 20;
    const unreadOnlyBool = unreadOnly === "true";

    return this.notificationService.getUserNotifications(
      userId,
      pageNum,
      limitNum,
      type,
      unreadOnlyBool,
    );
  }

  @Put("notifications/:id/read")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Mark notification as read",
    description: "Mark a specific notification as read",
  })
  @ApiResponse({
    status: 200,
    description: "Notification marked as read",
  })
  async markNotificationAsRead(
    @Req() req: any,
    @Param("id") notificationId: string,
  ) {
    const userId = req.user?.id;
    return this.notificationService.markAsRead(
      parseInt(notificationId),
      userId,
    );
  }

  @Put("notifications/read-all")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Mark all notifications as read",
    description: "Mark all unread notifications as read for the user",
  })
  @ApiResponse({
    status: 200,
    description: "All notifications marked as read",
  })
  async markAllNotificationsAsRead(@Req() req: any) {
    const userId = req.user?.id;
    return this.notificationService.markAllAsRead(userId);
  }

  @Delete("notifications/:id")
  @ApiOperation({
    summary: "Delete notification",
    description: "Delete a specific notification",
  })
  @ApiResponse({
    status: 200,
    description: "Notification deleted successfully",
  })
  async deleteNotification(
    @Req() req: any,
    @Param("id") notificationId: string,
  ) {
    const userId = req.user?.id;
    return this.notificationService.deleteNotification(
      parseInt(notificationId),
      userId,
    );
  }

  @Get("notification-preferences")
  @ApiOperation({
    summary: "Get notification preferences",
    description: "Get user notification preferences",
  })
  @ApiResponse({
    status: 200,
    description: "Notification preferences retrieved successfully",
  })
  async getNotificationPreferences(@Req() req: any) {
    const userId = req.user?.id;
    return this.notificationService.getNotificationPreferences(userId);
  }

  @Put("notification-preferences")
  @ApiOperation({
    summary: "Update notification preferences",
    description: "Update user notification preferences",
  })
  @ApiResponse({
    status: 200,
    description: "Notification preferences updated successfully",
  })
  async updateNotificationPreferences(
    @Req() req: any,
    @Body() preferences: any,
  ) {
    const userId = req.user?.id;
    return this.notificationService.updateNotificationPreferences(
      userId,
      preferences,
    );
  }

  @Post("push-tokens")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Register FCM device token for push notifications",
    description: `Register or update Firebase Cloud Messaging (FCM) device token for push notifications.
    
    **Requirements**:
    - FCM token from @react-native-firebase/messaging
    - Token format: {id}:{long-token} (140-200 characters)
    - Platform: android, ios, or web
    
    **Optional Metadata** (Recommended):
    - device_id: Unique device identifier for multi-device tracking
    - app_version: App version for version-specific features
    
    **Optional Headers** (Recommended):
    - x-app-version-name or app-version-name: Version name (e.g., "1.0.0") - Will override body app_version if provided
    - x-app-version-code or app-version-code: Version code (e.g., 3)
    
    **Token Format**:
    - Android: FCM token from Firebase SDK
    - iOS: FCM token via APNS integration
    - Example: "fGcB3ZnJ5K8pqR:APA91bHtxY_..."`,
  })
  @ApiBody({
    description: "Device token registration payload with optional device metadata",
    schema: {
      type: "object",
      required: ["device_token", "platform"],
      properties: {
        device_token: {
          type: "string",
          example: "fGcB3ZnJ5K8pqR:APA91bHtxY_1234567890abcdefghijklmnop",
          description: "Firebase Cloud Messaging (FCM) device token from @react-native-firebase/messaging",
        },
        platform: {
          type: "string",
          example: "android",
          enum: ["android", "ios", "web"],
          description: "Origin platform of the device token",
        },
        device_id: {
          type: "string",
          example: "A1B2C3D4-E5F6-7890-1234-567890ABCDEF",
          description: "Unique device identifier (Android: ANDROID_ID, iOS: identifierForVendor) - Optional but recommended for device tracking",
        },
        app_version: {
          type: "string",
          example: "1.2.3",
          description: "Application version (e.g., 1.2.3) - Optional but recommended for version-specific features and analytics",
        },
      },
    },
    examples: {
      android_fcm: {
        summary: "Android with FCM token (Correct)",
        value: {
          device_token: "fGcB3ZnJ5K8pqR:APA91bHtxY_1234567890abcdefghijklmnop",
          platform: "android",
          device_id: "android-abc123def456",
          app_version: "1.2.3",
        },
      },
      ios_fcm: {
        summary: "iOS with FCM token (Correct)",
        value: {
          device_token: "dHw4RmK9LpXq:APA91bGsxZ_9876543210zyxwvutsrqponml",
          platform: "ios",
          device_id: "ios-def456ghi789",
          app_version: "1.2.3",
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "Device token registered successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Device token registered successfully" },
        data: {
          type: "object",
          properties: {
            device_token: { type: "string", example: "fGcB3ZnJ5K8pqR:APA91bHtxY_..." },
            platform: { type: "string", example: "android" },
            device_id: { type: "string", example: "A1B2C3D4-E5F6-7890-1234-567890ABCDEF" },
            app_version: { type: "string", example: "1.2.3", nullable: true },
            version_name: { type: "string", example: "1.2.3", nullable: true, description: "Same as app_version, kept for API compatibility" },
            version_code: { type: "number", example: 3, nullable: true },
            registered_at: { type: "string", example: "2025-12-05T10:30:00Z" },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid FCM token or platform",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        statusCode: { type: "number", example: 400 },
        message: {
          type: "string",
          example: "Invalid FCM token. Please ensure your app is properly configured with Firebase Cloud Messaging.",
        },
        error: { type: "string", example: "Bad Request" },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - User not authenticated",
  })
  async registerDeviceToken(@Req() req: any, @Body() tokenData: RegisterDeviceTokenDto) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException("User not authenticated");
    }

    try {
      // Extract app_version (version_name) and version_code from headers
      // Support x-app-version-name and x-app-version-code/app-version-code
      // version_name from headers takes priority, then body app_version
      const headerVersionName =
        req.headers["x-app-version-name"] ||
        req.headers["app-version-name"] ||
        null;
      const versionName = headerVersionName || null;
      const appVersion = tokenData.app_version || null;

      const versionCodeStr =
        req.headers["x-app-version-code"] ||
        req.headers["app-version-code"] ||
        null;
      const versionCode = versionCodeStr ? parseInt(versionCodeStr, 10) : null;

      this.logger.log(
        `📱 Registering device token for user ${userId} | Platform: ${tokenData.platform} | Device ID: ${tokenData.device_id || "not provided"} | App Version: ${appVersion || "not provided"} | Version Name: ${versionName || "not provided"} | Version Code: ${versionCode || "not provided"}`,
      );

      // Validate basic token format
      if (
        !tokenData.device_token ||
        typeof tokenData.device_token !== "string"
      ) {
        this.logger.warn(`❌ Invalid device token format for user ${userId}`);
        throw new BadRequestException("Device token is required");
      }

      if (!tokenData.platform || typeof tokenData.platform !== "string") {
        this.logger.warn(`❌ Invalid platform for user ${userId}`);
        throw new BadRequestException("Platform is required");
      }

      // Log if optional fields are missing
      if (!tokenData.device_id) {
        this.logger.warn(
          `⚠️  Device ID not provided for user ${userId} - device tracking will be limited`,
        );
      }
      if (!versionName && !appVersion) {
        this.logger.warn(
          `⚠️  App version/version name not provided for user ${userId} - version tracking will be limited`,
        );
      }
      if (!versionCode) {
        this.logger.warn(
          `⚠️  Version code not provided in headers for user ${userId} - version tracking will be limited`,
        );
      }

      // Register FCM token in database
      this.logger.log(`🔄 Registering FCM token in database...`);

      await this.notificationService.registerDeviceToken(
        userId,
        tokenData.device_token,
        tokenData.platform,
        tokenData.device_id,
        appVersion || undefined,
        versionName || undefined,
        versionCode ?? undefined,
      );

      const finalAppVersion = versionName || appVersion;
      this.logger.log(
        `✅ FCM token registered successfully | User: ${userId} | Platform: ${tokenData.platform} | Device: ${tokenData.device_id || "untracked"} | App Version: ${finalAppVersion || "unknown"} | Version Code: ${versionCode || "unknown"}`,
      );

      return {
        success: true,
        message: "Device token registered successfully",
        data: {
          device_token: tokenData.device_token.substring(0, 50) + "...",
          platform: tokenData.platform,
          device_id: tokenData.device_id || null,
          app_version: versionName || appVersion || null,
          version_name: versionName || appVersion || null, // version_name uses versionName or app_version value for API compatibility
          version_code: versionCode || null,
          registered_at: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to register device token for user ${userId}: ${error.message}`,
        error.stack,
      );

      // Return more specific error messages
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Failed to register device token: ${error.message}`,
      );
    }
  }

  @Delete("push-tokens/:token")
  @ApiOperation({
    summary: "Unregister device token",
    description: "Unregister device token for push notifications",
  })
  @ApiParam({
    name: "token",
    required: true,
    description: "Device token string to unregister",
    schema: {
      type: "string",
      example: "fcm_token_123456789",
    },
  })
  @ApiResponse({
    status: 200,
    description: "Device token unregistered successfully",
  })
  async unregisterDeviceToken(
    @Req() req: any,
    @Param("token") deviceToken: string,
  ) {
    const userId = req.user?.id;
    return this.notificationService.unregisterDeviceToken(userId, deviceToken);
  }

  @Post("test-push-notification")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Test push notification (for development)",
    description:
      "Send a test push notification to the authenticated user's registered devices. Useful for testing FCM integration and device token registration.",
  })
  @ApiBody({
    type: TestNotificationDto,
    description: "Test notification payload",
    required: false,
    examples: {
      default: {
        summary: "Default message",
        value: {
          message: "This is a test push notification",
        },
      },
      custom: {
        summary: "Custom message",
        value: {
          message: "Hello! Testing push notifications.",
        },
      },
      empty: {
        summary: "No body (uses default message)",
        value: {},
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Test notification sent successfully",
    schema: {
      type: "object",
      properties: {
        success: {
          type: "boolean",
          example: true,
        },
        message: {
          type: "string",
          example: "Test notification sent successfully",
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "User not authenticated",
  })
  @ApiResponse({
    status: 500,
    description: "Failed to send test notification",
  })
  async testPushNotification(
    @Req() req: any,
    @Body() body: TestNotificationDto = {},
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException("User not authenticated");
    }

    try {
      await this.notificationService.createNotification({
        user_id: userId,
        title: "Test Notification",
        message: body?.message || "This is a test push notification",
        type: "system",
        data: { test: true },
      });

      return {
        success: true,
        message: "Test notification sent successfully",
      };
    } catch (error) {
      this.logger.error(
        `Failed to send test notification: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        "Failed to send test notification",
      );
    }
  }

  @Post("broadcast-notification")
  @ApiTags("Public Notifications")
  @ApiOperation({
    summary: "Broadcast notification to all users",
    description:
      "Send a notification to all active users. Creates a notification record for each user and sends push notifications to all active device tokens. Useful for announcements, promotions, or system-wide updates. **Note: This is a public endpoint (no authentication required). Admin role guard will be implemented later.**",
  })
  @ApiBody({
    type: BroadcastNotificationDto,
    description: "Broadcast notification payload",
    examples: {
      promotion: {
        summary: "Promotional announcement with image",
        value: {
          title: "Special Offer!",
          message: "Get 20% off on all orders today. Use code SAVE20",
          type: "promotion",
          image_url: "https://example.com/images/promotion-banner.jpg",
          data: {
            coupon_code: "SAVE20",
            discount: 20,
            url: "https://app.example.com/offers",
          },
        },
      },
      system: {
        summary: "System announcement with image",
        value: {
          title: "Maintenance Scheduled",
          message: "We will be performing maintenance on Saturday from 2-4 AM. App may be unavailable during this time.",
          type: "system",
          image_url: "https://example.com/images/maintenance-notice.jpg",
          data: {
            maintenance_date: "2025-01-20",
            start_time: "02:00",
            end_time: "04:00",
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Broadcast notification sent successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Broadcast notification sent successfully" },
        data: {
          type: "object",
          properties: {
            totalUsers: { type: "number", example: 150 },
            notificationsCreated: { type: "number", example: 150 },
            pushSent: { type: "number", example: 280 },
            pushFailed: { type: "number", example: 5 },
            errors: {
              type: "array",
              items: { type: "string" },
              example: [],
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid notification data",
  })
  @ApiResponse({
    status: 500,
    description: "Internal server error - Failed to send broadcast",
  })
  async broadcastNotification(
    @Body() broadcastData: BroadcastNotificationDto,
  ) {
    try {
      this.logger.log(
        `📢 Broadcast notification request (public) | Title: "${broadcastData.title}" | Type: ${broadcastData.type || "system"} | Image: ${broadcastData.image_url || "none"}`,
      );

      const result = await this.notificationService.broadcastNotification(
        broadcastData.title,
        broadcastData.message,
        broadcastData.type || "system",
        broadcastData.image_url,
        broadcastData.data,
      );

      this.logger.log(
        `✅ Broadcast notification completed | Users: ${result.totalUsers} | Created: ${result.notificationsCreated} | Push Sent: ${result.pushSent} | Failed: ${result.pushFailed}`,
      );

      return {
        success: true,
        message: "Broadcast notification sent successfully",
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send broadcast notification: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        `Failed to send broadcast notification: ${error.message}`,
      );
    }
  }

  // ==================== REVIEW ENDPOINTS ====================

  @Post("reviews/unified")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Create unified review for order",
    description:
      "Create comprehensive review for restaurant, food items, and delivery partner in a single request",
  })
  @ApiBody({
    description: "Unified review data for complete order rating",
    schema: {
      type: "object",
      properties: {
        order_id: {
          type: "number",
          example: 123,
          description: "Order ID to review (mandatory)",
        },
        overall_rating: {
          type: "number",
          example: 4,
          minimum: 1,
          maximum: 5,
          description: "Overall order rating (mandatory)",
        },
        restaurant_rating: {
          type: "number",
          example: 4,
          minimum: 1,
          maximum: 5,
          description: "Restaurant rating (optional)",
        },
        restaurant_comment: {
          type: "string",
          example: "Great food and fast delivery!",
          description: "Restaurant review comment / title (optional)",
        },
        comments: {
          type: "string",
          example: "Overall the experience was great!",
          description: "General review comment applied to both restaurant and item reviews (optional)",
        },
        delivery_partner_rating: {
          type: "number",
          example: 5,
          minimum: 1,
          maximum: 5,
          description: "Delivery partner rating (optional)",
        },
        food_quality: {
          type: "array",
          description: "Individual food item ratings (optional)",
          items: {
            type: "object",
            properties: {
              product_id: { type: "number", example: 1 },
              rating: { type: "number", example: 5, minimum: 1, maximum: 5 },
              comment: {
                type: "string",
                example: "Perfect crust and fresh ingredients!",
              },
            },
            required: ["product_id", "rating"],
          },
        },
        photos: {
          type: "array",
          description: "Review photos/videos (optional)",
          items: {
            type: "object",
            properties: {
              url: {
                type: "string",
                example: "https://example.com/photo1.jpg",
              },
              type: {
                type: "string",
                enum: ["photo", "video"],
                example: "photo",
              },
            },
          },
        },
      },
      required: ["order_id", "overall_rating"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "Unified review created successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Review submitted successfully" },
        data: {
          type: "object",
          properties: {
            review_id: { type: "number", example: 1 },
            order_id: { type: "number", example: 123 },
            overall_rating: { type: "number", example: 4 },
            restaurant_review_id: { type: "number", example: 1 },
            item_review_ids: {
              type: "array",
              items: { type: "number" },
              example: [1, 2],
            },
            delivery_rating: { type: "number", example: 5 },
          },
        },
      },
    },
  })
  async createUnifiedReview(@Req() req: any, @Body() createReviewDto: any) {
    const userId = req.user?.id;

    // Validate required fields
    if (!createReviewDto || !createReviewDto.order_id) {
      return {
        success: false,
        message: "order_id is required",
        statusCode: 400,
      };
    }

    if (!createReviewDto.overall_rating) {
      return {
        success: false,
        message: "overall_rating is required",
        statusCode: 400,
      };
    }

    return this.reviewService.createUnifiedReview(userId, createReviewDto);
  }

  @Get("reviews/restaurant/:restaurantId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get restaurant reviews",
    description: "Get all reviews for a specific restaurant with pagination",
  })
  @ApiResponse({
    status: 200,
    description: "Restaurant reviews retrieved successfully",
  })
  async getRestaurantReviews(
    @Param("restaurantId") restaurantId: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("sort_by") sortBy?: string,
    @Query("sort_order") sortOrder?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 20;
    const sortOrderEnum = sortOrder === "ASC" ? "ASC" : "DESC";

    return this.reviewService.getRestaurantReviews(
      parseInt(restaurantId),
      pageNum,
      limitNum,
      sortBy || "created_at",
      sortOrderEnum,
    );
  }

  @Get("reviews/item/:itemId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get item reviews",
    description: "Get all reviews for a specific item with pagination",
  })
  @ApiResponse({
    status: 200,
    description: "Item reviews retrieved successfully",
  })
  async getItemReviews(
    @Param("itemId") itemId: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("sort_by") sortBy?: string,
    @Query("sort_order") sortOrder?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 20;
    const sortOrderEnum = sortOrder === "ASC" ? "ASC" : "DESC";

    return this.reviewService.getItemReviews(
      parseInt(itemId),
      pageNum,
      limitNum,
      sortBy || "created_at",
      sortOrderEnum,
    );
  }

  @Get("reviews/my")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get user reviews",
    description: "Get all reviews created by the current user with pagination",
  })
  @ApiResponse({
    status: 200,
    description: "User reviews retrieved successfully",
  })
  async getUserReviews(
    @Req() req: any,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("type") type?: string,
  ) {
    const userId = req.user?.id;
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 20;

    return this.reviewService.getUserReviews(
      userId,
      pageNum,
      limitNum,
      type as "restaurant" | "item",
    );
  }

  @Put("reviews/restaurant/:reviewId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Update restaurant review",
    description: "Update a restaurant review created by the current user",
  })
  @ApiResponse({
    status: 200,
    description: "Restaurant review updated successfully",
  })
  async updateRestaurantReview(
    @Req() req: any,
    @Param("reviewId") reviewId: string,
    @Body() updateReviewDto: any,
  ) {
    const userId = req.user?.id;
    return this.reviewService.updateRestaurantReview(
      parseInt(reviewId),
      userId,
      updateReviewDto,
    );
  }

  @Put("reviews/item/:reviewId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Update item review",
    description: "Update an item review created by the current user",
  })
  @ApiResponse({
    status: 200,
    description: "Item review updated successfully",
  })
  async updateItemReview(
    @Req() req: any,
    @Param("reviewId") reviewId: string,
    @Body() updateReviewDto: any,
  ) {
    const userId = req.user?.id;
    return this.reviewService.updateItemReview(
      parseInt(reviewId),
      userId,
      updateReviewDto,
    );
  }

  @Delete("reviews/restaurant/:reviewId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Delete restaurant review",
    description: "Delete a restaurant review created by the current user",
  })
  @ApiResponse({
    status: 200,
    description: "Restaurant review deleted successfully",
  })
  async deleteRestaurantReview(
    @Req() req: any,
    @Param("reviewId") reviewId: string,
  ) {
    const userId = req.user?.id;
    return this.reviewService.deleteRestaurantReview(
      parseInt(reviewId),
      userId,
    );
  }

  @Delete("reviews/item/:reviewId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Delete item review",
    description: "Delete an item review created by the current user",
  })
  @ApiResponse({
    status: 200,
    description: "Item review deleted successfully",
  })
  async deleteItemReview(@Req() req: any, @Param("reviewId") reviewId: string) {
    const userId = req.user?.id;
    return this.reviewService.deleteItemReview(parseInt(reviewId), userId);
  }

  /**
   * Razorpay webhook handler
   */
  @Post("webhook/razorpay")
  @ApiOperation({
    summary: "Razorpay payment webhook",
    description:
      "Webhook endpoint to receive payment events from Razorpay. Handles payment.captured, payment.failed, and refund.processed events. Order events (order.paid) are temporarily disabled. Validates webhook signature and ensures idempotent processing. This endpoint is public and does not require authentication.",
  })
  @ApiResponse({
    status: 200,
    description: "Webhook processed successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: {
          type: "string",
          example: "Event already processed",
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Invalid webhook signature or missing event ID",
    schema: {
      type: "object",
      properties: {
        error: { type: "string", example: "Invalid signature" },
        message: {
          type: "string",
          example: "Razorpay webhooks must include an event ID",
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: "Webhook processing failed (transient error - will be retried)",
    schema: {
      type: "object",
      properties: {
        error: { type: "string", example: "Webhook processing failed" },
      },
    },
  })
  async handleRazorpayWebhook(@Req() req: any, @Res({ passthrough: false }) res: any) {
    let webhookEventRecord: WebhookEvent | null = null;
    try {
      const signature = req.headers["x-razorpay-signature"];
      const body = JSON.stringify(req.body);

      this.logger.log(`🔔 Received Razorpay webhook`);

      // Verify webhook signature
      const isValid = this.razorpayService.verifyWebhookSignature(
        body,
        signature,
      );

      if (!isValid) {
        this.logger.warn(`❌ Invalid webhook signature`);
        res.status(400).json({ error: "Invalid signature" });
        return;
      }

      const event = req.body;
      const eventType = event.event; // payment.captured, payment.failed, order.paid

      // Generate event ID from available data if Razorpay doesn't provide one
      // Razorpay doesn't always include event.id at top level, so we generate it
      let eventId = event.id || event.event_id;

      if (!eventId) {
        // Generate event ID from payment/order/refund ID + event type for idempotency
        if (event.payload?.payment?.entity?.id) {
          eventId = `${event.payload.payment.entity.id}_${eventType}`;
        } else if (event.payload?.order?.entity?.id) {
          eventId = `${event.payload.order.entity.id}_${eventType}`;
        } else if (event.payload?.refund?.entity?.id) {
          eventId = `${event.payload.refund.entity.id}_${eventType}`;
        }
      }

      this.logger.log(
        `📨 Webhook event: ${eventType}, Event ID: ${eventId || "N/A"}`,
      );

      // Require event ID for webhook processing (generated if not provided by Razorpay)
      if (!eventId) {
        this.logger.error(
          `❌ Webhook event missing event ID and unable to generate one. Event type: ${eventType || "unknown"}. Rejecting event.`,
        );
        res.status(400).json({
          error: "Event ID is required for webhook processing",
          message: "Unable to extract or generate event ID from webhook payload",
        });
        return;
      }

      // Check if this event has already been processed (idempotency check)
      const existingEvent = await this.webhookEventRepository.findOne({
        where: { event_id: eventId, event_type: eventType },
      });

      if (existingEvent) {
        if (existingEvent.processing_status === "processed") {
          this.logger.log(
            `⏭️ Webhook event ${eventId} (${eventType}) already processed, skipping duplicate`,
          );
          res.status(200).json({ success: true, message: "Event already processed" });
          return;
        } else if (existingEvent.processing_status === "failed") {
          this.logger.log(
            `🔄 Retrying previously failed webhook event ${eventId} (${eventType})`,
          );
          // Continue processing - will update the existing record
          webhookEventRecord = existingEvent;
        }
      } else {
        // Create new webhook event record
        webhookEventRecord = this.webhookEventRepository.create({
          event_id: eventId,
          event_type: eventType,
          processing_status: "pending",
          event_payload: event,
        });
        await this.webhookEventRepository.save(webhookEventRecord);
        this.logger.log(
          `📝 Created webhook event record for ${eventId} (${eventType})`,
        );
      }

      // Extract common fields from event
      let paymentId: string | null = null;
      let razorpayOrderId: string | null = null;
      let internalOrderId: number | null = null;

      if (event.payload?.payment?.entity) {
        paymentId = event.payload.payment.entity.id;
        razorpayOrderId = event.payload.payment.entity.order_id;
      } else if (event.payload?.order?.entity) {
        razorpayOrderId = event.payload.order.entity.id;
      } else if (event.payload?.refund?.entity) {
        // For refund events, payment_id is in refund.entity
        paymentId = event.payload.refund.entity.payment_id;
      }

      // Try to find internal order ID from Razorpay order ID or payment ID
      if (razorpayOrderId) {
        try {
          const order = await this.orderService.findOrderByRazorpayOrderId(
            razorpayOrderId,
          );
          if (order) {
            internalOrderId = order.id;
          }
        } catch (error) {
          this.logger.warn(
            `⚠️ Could not find internal order for Razorpay order ID: ${razorpayOrderId}`,
          );
        }
      } else if (paymentId && eventType === "refund.processed") {
        // For refund events, try to find order by payment ID
        try {
          const payment = await this.orderService.findPaymentByRazorpayPaymentId(
            paymentId,
          );
          if (payment?.order) {
            internalOrderId = payment.order.id;
          }
        } catch (error) {
          this.logger.warn(
            `⚠️ Could not find order for Razorpay payment ID: ${paymentId}`,
          );
        }
      }

      // Update webhook event record with extracted data
      if (webhookEventRecord) {
        if (paymentId) {
          webhookEventRecord.payment_id = paymentId;
        }
        if (razorpayOrderId) {
          webhookEventRecord.order_id = razorpayOrderId;
        }
        if (internalOrderId) {
          webhookEventRecord.internal_order_id = internalOrderId;
        }
        await this.webhookEventRepository.save(webhookEventRecord);
      }

      // Handle different webhook events
      try {
        switch (eventType) {
          case "payment.captured":
            await this.handlePaymentCaptured(event, webhookEventRecord);
            break;
          case "payment.failed":
            await this.handlePaymentFailed(event, webhookEventRecord);
            break;
          case "refund.processed":
            await this.handleRefundProcessed(event, webhookEventRecord);
            break;
          // Temporarily commented out - handling only payment events
          // case "order.paid":
          //   await this.handleOrderPaid(event, webhookEventRecord);
          //   break;
          default:
            this.logger.log(`ℹ️ Unhandled webhook event: ${eventType}`);
        }

        // Mark event as processed
        if (webhookEventRecord) {
          webhookEventRecord.processing_status = "processed";
          webhookEventRecord.error_message = null;
          await this.webhookEventRepository.save(webhookEventRecord);
        }

        res.status(200).json({ success: true });
        return;
      } catch (processingError) {
        // Mark event as failed
        if (webhookEventRecord) {
          webhookEventRecord.processing_status = "failed";
          webhookEventRecord.error_message = processingError.message;
          await this.webhookEventRepository.save(webhookEventRecord);
        }

        // Classify error type to determine retry behavior
        const errorMessage = processingError.message?.toLowerCase() || "";
        const isPermanentError =
          // Check for NotFoundException or 404 errors
          processingError instanceof NotFoundException ||
          processingError.status === 404 ||
          // Check error message for permanent error patterns
          errorMessage.includes("not found") ||
          errorMessage.includes("missing") ||
          errorMessage.includes("invalid");

        if (isPermanentError) {
          // Permanent error - return 200 to prevent Razorpay retries
          // Examples: Order not found, invalid event data, missing required fields
          this.logger.warn(
            `⚠️ Permanent error in webhook processing (will not retry): ${processingError.message}`,
          );
          res.status(200).json({
            success: false,
            message: "Webhook processed but failed permanently",
            error: processingError.message,
          });
          return;
        } else {
          // Transient error - re-throw to return 500 and trigger Razorpay retry
          // Examples: Database connection errors, network timeouts, unknown errors
          throw processingError;
        }
      }
    } catch (error) {
      this.logger.error(
        `❌ Error handling webhook: ${error.message}`,
        error.stack,
      );
      res.status(500).json({ error: "Webhook processing failed" });
      return;
    }
  }

  /**
   * Verify payment manually (for mobile app)
   */
  @Post("payment/verify")
  @UseGuards(JwtAuthGuard)
  async verifyPayment(
    @Req() req: any,
    @Body() verifyPaymentDto: VerifyPaymentDto,
  ) {
    const userId = req.user?.id;
    return this.orderService.verifyPayment(userId, verifyPaymentDto);
  }

  private async handlePaymentCaptured(
    event: any,
    webhookEventRecord?: WebhookEvent | null,
  ) {
    try {
      // Validate payload structure
      if (!event?.payload?.payment?.entity) {
        this.logger.error(
          `❌ Invalid payment.captured event payload: missing payment.entity`,
        );
        throw new Error("Invalid webhook payload: missing payment entity");
      }

      const paymentEntity = event.payload.payment.entity;
      const paymentId =
        paymentEntity.id && typeof paymentEntity.id === "string"
          ? paymentEntity.id
          : null;
      const razorpayOrderId =
        paymentEntity.order_id && typeof paymentEntity.order_id === "string"
          ? paymentEntity.order_id
          : null;

      if (!paymentId || !razorpayOrderId) {
        this.logger.error(
          `❌ Missing payment ID or order ID in payment.captured event payload`,
        );
        throw new Error("Missing required payment data in webhook payload");
      }

      this.logger.log(
        `💰 Payment captured: ${paymentId} for Razorpay order: ${razorpayOrderId}`,
      );

      // Find internal order ID from Razorpay order ID
      let order = await this.orderService.findOrderByRazorpayOrderId(
        razorpayOrderId,
      );

      if (!order) {
        // Check if order was already processed by verifyPayment (payment_id was updated from order_id to payment_id)
        // Try to find order by payment ID
        const payment = await this.orderService.findPaymentByRazorpayPaymentId(
          paymentId,
        );
        if (payment?.order) {
          order = payment.order;
          this.logger.log(
            `ℹ️ Order already processed (ID: ${order.id}) via verifyPayment for Razorpay order ID: ${razorpayOrderId}. Updating status.`,
          );
          // Continue with status updates (idempotent operations)
        } else {
          // If still not found, try to find order by order_number from payment description
          // This handles retry scenarios where payment_id was updated to a failed payment ID
          // Payment description format: "Order #ORD-20251220103837-262" or "Order #ORD-20251220-262"
          const paymentDescription = paymentEntity.description || "";
          const orderNumberMatch = paymentDescription.match(/Order #(ORD-\d{8,14}-\d+)/i);
          if (orderNumberMatch && orderNumberMatch[1]) {
            const orderNumber = orderNumberMatch[1];
            order = await this.orderService.findOrderByOrderNumber(orderNumber);
            if (order) {
              this.logger.log(
                `ℹ️ Order found by order number (ID: ${order.id}, Number: ${orderNumber}) for Razorpay order ID: ${razorpayOrderId}. Handling retry scenario.`,
              );
              // Continue with status updates
            }
          }

          if (!order) {
            // Order doesn't exist
            this.logger.warn(
              `⚠️ Order not found for Razorpay order ID: ${razorpayOrderId}. Order may not have been created yet.`,
            );
            // Return success to prevent Razorpay from retrying
            // This can happen if order creation failed or order was deleted
            return;
          }
        }
      }

      // Update order payment status (with idempotency check)
      await this.orderService.updatePaymentStatus(
        order.id,
        "paid",
        paymentId,
      );

      // Update order status to confirmed after payment success
      await this.orderService.updateOrderStatus(order.id, "confirmed");

      // Redeem coupon reservations on payment success; fail webhook processing if redemption is incomplete.
      const redemptionResult =
        await this.orderService.redeemPreorderCouponForOrder(order.id);
      if (!redemptionResult.success) {
        throw new Error(
          `Coupon redemption failed for order ${order.id}. Tokens: ${redemptionResult.failedTokens.join(",")}`,
        );
      }
      // Clear cart for order's user so webhook-only success matches verifyPayment behaviour
      const orderWithUser =
        await this.orderService.getOrderWithUser(order.id);
      if (orderWithUser?.user?.id != null) {
        try {
          await this.cartService.clearCart(orderWithUser.user.id, {
            releaseCouponReservations: false,
          });
          this.logger.log(
            `🗑️ Cart cleared for user ${orderWithUser.user.id} after payment.captured webhook`,
          );
        } catch (clearCartError) {
          this.logger.error(
            `❌ Failed to clear cart after webhook: ${clearCartError.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `❌ Error handling payment captured: ${error.message}`,
        error.stack,
      );
      throw error; // Re-throw to mark webhook event as failed
    }
  }

  private async handlePaymentFailed(
    event: any,
    webhookEventRecord?: WebhookEvent | null,
  ) {
    try {
      // Validate payload structure
      if (!event?.payload?.payment?.entity) {
        this.logger.error(
          `❌ Invalid payment.failed event payload: missing payment.entity`,
        );
        throw new Error("Invalid webhook payload: missing payment entity");
      }

      const paymentEntity = event.payload.payment.entity;
      const paymentId =
        paymentEntity.id && typeof paymentEntity.id === "string"
          ? paymentEntity.id
          : null;
      const razorpayOrderId =
        paymentEntity.order_id && typeof paymentEntity.order_id === "string"
          ? paymentEntity.order_id
          : null;

      if (!paymentId || !razorpayOrderId) {
        this.logger.error(
          `❌ Missing payment ID or order ID in payment.failed event payload`,
        );
        throw new Error("Missing required payment data in webhook payload");
      }

      this.logger.log(
        `❌ Payment failed: ${paymentId} for Razorpay order: ${razorpayOrderId}`,
      );

      // Find internal order ID from Razorpay order ID
      let order = await this.orderService.findOrderByRazorpayOrderId(
        razorpayOrderId,
      );

      if (!order) {
        // Check if order was already processed (payment_id was updated from order_id to payment_id)
        // Try to find order by payment ID
        const payment = await this.orderService.findPaymentByRazorpayPaymentId(
          paymentId,
        );
        if (payment?.order) {
          order = payment.order;
          this.logger.log(
            `ℹ️ Order found via payment ID (ID: ${order.id}) for Razorpay order ID: ${razorpayOrderId}. Payment already processed.`,
          );
          return; // Order already processed, return success
        }

        // If still not found, try to find order by order_number from payment description
        // This handles retry scenarios where payment_id was updated to a failed payment ID
        // Payment description format: "Order #ORD-20251220103837-262"
        const paymentDescription = paymentEntity.description || "";
        const orderNumberMatch = paymentDescription.match(/Order #(ORD-\d{8}-\d+)/i);
        if (orderNumberMatch && orderNumberMatch[1]) {
          const orderNumber = orderNumberMatch[1];
          order = await this.orderService.findOrderByOrderNumber(orderNumber);
          if (order) {
            this.logger.log(
              `ℹ️ Order found by order number (ID: ${order.id}, Number: ${orderNumber}) for Razorpay order ID: ${razorpayOrderId}. Handling retry scenario.`,
            );
            // Continue processing (order found, will update payment status)
          }
        }

        if (!order) {
          // If still not found, order doesn't exist yet
          this.logger.warn(
            `⚠️ Order not found for Razorpay order ID: ${razorpayOrderId}. Order may not have been created yet or payment was already processed.`,
          );
          // Return success to prevent Razorpay from retrying
          // This can happen if order creation failed or order was deleted
          return;
        }
      }

      // Update payment status with payment ID (idempotent)
      await this.orderService.updatePaymentStatus(
        order.id,
        "failed",
        paymentId,
      );

      // Get order with user relation to get user ID for cart reactivation
      const orderWithUser = await this.orderService.getOrderWithUser(order.id);

      if (!orderWithUser || !orderWithUser.user) {
        this.logger.warn(
          `⚠️ Order ${order.id} found but user relation not available. Cart will not be reactivated.`,
        );
        return;
      }

      // Call handlePaymentFailure to restore preorder quota and reactivate cart
      // Note: updatePaymentStatus was already called above, but handlePaymentFailure has idempotency checks
      await this.orderService.handlePaymentFailure(
        orderWithUser.user.id,
        order.id,
        "Payment failed via webhook",
      );
    } catch (error) {
      this.logger.error(
        `❌ Error handling payment failed: ${error.message}`,
        error.stack,
      );
      throw error; // Re-throw to mark webhook event as failed
    }
  }

  private async handleRefundProcessed(
    event: any,
    webhookEventRecord?: WebhookEvent | null,
  ) {
    try {
      // Razorpay refund.processed event structure:
      // event.payload.refund.entity contains refund details
      // event.payload.refund.entity.payment_id contains the payment ID
      // event.payload.refund.entity.amount is in paise
      const refundEntity = event.payload.refund?.entity;

      if (!refundEntity) {
        this.logger.error(
          `❌ Invalid refund.processed event: missing refund entity`,
        );
        throw new Error("Invalid refund.processed event: missing refund entity");
      }

      const refundId = refundEntity.id || null;
      const paymentId = refundEntity.payment_id || null;
      const refundAmount = refundEntity.amount
        ? refundEntity.amount / 100
        : null; // Convert from paise to rupees
      const refundStatus = refundEntity.status || null;

      this.logger.log(
        `💸 Refund processed: Refund ID: ${refundId || "N/A"}, Payment ID: ${paymentId || "N/A"}, Amount: ${refundAmount ? `₹${refundAmount}` : "N/A"}`,
      );

      if (!paymentId) {
        this.logger.error(
          `❌ Refund processed event missing payment_id: ${JSON.stringify(refundEntity)}`,
        );
        throw new Error("Refund processed event missing payment_id");
      }

      // Find order by payment ID (payment_id in Payment table stores Razorpay payment ID)
      const payment = await this.orderService.findPaymentByRazorpayPaymentId(
        paymentId,
      );

      if (!payment || !payment.order) {
        this.logger.warn(
          `⚠️ Payment/Order not found for Razorpay payment ID: ${paymentId}`,
        );
        throw new Error(
          `Payment/Order not found for Razorpay payment ID: ${paymentId}`,
        );
      }

      const order = payment.order;

      // Update order payment status to refunded (with idempotency check)
      await this.orderService.updatePaymentStatus(
        order.id,
        "refunded",
        paymentId,
      );

      // Handle refund-specific logic (e.g., restore preorder quota, update order status)
      await this.orderService.handlePaymentRefunded(
        order.id,
        paymentId,
        refundId,
        refundAmount,
        refundStatus,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error handling refund processed: ${error.message}`,
        error.stack,
      );
      throw error; // Re-throw to mark webhook event as failed
    }
  }

  // Temporarily commented out - handling only payment events
  /*
  private async handleOrderPaid(
    event: any,
    webhookEventRecord?: WebhookEvent | null,
  ) {
    try {
      const razorpayOrderId = event.payload.order.entity.id;

      this.logger.log(
        `✅ Order paid: Razorpay order ID ${razorpayOrderId}`,
      );

      // Find internal order ID from Razorpay order ID
      let order = await this.orderService.findOrderByRazorpayOrderId(
        razorpayOrderId,
      );

      if (!order) {
        // Check if order was already created by payment.captured webhook
        // After payment.captured, payment.payment_id is updated from razorpay_order_id to razorpay_payment_id
        // So we need to find order by payment ID if available in the event
        const paymentId = event.payload?.payment?.entity?.id;
        if (paymentId) {
          const payment = await this.orderService.findPaymentByRazorpayPaymentId(
            paymentId,
          );
          if (payment?.order) {
            order = payment.order;
            this.logger.log(
              `ℹ️ Order already created (ID: ${order.id}) via payment.captured for Razorpay order ID: ${razorpayOrderId}. Order paid event acknowledged.`,
            );
            return; // Order already exists, return success
          }
        }

        // If payment ID not available, check if order was already processed
        // by looking for payment records with paid/success status
        const existingOrder = await this.orderService.findOrderAlreadyProcessed(
          razorpayOrderId,
          paymentId,
        );
        if (existingOrder) {
          this.logger.log(
            `ℹ️ Order already created (ID: ${existingOrder.id}) via payment.captured for Razorpay order ID: ${razorpayOrderId}. Order paid event acknowledged.`,
          );
          return; // Order already exists, return success
        }

        // If still not found, order doesn't exist yet
        this.logger.warn(
          `⚠️ Order not found for Razorpay order ID: ${razorpayOrderId}`,
        );
        throw new Error(
          `Order not found for Razorpay order ID: ${razorpayOrderId}`,
        );
      }

      // Note: Order status update is handled by payment.captured event
      // This event is acknowledged for audit purposes, but no action is needed
      // to prevent redundant processing (payment.captured already updates order status)
      this.logger.log(
        `ℹ️ Order paid event received for order ${order.id}. Status update handled by payment.captured event.`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error handling order paid: ${error.message}`,
        error.stack,
      );
      throw error; // Re-throw to mark webhook event as failed
    }
  }
  */

  @Post("webhook/seller-status")
  @ApiOperation({
    summary: "Seller status update webhook",
    description:
      "Webhook endpoint to receive order status updates from sellers. Supports rich agent tracking data including GPS location, timestamps, and status history. This endpoint validates status transitions and updates order tracking with complete metadata.",
  })
  @ApiBody({
    type: SellerStatusUpdateDto,
    description: "Seller status update payload with optional agent tracking data",
    examples: {
      billed: {
        summary: "Order billed (basic)",
        value: {
          order_number: "ORD-20250102-001",
          status: "billed",
          preparation_time: "PT10M",
          estimated_delivery_time: "2025-01-02T15:30:00Z",
          message: "Order confirmed and billed by seller",
        },
      },
      agentAssigned: {
        summary: "Agent assigned (with full tracking data)",
        value: {
          order_number: "ORD-20250102-001",
          status: "agent-assigned",
          estimated_delivery_time: "2025-01-02T15:30:00Z",
          message: "A delivery partner has been assigned to your order",
          agent_details: {
            name: "Prem Kumar",
            phone: "9360838199",
            timestamps: {
              picked_at: null,
              accepted_at: "2025-01-02T10:15:00.000000Z",
              assigned_at: "2025-01-02T10:15:00.000000Z",
              delivered_at: null,
            },
            status_history: [
              {
                status: "pending",
                timestamp: "2025-01-02T10:14:00.000000Z",
              },
              {
                status: "assigned",
                timestamp: "2025-01-02T10:15:00.000000Z",
              },
            ],
            current_location: {
              lat: 9.9352505,
              lng: 78.1333933,
              accuracy: 13.78,
              updated_at: "2025-01-02T10:15:30.000000Z",
            },
          },
        },
      },
      packed: {
        summary: "Order packed",
        value: {
          order_number: "ORD-20250102-001",
          status: "packed",
          message: "Order packed and ready for pickup",
          agent_details: {
            name: "John Doe",
            phone: "+91-9876543210",
            vehicle_number: "KA-01-AB-1234",
            eta: "15 minutes",
          },
        },
      },
      outForDelivery: {
        summary: "Out for delivery (with live tracking)",
        value: {
          order_number: "ORD-20250102-001",
          status: "out-of-delivery",
          estimated_delivery_time: "2025-01-02T15:45:00Z",
          message: "Your order is on the way",
          agent_details: {
            name: "Prem Kumar",
            phone: "9360838199",
            vehicle_number: "TN-01-XY-5678",
            eta: "10 minutes",
            current_location: {
              lat: 9.9412345,
              lng: 78.1398765,
              accuracy: 8.5,
              updated_at: "2025-01-02T15:35:00.000000Z",
            },
            timestamps: {
              picked_at: "2025-01-02T15:20:00.000000Z",
              accepted_at: "2025-01-02T10:15:00.000000Z",
              assigned_at: "2025-01-02T10:15:00.000000Z",
              delivered_at: null,
            },
          },
        },
      },
      delivered: {
        summary: "Order delivered",
        value: {
          order_number: "ORD-20250102-001",
          status: "delivered",
          message: "Order delivered successfully",
          agent_details: {
            name: "Prem Kumar",
            phone: "9360838199",
            vehicle_number: "TN-01-XY-5678",
            timestamps: {
              picked_at: "2025-01-02T15:20:00.000000Z",
              accepted_at: "2025-01-02T10:15:00.000000Z",
              assigned_at: "2025-01-02T10:15:00.000000Z",
              delivered_at: "2025-01-02T15:45:30.000000Z",
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Status updated successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: {
          type: "string",
          example: "Order status updated successfully",
        },
        order_number: { type: "string", example: "ORD-20250102-001" },
        previous_status: { type: "string", example: "pending" },
        new_status: { type: "string", example: "billed" },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Invalid status transition or validation error",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: {
          type: "string",
          example: "Invalid status transition from pending to delivered",
        },
        error: { type: "string", example: "Bad Request" },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: {
          type: "string",
          example: "Order with number ORD-20250102-001 not found",
        },
        error: { type: "string", example: "Not Found" },
      },
    },
  })
  async updateOrderStatusFromSeller(
    @Body() sellerStatusUpdateDto: SellerStatusUpdateDto,
  ) {
    return this.orderService.updateOrderStatusFromSeller(sellerStatusUpdateDto);
  }

  @Post("webhook/store-status")
  @ApiOperation({
    summary: "Store status update webhook",
    description:
      "Webhook endpoint to receive store status updates from sellers. Supports multiple store updates in a single request. Accepts store_id as either ONDC reference_id (e.g., 'P1', 'P2') or numeric database ID (e.g., '1', '2'). Status is boolean: true to enable the store, false to disable it.",
  })
  @ApiBody({
    type: [StoreStatusUpdateItemDto],
    description: "Store status update payload (array of store updates). Request body should be a direct array.",
    examples: {
      singleEnable: {
        summary: "Single store - Enable",
        description: "Enable a single store using ONDC reference_id",
        value: [
          {
            store_id: "P1",
            status: true,
          },
        ],
      },
      singleDisable: {
        summary: "Single store - Disable",
        description: "Disable a single store using numeric ID with optional message",
        value: [
          {
            store_id: "1",
            status: false,
            message: "Temporarily disabled for maintenance",
          },
        ],
      },
      multipleStores: {
        summary: "Multiple stores - Mixed status",
        description: "Update multiple stores with different statuses in one request",
        value: [
          {
            store_id: "P1",
            status: true,
          },
          {
            store_id: "P2",
            status: false,
            message: "Disabled for inventory update",
          },
          {
            store_id: "3",
            status: true,
          },
        ],
      },
      allEnable: {
        summary: "Multiple stores - All enable",
        description: "Enable multiple stores at once",
        value: [
          {
            store_id: "P1",
            status: true,
          },
          {
            store_id: "P2",
            status: true,
          },
          {
            store_id: "P3",
            status: true,
          },
        ],
      },
      allDisable: {
        summary: "Multiple stores - All disable",
        description: "Disable multiple stores with reasons",
        value: [
          {
            store_id: "P1",
            status: false,
            message: "Holiday closure",
          },
          {
            store_id: "P2",
            status: false,
            message: "Maintenance work",
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Status updated successfully. Response includes results for all stores, with partial failures if any.",
    schema: {
      type: "object",
      properties: {
        success: {
          type: "boolean",
          example: true,
          description: "True if all stores updated successfully, false if any failed",
        },
        message: {
          type: "string",
          example: "All 2 store(s) updated successfully",
        },
        updated: {
          type: "array",
          description: "Array of successfully updated stores",
          items: {
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: { type: "string", example: "Store status updated successfully" },
              store_id: { type: "string", example: "P1" },
              store_name: { type: "string", example: "Restaurant Name" },
              status: { type: "boolean", example: true },
              previous_status: { type: "boolean", example: false },
              new_status: { type: "boolean", example: true },
              seller_message: { type: "string", example: "Store reopened" },
            },
          },
        },
        failed: {
          type: "array",
          description: "Array of failed updates (only present if any failures)",
          items: {
            type: "object",
            properties: {
              store_id: { type: "string", example: "P999" },
              error: { type: "string", example: "Store with ID or reference_id 'P999' not found" },
              status: { type: "number", example: 404 },
            },
          },
        },
        total: { type: "number", example: 2 },
        successful: { type: "number", example: 2 },
        failed_count: { type: "number", example: 0 },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Invalid request or validation error (e.g., invalid status value, missing required fields)",
    schema: {
      type: "object",
      properties: {
        statusCode: { type: "number", example: 400 },
        message: {
          type: "array",
          items: { type: "string" },
          example: ["status must be a boolean value"],
        },
        error: { type: "string", example: "Bad Request" },
      },
    },
  })
  async updateStoreStatusFromSeller(
    @Body() stores: StoreStatusUpdateItemDto[],
  ) {
    // Transform array to DTO format
    const storeStatusUpdateDto: StoreStatusUpdateDto = {
      stores: stores,
    };
    return this.storeService.updateStoreStatusFromSeller(storeStatusUpdateDto);
  }

  @Post("webhook/store-timing-status")
  @ApiOperation({
    summary: "Store timing status webhook",
    description:
      "Webhook endpoint to manage temporary store closures outside normal hours. Updates the store_close_timings table. Does not modify store_timings (regular schedule). Accepts store_id as either ONDC reference_id (e.g., 'P1', 'P2') or numeric database ID (e.g., '1', '2').",
  })
  @ApiBody({
    type: [StoreCloseTimingItemDto],
    description: "Store close timing update payload (array of store updates). Request body should be a direct array.",
    examples: {
      closeStore: {
        summary: "Close store temporarily",
        description: "Close a store temporarily with start and end datetime",
        value: [
          {
            store_id: "P1",
            status: "closed",
            close_start_datetime: "2025-01-10T10:00:00Z",
            close_end_datetime: "2025-01-15T23:59:59Z",
            message: "Temporarily closed for maintenance",
          },
        ],
      },
      closeStoreDefaultStart: {
        summary: "Close store (default start time)",
        description: "Close a store starting now with specified end datetime",
        value: [
          {
            store_id: "P1",
            status: "closed",
            close_end_datetime: "2025-01-15T23:59:59Z",
            message: "Closed for inventory update",
          },
        ],
      },
      reopenStore: {
        summary: "Reopen store",
        description: "Reopen a store by ending active close timings",
        value: [
          {
            store_id: "P1",
            status: "open",
          },
        ],
      },
      closeWithLocation: {
        summary: "Close specific location",
        description: "Close a specific location of a store",
        value: [
          {
            store_id: "P1",
            status: "closed",
            close_start_datetime: "2025-01-10T10:00:00Z",
            close_end_datetime: "2025-01-15T23:59:59Z",
            location_id: 1,
            message: "Location temporarily closed",
          },
        ],
      },
      multipleStores: {
        summary: "Multiple stores",
        description: "Update multiple stores in one request",
        value: [
          {
            store_id: "P1",
            status: "closed",
            close_end_datetime: "2025-01-15T23:59:59Z",
            message: "Maintenance",
          },
          {
            store_id: "P2",
            status: "open",
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Close timing updated successfully. Response includes results for all stores, with partial failures if any.",
    schema: {
      type: "object",
      properties: {
        success: {
          type: "boolean",
          example: true,
          description: "True if all stores updated successfully, false if any failed",
        },
        message: {
          type: "string",
          example: "All 2 store close timing(s) updated successfully",
        },
        updated: {
          type: "array",
          description: "Array of successfully updated stores",
          items: {
            type: "object",
            properties: {
              success: { type: "boolean", example: true },
              message: { type: "string", example: "Store close timing created successfully" },
              store_id: { type: "string", example: "P1" },
              store_name: { type: "string", example: "Restaurant Name" },
              status: { type: "string", example: "closed" },
              close_timing: {
                type: "object",
                description: "Close timing details (null for 'open' status if no active timings)",
                properties: {
                  id: { type: "number", example: 1 },
                  close_start_datetime: { type: "string", example: "2025-01-10T10:00:00Z" },
                  close_end_datetime: { type: "string", example: "2025-01-15T23:59:59Z" },
                  reason: { type: "string", example: "Temporarily closed for maintenance" },
                  location_id: { type: "number", example: 1, nullable: true },
                },
              },
            },
          },
        },
        failed: {
          type: "array",
          description: "Array of failed updates (only present if any failures)",
          items: {
            type: "object",
            properties: {
              store_id: { type: "string", example: "P999" },
              error: { type: "string", example: "Store with ID or reference_id 'P999' not found" },
              status: { type: "number", example: 404 },
            },
          },
        },
        total: { type: "number", example: 2 },
        successful: { type: "number", example: 2 },
        failed_count: { type: "number", example: 0 },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Invalid request or validation error (e.g., missing close_end_datetime for 'closed' status, invalid datetime format)",
    schema: {
      type: "object",
      properties: {
        statusCode: { type: "number", example: 400 },
        message: {
          type: "array",
          items: { type: "string" },
          example: ["close_end_datetime is required when status is 'closed'"],
        },
        error: { type: "string", example: "Bad Request" },
      },
    },
  })
  async updateStoreTimingStatusFromSeller(
    @Body() stores: StoreCloseTimingItemDto[],
  ) {
    // Transform array to DTO format
    const storeCloseTimingDto: StoreCloseTimingDto = {
      stores: stores,
    };
    return this.storeService.updateStoreTimingStatusFromSeller(storeCloseTimingDto);
  }

}
