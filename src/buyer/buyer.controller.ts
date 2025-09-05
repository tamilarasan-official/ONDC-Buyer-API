import { Controller, Get, Post, Put, Delete, Query, UseGuards, Req, Param, Body, UnauthorizedException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { BuyerService } from './buyer.service';
import { JwtAuthGuard } from '../authentication/jwt-auth.guard';
import { HomeResponseDto } from './dto/home-response.dto';
import { SearchRequestDto, SearchSuggestionsRequestDto } from './dto/search-request.dto';
import { SearchResponseDto, SearchSuggestionsResponseDto } from './dto/search-response.dto';
import { RestaurantDetailsResponseDto } from './dto/restaurant-details.dto';
import { MenuRequestDto } from './dto/menu-request.dto';
import { MenuResponseDto } from './dto/menu-response.dto';
import { AddToCartDto, UpdateCartItemDto, RemoveFromCartDto, ApplyOfferDto } from './dto/cart-request.dto';
import { CartResponseDto, AddToCartResponseDto, UpdateCartResponseDto, RemoveFromCartResponseDto, ApplyOfferResponseDto } from './dto/cart-response.dto';
import { CreateOrderDto, CreatePaymentDto, VerifyPaymentDto, UpdateOrderStatusDto, CancelOrderDto } from './dto/order-request.dto';
import { CreateOrderResponseDto, OrderResponseDto, OrderListResponseDto, PaymentResponseDto, VerifyPaymentResponseDto } from './dto/order-response.dto';
import { CartService } from './cart.service';
import { OrderService } from './order.service';
import { NotificationService } from './notification.service';
import { ReviewService } from './review.service';

@ApiTags('Buyer App APIs')
@Controller('api/buyer')
export class BuyerController {
  private readonly logger = new Logger(BuyerController.name);
  constructor(
    private readonly buyerService: BuyerService,
    private readonly cartService: CartService,
    private readonly orderService: OrderService,
    private readonly notificationService: NotificationService,
    private readonly reviewService: ReviewService
  ) {}

  @Get('home')
  @ApiOperation({
    summary: 'Get home page data',
    description: 'Retrieve home page data including nearby restaurants, "What\'s On Your Mind?" dishes, and promotional banner. Uses location-based filtering with Haversine formula for distance calculation.',
  })
  @ApiQuery({
    name: 'lat',
    required: false,
    type: String,
    description: 'Device latitude for location-based filtering',
    example: '12.9716'
  })
  @ApiQuery({
    name: 'lng',
    required: false,
    type: String,
    description: 'Device longitude for location-based filtering',
    example: '77.5946'
  })
  @ApiQuery({
    name: 'veg_mode',
    required: false,
    type: Boolean,
    description: 'Filter for vegetarian-only restaurants and items',
    example: false
  })
  @ApiResponse({
    status: 200,
    description: 'Home page data retrieved successfully',
    type: HomeResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid parameters',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Invalid latitude or longitude values' },
        error: { type: 'string', example: 'BAD_REQUEST' }
      }
    }
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Internal server error' },
        error: { type: 'string', example: 'INTERNAL_SERVER_ERROR' }
      }
    }
  })
  async getHomeData(
    @Query('lat') deviceLat?: string,
    @Query('lng') deviceLng?: string,
    @Query('veg_mode') vegMode?: string,
    @Req() req?: any
  ) {
    const userId = req?.user?.id;
    const lat = deviceLat ? parseFloat(deviceLat) : undefined;
    const lng = deviceLng ? parseFloat(deviceLng) : undefined;
    const isVegMode = vegMode === 'true';

    return this.buyerService.getHomeData(userId, lat, lng, isVegMode);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search restaurants, items, and categories',
    description: 'Comprehensive search functionality with location-based filtering. Search across restaurants, food items, and categories with advanced filtering options including distance, rating, price, and category filters.',
  })
  @ApiResponse({
    status: 200,
    description: 'Search completed successfully',
    type: SearchResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid search parameters',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Invalid search parameters' },
        error: { type: 'string', example: 'BAD_REQUEST' }
      }
    }
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Internal server error' },
        error: { type: 'string', example: 'INTERNAL_SERVER_ERROR' }
      }
    }
  })
  async search(
    @Query() searchParams: SearchRequestDto,
    @Req() req?: any
  ) {
    const userId = req?.user?.id;
    return this.buyerService.search(searchParams, userId);
  }

  @Post('search/suggestions')
  @ApiOperation({
    summary: 'Get search suggestions',
    description: 'Get real-time search suggestions based on dishes, restaurants, and categories with advanced filtering. Returns suggestions prioritized by dishes (60%), restaurants (30%), and categories (10%).',
  })
  @ApiBody({ 
    type: SearchSuggestionsRequestDto,
    description: 'Search suggestions request payload with query, location, filters, and limit',
    examples: {
      basic: {
        summary: 'Basic search suggestions',
        description: 'Simple search with just a query string',
        value: {
          query: 'burgl',
          limit: 10
        }
      },
      advanced: {
        summary: 'Advanced search with filters',
        description: 'Search with location and dietary filters',
        value: {
          query: 'pizza',
          location: {
            lat: 12.9716,
            lng: 77.5946
          },
          filters: {
            dietary_preference: 'veg',
            min_price: 100,
            max_price: 500,
            category_id: 1
          },
          limit: 15
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Search suggestions retrieved successfully',
    type: SearchSuggestionsResponseDto,
    content: {
      'application/json': {
        example: {
          success: true,
          message: 'Search suggestions retrieved successfully',
          data: {
            query: 'burgl',
            suggestions: [
              {
                id: 1,
                name: 'Burger',
                type: 'dish',
                description: 'Delicious burgers',
                icon: 'https://example.com/burger-icon.jpg',
                image: 'https://example.com/burger-image.jpg',
                restaurant_count: 15,
                item_count: 25
              },
              {
                id: 2,
                name: 'Burger Palace',
                type: 'restaurant',
                description: 'Best burgers in town',
                icon: 'https://example.com/logo.jpg',
                image: 'https://example.com/logo.jpg',
                restaurant_count: 1,
                item_count: 12
              }
            ],
            total_suggestions: 2
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad request - Invalid query or parameters',
    content: {
      'application/json': {
        example: {
          success: false,
          message: 'Query must be at least 2 characters',
          error: 'BAD_REQUEST'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Internal server error',
    content: {
      'application/json': {
        example: {
          success: false,
          message: 'Internal server error',
          error: 'INTERNAL_SERVER_ERROR'
        }
      }
    }
  })
  async getSearchSuggestions(@Body() request: SearchSuggestionsRequestDto) {
    if (!request.query || request.query.trim().length < 2) {
      throw new BadRequestException('Query must be at least 2 characters');
    }
    return this.buyerService.getSearchSuggestions(request);
  }

  @Get('restaurants/:id')
  @ApiOperation({
    summary: 'Get restaurant details',
    description: 'Get detailed information about a specific restaurant including menu, offers, timings, locations, and statistics.',
  })
  @ApiParam({
    name: 'id',
    description: 'Restaurant ID',
    example: 1,
    type: 'number'
  })
  @ApiQuery({
    name: 'lat',
    required: false,
    type: String,
    description: 'Device latitude for distance calculation',
    example: '12.9716'
  })
  @ApiQuery({
    name: 'lng',
    required: false,
    type: String,
    description: 'Device longitude for distance calculation',
    example: '77.5946'
  })
  @ApiResponse({
    status: 200,
    description: 'Restaurant details retrieved successfully',
    type: RestaurantDetailsResponseDto
  })
  @ApiResponse({
    status: 404,
    description: 'Restaurant not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Restaurant not found' },
        error: { type: 'string', example: 'NOT_FOUND' }
      }
    }
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Internal server error' },
        error: { type: 'string', example: 'INTERNAL_SERVER_ERROR' }
      }
    }
  })
  async getRestaurantDetails(
    @Param('id') restaurantId: string,
    @Query('lat') deviceLat?: string,
    @Query('lng') deviceLng?: string,
    @Req() req?: any
  ) {
    const userId = req?.user?.id;
    const lat = deviceLat ? parseFloat(deviceLat) : undefined;
    const lng = deviceLng ? parseFloat(deviceLng) : undefined;

    return this.buyerService.getRestaurantDetails(parseInt(restaurantId), userId, lat, lng);
  }

  @Get('restaurants/:id/menu')
  @ApiOperation({
    summary: 'Get restaurant menu',
    description: 'Get restaurant menu with categories, items, pricing, customizations, and variants. Supports filtering by category, price range, dietary preferences, and search.',
  })
  @ApiParam({
    name: 'id',
    description: 'Restaurant ID',
    example: 1,
    type: 'number'
  })
  @ApiResponse({
    status: 200,
    description: 'Menu retrieved successfully',
    type: MenuResponseDto
  })
  @ApiResponse({
    status: 404,
    description: 'Restaurant not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Restaurant not found' },
        error: { type: 'string', example: 'NOT_FOUND' }
      }
    }
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Internal server error' },
        error: { type: 'string', example: 'INTERNAL_SERVER_ERROR' }
      }
    }
  })
  async getRestaurantMenu(
    @Param('id') restaurantId: string,
    @Query() menuParams: MenuRequestDto
  ) {
    return this.buyerService.getRestaurantMenu(parseInt(restaurantId), menuParams);
  }

  @Get('cart')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user cart',
    description: 'Retrieve the current user\'s active cart with all items, pricing, and summary.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cart retrieved successfully',
    type: CartResponseDto
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Unauthorized' },
        error: { type: 'string', example: 'UNAUTHORIZED' }
      }
    }
  })
  async getCart(@Req() req: any) {
    const userId = req.user.id;
    return this.cartService.getCart(userId);
  }

  @Post('cart/add')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Add item to cart',
    description: 'Add an item to the user\'s cart with quantity, customizations, and variants.',
  })
  @ApiBody({ type: AddToCartDto })
  @ApiResponse({
    status: 201,
    description: 'Item added to cart successfully',
    type: AddToCartResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid item or insufficient quantity',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Insufficient quantity available' },
        error: { type: 'string', example: 'BAD_REQUEST' }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Item not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Item not found' },
        error: { type: 'string', example: 'NOT_FOUND' }
      }
    }
  })
  async addToCart(@Req() req: any, @Body() addToCartDto: AddToCartDto) {
    const userId = req.user.id;
    return this.cartService.addToCart(userId, addToCartDto);
  }

  @Put('cart/update')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update cart item',
    description: 'Update quantity, customizations, or variants of an existing cart item.',
  })
  @ApiBody({ type: UpdateCartItemDto })
  @ApiResponse({
    status: 200,
    description: 'Cart item updated successfully',
    type: UpdateCartResponseDto
  })
  @ApiResponse({
    status: 404,
    description: 'Cart item not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Cart item not found' },
        error: { type: 'string', example: 'NOT_FOUND' }
      }
    }
  })
  async updateCartItem(@Req() req: any, @Body() updateCartItemDto: UpdateCartItemDto) {
    const userId = req.user.id;
    return this.cartService.updateCartItem(userId, updateCartItemDto);
  }

  @Delete('cart/remove')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Remove item from cart',
    description: 'Remove a specific item from the user\'s cart.',
  })
  @ApiBody({ type: RemoveFromCartDto })
  @ApiResponse({
    status: 200,
    description: 'Item removed from cart successfully',
    type: RemoveFromCartResponseDto
  })
  @ApiResponse({
    status: 404,
    description: 'Cart item not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Cart item not found' },
        error: { type: 'string', example: 'NOT_FOUND' }
      }
    }
  })
  async removeFromCart(@Req() req: any, @Body() removeFromCartDto: RemoveFromCartDto) {
    const userId = req.user.id;
    return this.cartService.removeFromCart(userId, removeFromCartDto);
  }

  @Delete('cart/clear')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Clear cart',
    description: 'Remove all items from the user\'s cart.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cart cleared successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Cart cleared successfully' }
      }
    }
  })
  async clearCart(@Req() req: any) {
    const userId = req.user.id;
    return this.cartService.clearCart(userId);
  }

  @Post('cart/apply-offer')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Apply offer to cart',
    description: 'Apply a discount offer to the user\'s cart using offer code or offer ID.',
  })
  @ApiBody({ type: ApplyOfferDto })
  @ApiResponse({
    status: 200,
    description: 'Offer applied successfully',
    type: ApplyOfferResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Cart is empty or offer not applicable',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Cart is empty' },
        error: { type: 'string', example: 'BAD_REQUEST' }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Offer not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Offer not found or not applicable' },
        error: { type: 'string', example: 'NOT_FOUND' }
      }
    }
  })
  async applyOffer(@Req() req: any, @Body() applyOfferDto: ApplyOfferDto) {
    const userId = req.user.id;
    return this.cartService.applyOffer(userId, applyOfferDto);
  }

  @Post('orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create order from cart',
    description: 'Create a new order from the user\'s active cart with delivery address and payment method.',
  })
  @ApiBody({ type: CreateOrderDto })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully',
    type: CreateOrderResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Cart is empty or invalid data',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Cart is empty' },
        error: { type: 'string', example: 'BAD_REQUEST' }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Delivery address not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Delivery address not found' },
        error: { type: 'string', example: 'NOT_FOUND' }
      }
    }
  })
  async createOrder(@Req() req: any, @Body() createOrderDto: CreateOrderDto) {
    const userId = req.user.id;
    return this.orderService.createOrder(userId, createOrderDto);
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user orders',
    description: 'Retrieve paginated list of user\'s orders with tracking information.',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number',
    example: 1,
    required: false,
    type: 'number'
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of orders per page',
    example: 10,
    required: false,
    type: 'number'
  })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully',
    type: OrderListResponseDto
  })
  async getUserOrders(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const userId = req.user.id;
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    return this.orderService.getUserOrders(userId, pageNum, limitNum);
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get order details',
    description: 'Retrieve detailed information about a specific order including items, tracking, and payment status.',
  })
  @ApiParam({
    name: 'id',
    description: 'Order ID',
    example: 1,
    type: 'number'
  })
  @ApiResponse({
    status: 200,
    description: 'Order retrieved successfully',
    type: OrderResponseDto
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Order not found' },
        error: { type: 'string', example: 'NOT_FOUND' }
      }
    }
  })
  async getOrderById(@Req() req: any, @Param('id') orderId: string) {
    const userId = req.user.id;
    return this.orderService.getOrderById(parseInt(orderId), userId);
  }

  @Post('orders/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancel order',
    description: 'Cancel a pending or confirmed order. Refunds will be processed for paid orders.',
  })
  @ApiParam({
    name: 'id',
    description: 'Order ID',
    example: 1,
    type: 'number'
  })
  @ApiBody({ type: CancelOrderDto })
  @ApiResponse({
    status: 200,
    description: 'Order cancelled successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Order cancelled successfully' }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Order cannot be cancelled',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Order cannot be cancelled' },
        error: { type: 'string', example: 'BAD_REQUEST' }
      }
    }
  })
  async cancelOrder(@Req() req: any, @Param('id') orderId: string, @Body() cancelOrderDto: CancelOrderDto) {
    const userId = req.user.id;
    return this.orderService.cancelOrder(userId, parseInt(orderId), cancelOrderDto);
  }

  @Post('payments/create')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create payment for order',
    description: 'Create a Razorpay payment order for online payment processing.',
  })
  @ApiBody({ type: CreatePaymentDto })
  @ApiResponse({
    status: 201,
    description: 'Payment initiated successfully',
    type: PaymentResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Order already paid or invalid data',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Order is already paid' },
        error: { type: 'string', example: 'BAD_REQUEST' }
      }
    }
  })
  async createPayment(@Req() req: any, @Body() createPaymentDto: CreatePaymentDto) {
    const userId = req.user.id;
    return this.orderService.createPayment(userId, createPaymentDto);
  }

  @Post('payments/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify payment',
    description: 'Verify Razorpay payment signature and update order status.',
  })
  @ApiBody({ type: VerifyPaymentDto })
  @ApiResponse({
    status: 200,
    description: 'Payment verified successfully',
    type: VerifyPaymentResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid payment signature',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Invalid payment signature' },
        error: { type: 'string', example: 'BAD_REQUEST' }
      }
    }
  })
  async verifyPayment(@Req() req: any, @Body() verifyPaymentDto: VerifyPaymentDto) {
    const userId = req.user.id;
    return this.orderService.verifyPayment(userId, verifyPaymentDto);
  }

  // ==================== NOTIFICATION ENDPOINTS ====================

  @Get('notifications')
  @ApiOperation({
    summary: 'Get user notifications',
    description: 'Retrieve user notifications with pagination and filtering options'
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully'
  })
  async getNotifications(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('unread_only') unreadOnly?: string
  ) {
    const userId = req.user?.id;
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 20;
    const unreadOnlyBool = unreadOnly === 'true';
    
    return this.notificationService.getUserNotifications(userId, pageNum, limitNum, type, unreadOnlyBool);
  }

  @Put('notifications/:id/read')
  @ApiOperation({
    summary: 'Mark notification as read',
    description: 'Mark a specific notification as read'
  })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read'
  })
  async markNotificationAsRead(@Req() req: any, @Param('id') notificationId: string) {
    const userId = req.user?.id;
    return this.notificationService.markAsRead(parseInt(notificationId), userId);
  }

  @Put('notifications/read-all')
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description: 'Mark all unread notifications as read for the user'
  })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read'
  })
  async markAllNotificationsAsRead(@Req() req: any) {
    const userId = req.user?.id;
    return this.notificationService.markAllAsRead(userId);
  }

  @Delete('notifications/:id')
  @ApiOperation({
    summary: 'Delete notification',
    description: 'Delete a specific notification'
  })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully'
  })
  async deleteNotification(@Req() req: any, @Param('id') notificationId: string) {
    const userId = req.user?.id;
    return this.notificationService.deleteNotification(parseInt(notificationId), userId);
  }

  @Get('notification-preferences')
  @ApiOperation({
    summary: 'Get notification preferences',
    description: 'Get user notification preferences'
  })
  @ApiResponse({
    status: 200,
    description: 'Notification preferences retrieved successfully'
  })
  async getNotificationPreferences(@Req() req: any) {
    const userId = req.user?.id;
    return this.notificationService.getNotificationPreferences(userId);
  }

  @Put('notification-preferences')
  @ApiOperation({
    summary: 'Update notification preferences',
    description: 'Update user notification preferences'
  })
  @ApiResponse({
    status: 200,
    description: 'Notification preferences updated successfully'
  })
  async updateNotificationPreferences(@Req() req: any, @Body() preferences: any) {
    const userId = req.user?.id;
    return this.notificationService.updateNotificationPreferences(userId, preferences);
  }

  @Post('push-tokens')
  @ApiOperation({
    summary: 'Register device token',
    description: 'Register device token for push notifications'
  })
  @ApiResponse({
    status: 201,
    description: 'Device token registered successfully'
  })
  async registerDeviceToken(@Req() req: any, @Body() tokenData: any) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    try {
      // Validate token with FCM
      const isValid = await this.notificationService.fcm.validateToken(tokenData.device_token);
      if (!isValid) {
        throw new BadRequestException('Invalid device token');
      }

      // Register token in database
      await this.notificationService.registerDeviceToken(
        userId,
        tokenData.device_token,
        tokenData.platform
      );

      return {
        success: true,
        message: 'Device token registered successfully',
        data: {
          device_token: tokenData.device_token,
          platform: tokenData.platform,
          registered_at: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to register device token: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to register device token');
    }
  }

  @Delete('push-tokens/:token')
  @ApiOperation({
    summary: 'Unregister device token',
    description: 'Unregister device token for push notifications'
  })
  @ApiResponse({
    status: 200,
    description: 'Device token unregistered successfully'
  })
  async unregisterDeviceToken(@Req() req: any, @Param('token') deviceToken: string) {
    const userId = req.user?.id;
    return this.notificationService.unregisterDeviceToken(userId, deviceToken);
  }

  @Post('test-push-notification')
  @ApiOperation({
    summary: 'Test push notification (for development)',
    description: 'Send a test push notification to the authenticated user'
  })
  @ApiResponse({
    status: 200,
    description: 'Test notification sent successfully'
  })
  async testPushNotification(@Req() req: any, @Body() body: { message?: string }) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    try {
      await this.notificationService.createNotification({
        user_id: userId,
        title: 'Test Notification',
        message: body.message || 'This is a test push notification',
        type: 'system',
        data: { test: true },
      });

      return {
        success: true,
        message: 'Test notification sent successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to send test notification: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to send test notification');
    }
  }

  // ==================== REVIEW ENDPOINTS ====================

  @Post('reviews/restaurant')
  @ApiOperation({
    summary: 'Create restaurant review',
    description: 'Create a review for a restaurant based on a delivered order'
  })
  @ApiResponse({
    status: 201,
    description: 'Restaurant review created successfully'
  })
  async createRestaurantReview(@Req() req: any, @Body() createReviewDto: any) {
    const userId = req.user?.id;
    return this.reviewService.createRestaurantReview(userId, createReviewDto);
  }

  @Post('reviews/item')
  @ApiOperation({
    summary: 'Create item review',
    description: 'Create a review for a specific item based on a delivered order'
  })
  @ApiResponse({
    status: 201,
    description: 'Item review created successfully'
  })
  async createItemReview(@Req() req: any, @Body() createReviewDto: any) {
    const userId = req.user?.id;
    return this.reviewService.createItemReview(userId, createReviewDto);
  }

  @Get('reviews/restaurant/:restaurantId')
  @ApiOperation({
    summary: 'Get restaurant reviews',
    description: 'Get all reviews for a specific restaurant with pagination'
  })
  @ApiResponse({
    status: 200,
    description: 'Restaurant reviews retrieved successfully'
  })
  async getRestaurantReviews(
    @Param('restaurantId') restaurantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort_by') sortBy?: string,
    @Query('sort_order') sortOrder?: string
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 20;
    const sortOrderEnum = sortOrder === 'ASC' ? 'ASC' : 'DESC';
    
    return this.reviewService.getRestaurantReviews(
      parseInt(restaurantId), 
      pageNum, 
      limitNum, 
      sortBy || 'created_at', 
      sortOrderEnum
    );
  }

  @Get('reviews/item/:itemId')
  @ApiOperation({
    summary: 'Get item reviews',
    description: 'Get all reviews for a specific item with pagination'
  })
  @ApiResponse({
    status: 200,
    description: 'Item reviews retrieved successfully'
  })
  async getItemReviews(
    @Param('itemId') itemId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort_by') sortBy?: string,
    @Query('sort_order') sortOrder?: string
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 20;
    const sortOrderEnum = sortOrder === 'ASC' ? 'ASC' : 'DESC';
    
    return this.reviewService.getItemReviews(
      parseInt(itemId), 
      pageNum, 
      limitNum, 
      sortBy || 'created_at', 
      sortOrderEnum
    );
  }

  @Get('reviews/my')
  @ApiOperation({
    summary: 'Get user reviews',
    description: 'Get all reviews created by the current user with pagination'
  })
  @ApiResponse({
    status: 200,
    description: 'User reviews retrieved successfully'
  })
  async getUserReviews(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string
  ) {
    const userId = req.user?.id;
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 20;
    
    return this.reviewService.getUserReviews(userId, pageNum, limitNum, type as 'restaurant' | 'item');
  }

  @Put('reviews/restaurant/:reviewId')
  @ApiOperation({
    summary: 'Update restaurant review',
    description: 'Update a restaurant review created by the current user'
  })
  @ApiResponse({
    status: 200,
    description: 'Restaurant review updated successfully'
  })
  async updateRestaurantReview(@Req() req: any, @Param('reviewId') reviewId: string, @Body() updateReviewDto: any) {
    const userId = req.user?.id;
    return this.reviewService.updateRestaurantReview(parseInt(reviewId), userId, updateReviewDto);
  }

  @Put('reviews/item/:reviewId')
  @ApiOperation({
    summary: 'Update item review',
    description: 'Update an item review created by the current user'
  })
  @ApiResponse({
    status: 200,
    description: 'Item review updated successfully'
  })
  async updateItemReview(@Req() req: any, @Param('reviewId') reviewId: string, @Body() updateReviewDto: any) {
    const userId = req.user?.id;
    return this.reviewService.updateItemReview(parseInt(reviewId), userId, updateReviewDto);
  }

  @Delete('reviews/restaurant/:reviewId')
  @ApiOperation({
    summary: 'Delete restaurant review',
    description: 'Delete a restaurant review created by the current user'
  })
  @ApiResponse({
    status: 200,
    description: 'Restaurant review deleted successfully'
  })
  async deleteRestaurantReview(@Req() req: any, @Param('reviewId') reviewId: string) {
    const userId = req.user?.id;
    return this.reviewService.deleteRestaurantReview(parseInt(reviewId), userId);
  }

  @Delete('reviews/item/:reviewId')
  @ApiOperation({
    summary: 'Delete item review',
    description: 'Delete an item review created by the current user'
  })
  @ApiResponse({
    status: 200,
    description: 'Item review deleted successfully'
  })
  async deleteItemReview(@Req() req: any, @Param('reviewId') reviewId: string) {
    const userId = req.user?.id;
    return this.reviewService.deleteItemReview(parseInt(reviewId), userId);
  }
}
