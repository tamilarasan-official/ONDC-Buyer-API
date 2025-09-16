import { Controller, Get, Post, Put, Delete, Query, UseGuards, Req, Param, Body, UnauthorizedException, BadRequestException, InternalServerErrorException, Logger, Res } from '@nestjs/common';
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
import { RazorpayService } from './razorpay.service';

@ApiTags('Buyer App APIs')
@Controller('api/buyer')
export class BuyerController {
  private readonly logger = new Logger(BuyerController.name);
  constructor(
    private readonly buyerService: BuyerService,
    private readonly cartService: CartService,
    private readonly orderService: OrderService,
    private readonly notificationService: NotificationService,
    private readonly reviewService: ReviewService,
    private readonly razorpayService: RazorpayService
  ) {}

  @Get('home')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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
  async getSearchSuggestions(@Body() request: SearchSuggestionsRequestDto, @Req() req: any) {
    if (!request.query || request.query.trim().length < 2) {
      throw new BadRequestException('Query must be at least 2 characters');
    }
    const userId = req?.user?.id;
    return this.buyerService.getSearchSuggestions(request, userId);
  }

  @Get('restaurants/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search term to filter items by name',
    example: 'pizza'
  })
  @ApiQuery({
    name: 'dietary_preference',
    required: false,
    type: String,
    description: 'Dietary preference filter',
    enum: ['veg', 'non-veg', 'eggterian'],
    example: 'veg'
  })
  @ApiQuery({
    name: 'include_items',
    required: false,
    type: Boolean,
    description: 'Include categorized items in response',
    example: true
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
    @Query('search') search?: string,
    @Query('dietary_preference') dietaryPreference?: string,
    @Query('include_items') includeItems?: string,
    @Req() req?: any
  ) {
    const userId = req?.user?.id;
    const lat = deviceLat ? parseFloat(deviceLat) : undefined;
    const lng = deviceLng ? parseFloat(deviceLng) : undefined;
    const shouldIncludeItems = includeItems === 'true';

    return this.buyerService.getRestaurantDetails(
      parseInt(restaurantId), 
      userId, 
      lat, 
      lng, 
      shouldIncludeItems,
      search,
      dietaryPreference
    );
  }

  @Get('restaurants/:id/menu')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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

  @Get('items/:id/customizations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get item customizations',
    description: 'Get all available customization options for a specific main item. This endpoint is useful when user clicks "Add to Cart" to show customization options.',
  })
  @ApiParam({
    name: 'id',
    description: 'Main item ID',
    example: 1,
    type: 'number'
  })
  @ApiResponse({
    status: 200,
    description: 'Item customizations retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Item customizations retrieved successfully' },
        data: {
          type: 'object',
          properties: {
            item_id: { type: 'number', example: 1 },
            item_name: { type: 'string', example: 'Mutton Biriyani' },
            has_customizations: { type: 'boolean', example: true },
            customizations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number', example: 1 },
                  name: { type: 'string', example: 'Fish Special' },
                  description: { type: 'string', example: 'Choose your fish preparation' },
                  min_selections: { type: 'number', example: 0 },
                  max_selections: { type: 'number', example: 1 },
                  input_type: { type: 'string', example: 'select' },
                  is_mandatory: { type: 'boolean', example: false },
                  options: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'number', example: 1 },
                        name: { type: 'string', example: 'Fish Raita' },
                        price: { type: 'number', example: 25 },
                        is_default: { type: 'boolean', example: false }
                      }
                    }
                  }
                }
              }
            }
          }
        }
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
  @ApiResponse({
    status: 400,
    description: 'Bad request - Item is not a main item',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Item is not a main item' },
        error: { type: 'string', example: 'BAD_REQUEST' }
      }
    }
  })
  async getItemCustomizations(@Param('id') itemId: string) {
    return this.buyerService.getItemCustomizations(parseInt(itemId));
  }

  @Get('cart')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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
  @ApiBearerAuth('JWT-auth')
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
  @ApiBearerAuth('JWT-auth')
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
  @ApiBearerAuth('JWT-auth')
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
  @ApiBearerAuth('JWT-auth')
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
  @ApiBearerAuth('JWT-auth')
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
  @ApiBearerAuth('JWT-auth')
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
  @ApiBearerAuth('JWT-auth')
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
  @ApiBearerAuth('JWT-auth')
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
  @ApiBearerAuth('JWT-auth')
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
  @ApiBearerAuth('JWT-auth')
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

  @Post('payment/initiate/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Initiate payment for an order',
    description: 'Initiate payment for an order that is in pending_payment status'
  })
  @ApiParam({
    name: 'orderId',
    description: 'Order ID to initiate payment for',
    type: 'number',
    example: 123
  })
  @ApiBody({
    description: 'Customer details for payment',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'John Doe' },
        email: { type: 'string', example: 'john@example.com' },
        phone: { type: 'string', example: '9876543210' }
      },
      required: ['name', 'email', 'phone']
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Payment initiated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Payment initiated successfully' },
        payment_details: {
          type: 'object',
          properties: {
            razorpay_order_id: { type: 'string', example: 'order_29QQoUBi66xm2f' },
            amount: { type: 'number', example: 68564 },
            currency: { type: 'string', example: 'INR' },
            key: { type: 'string', example: 'rzp_test_1DP5mmOlF5G5ag' },
            name: { type: 'string', example: 'Restaurant Name' },
            description: { type: 'string', example: 'Order #ORD-20250115-001' },
            prefill: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'John Doe' },
                email: { type: 'string', example: 'john@example.com' },
                contact: { type: 'string', example: '9876543210' }
              }
            }
          }
        }
      }
    }
  })
  async initiatePayment(@Req() req: any, @Param('orderId') orderId: string, @Body() customerDetails: any) {
    const userId = req.user.id;
    return this.orderService.initiatePayment(userId, parseInt(orderId), customerDetails);
  }

  @Post('payment/failure/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Handle payment failure',
    description: 'Record payment failure and allow retry'
  })
  @ApiParam({
    name: 'orderId',
    description: 'Order ID where payment failed',
    type: 'number',
    example: 123
  })
  @ApiBody({
    description: 'Payment failure details',
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', example: 'Payment declined by bank' }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Payment failure recorded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Payment failure recorded. You can retry payment.' },
        order_id: { type: 'number', example: 123 },
        can_retry: { type: 'boolean', example: true }
      }
    }
  })
  async handlePaymentFailure(@Req() req: any, @Param('orderId') orderId: string, @Body() failureData: any) {
    const userId = req.user.id;
    return this.orderService.handlePaymentFailure(userId, parseInt(orderId), failureData.reason);
  }

  @Get('orders/pending-payment')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get orders pending payment',
    description: 'Retrieve orders that are waiting for payment completion'
  })
  @ApiResponse({
    status: 200,
    description: 'Pending payment orders retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Pending payment orders retrieved successfully' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 123 },
              order_number: { type: 'string', example: 'ORD-20250115-001' },
              status: { type: 'string', example: 'pending_payment' },
              payment_status: { type: 'string', example: 'pending' },
              total_amount: { type: 'number', example: 685.64 }
            }
          }
        },
        count: { type: 'number', example: 2 }
      }
    }
  })
  async getPendingPaymentOrders(@Req() req: any) {
    const userId = req.user.id;
    return this.orderService.getPendingPaymentOrders(userId);
  }


  // ==================== NOTIFICATION ENDPOINTS ====================

  @Get('notifications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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

  /**
   * Razorpay webhook handler
   */
  @Post('webhook/razorpay')
  async handleRazorpayWebhook(@Req() req: any, @Res() res: any) {
    try {
      const signature = req.headers['x-razorpay-signature'];
      const body = JSON.stringify(req.body);

      this.logger.log(`🔔 Received Razorpay webhook`);

      // Verify webhook signature
      const isValid = this.razorpayService.verifyWebhookSignature(body, signature);
      
      if (!isValid) {
        this.logger.warn(`❌ Invalid webhook signature`);
        return res.status(400).json({ error: 'Invalid signature' });
      }

      const event = req.body;
      this.logger.log(`📨 Webhook event: ${event.event}`);

      // Handle different webhook events
      switch (event.event) {
        case 'payment.captured':
          await this.handlePaymentCaptured(event);
          break;
        case 'payment.failed':
          await this.handlePaymentFailed(event);
          break;
        case 'order.paid':
          await this.handleOrderPaid(event);
          break;
        default:
          this.logger.log(`ℹ️ Unhandled webhook event: ${event.event}`);
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      this.logger.error(`❌ Error handling webhook: ${error.message}`, error.stack);
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Verify payment manually (for mobile app)
   */
  @Post('payment/verify')
  @UseGuards(JwtAuthGuard)
  async verifyPayment(@Req() req: any, @Body() verifyPaymentDto: VerifyPaymentDto) {
    const userId = req.user?.id;
    return this.orderService.verifyPayment(userId, verifyPaymentDto);
  }

  private async handlePaymentCaptured(event: any) {
    try {
      const paymentId = event.payload.payment.entity.id;
      const orderId = event.payload.payment.entity.order_id;
      
      this.logger.log(`💰 Payment captured: ${paymentId} for order: ${orderId}`);
      
      // Update order payment status
      await this.orderService.updatePaymentStatus(parseInt(orderId), 'paid', paymentId);
      
    } catch (error) {
      this.logger.error(`❌ Error handling payment captured: ${error.message}`, error.stack);
    }
  }

  private async handlePaymentFailed(event: any) {
    try {
      const paymentId = event.payload.payment.entity.id;
      const orderId = event.payload.payment.entity.order_id;
      
      this.logger.log(`❌ Payment failed: ${paymentId} for order: ${orderId}`);
      
      // Update order payment status
      await this.orderService.updatePaymentStatus(parseInt(orderId), 'failed', paymentId);
      
    } catch (error) {
      this.logger.error(`❌ Error handling payment failed: ${error.message}`, error.stack);
    }
  }

  private async handleOrderPaid(event: any) {
    try {
      const orderId = event.payload.order.entity.id;
      
      this.logger.log(`✅ Order paid: ${orderId}`);
      
      // Update order status
      await this.orderService.updateOrderStatus(parseInt(orderId), 'confirmed');
      
    } catch (error) {
      this.logger.error(`❌ Error handling order paid: ${error.message}`, error.stack);
    }
  }

}
