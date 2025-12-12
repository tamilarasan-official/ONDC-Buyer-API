import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { FavoritesService } from "./favorites.service";
import { JwtAuthGuard } from "../authentication/jwt-auth.guard";
import {
  AllFavoritesResponseDto,
  FavoriteItemDto,
  FavoriteRestaurantDto,
  FavoriteStatusDto,
  ToggleFavoriteResponseDto,
} from "./dto/favorites.dto";

@ApiTags("Favorites")
@Controller("api/buyer/favorites")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  // ==================== ITEMS ====================

  @Post("items/:itemId")
  @ApiOperation({
    summary: "Toggle item favorite",
    description:
      "Add or remove an item from user favorites. If item is already favorited, it will be removed. If not favorited, it will be added.",
  })
  @ApiParam({
    name: "itemId",
    description: "Item ID to toggle favorite",
    example: 123,
    type: "number",
  })
  @ApiResponse({
    status: 200,
    description: "Favorite toggled successfully",
    type: ToggleFavoriteResponseDto,
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
  async toggleFavoriteItem(@Req() req: any, @Param("itemId") itemId: number) {
    const userId = req.user?.id;
    return this.favoritesService.toggleFavoriteItem(userId, +itemId);
  }

  @Get("items")
  @ApiOperation({
    summary: "Get all favorite items",
    description:
      "Retrieve all items favorited by the authenticated user, with optional location for distance calculation. Returns empty array if favorites feature is not available.",
  })
  @ApiQuery({
    name: "lat",
    required: false,
    type: Number,
    description: "User latitude for distance calculation",
    example: 9.93523,
  })
  @ApiQuery({
    name: "lng",
    required: false,
    type: Number,
    description: "User longitude for distance calculation",
    example: 78.130404,
  })
  @ApiResponse({
    status: 200,
    description: "Favorite items retrieved successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: {
          type: "string",
          example: "Favorite items retrieved successfully",
        },
        data: {
          type: "array",
          items: { $ref: "#/components/schemas/FavoriteItemDto" },
        },
      },
    },
  })
  async getFavoriteItems(
    @Req() req: any,
    @Query("lat") lat?: string,
    @Query("lng") lng?: string,
  ) {
    const userId = req.user?.id;
    const userLat = lat ? parseFloat(lat) : undefined;
    const userLng = lng ? parseFloat(lng) : undefined;
    return this.favoritesService.getFavoriteItems(userId, userLat, userLng);
  }

  @Get("items/:itemId/check")
  @ApiOperation({
    summary: "Check if item is favorited",
    description: "Check if a specific item is in the user favorites. Returns false if favorites feature is not available.",
  })
  @ApiParam({
    name: "itemId",
    description: "Item ID to check",
    example: 123,
    type: "number",
  })
  @ApiResponse({
    status: 200,
    description: "Favorite status retrieved",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            is_favorite: { type: "boolean", example: true },
            favorited_at: {
              type: "string",
              example: "2025-01-15T10:30:00Z",
              nullable: true,
            },
          },
        },
      },
    },
  })
  async checkItemFavorite(@Req() req: any, @Param("itemId") itemId: number) {
    const userId = req.user?.id;
    return this.favoritesService.checkItemFavorite(userId, +itemId);
  }

  // ==================== RESTAURANTS ====================

  @Post("restaurants/:storeId")
  @ApiOperation({
    summary: "Toggle restaurant favorite",
    description:
      "Add or remove a restaurant from user favorites. If restaurant is already favorited, it will be removed. If not favorited, it will be added.",
  })
  @ApiParam({
    name: "storeId",
    description: "Restaurant/Store ID to toggle favorite",
    example: 14,
    type: "number",
  })
  @ApiResponse({
    status: 200,
    description: "Favorite toggled successfully",
    type: ToggleFavoriteResponseDto,
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
  async toggleFavoriteRestaurant(
    @Req() req: any,
    @Param("storeId") storeId: number,
  ) {
    const userId = req.user?.id;
    return this.favoritesService.toggleFavoriteRestaurant(userId, +storeId);
  }

  @Get("restaurants")
  @ApiOperation({
    summary: "Get all favorite restaurants",
    description:
      "Retrieve all restaurants favorited by the authenticated user, with optional location for distance calculation. Returns empty array if favorites feature is not available.",
  })
  @ApiQuery({
    name: "lat",
    required: false,
    type: Number,
    description: "User latitude for distance calculation",
    example: 9.93523,
  })
  @ApiQuery({
    name: "lng",
    required: false,
    type: Number,
    description: "User longitude for distance calculation",
    example: 78.130404,
  })
  @ApiResponse({
    status: 200,
    description: "Favorite restaurants retrieved successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: {
          type: "string",
          example: "Favorite restaurants retrieved successfully",
        },
        data: {
          type: "array",
          items: { $ref: "#/components/schemas/FavoriteRestaurantDto" },
        },
      },
    },
  })
  async getFavoriteRestaurants(
    @Req() req: any,
    @Query("lat") lat?: string,
    @Query("lng") lng?: string,
  ) {
    const userId = req.user?.id;
    const userLat = lat ? parseFloat(lat) : undefined;
    const userLng = lng ? parseFloat(lng) : undefined;
    return this.favoritesService.getFavoriteRestaurants(
      userId,
      userLat,
      userLng,
    );
  }

  @Get("restaurants/:storeId/check")
  @ApiOperation({
    summary: "Check if restaurant is favorited",
    description: "Check if a specific restaurant is in the user favorites. Returns false if favorites feature is not available.",
  })
  @ApiParam({
    name: "storeId",
    description: "Restaurant/Store ID to check",
    example: 14,
    type: "number",
  })
  @ApiResponse({
    status: 200,
    description: "Favorite status retrieved",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        data: {
          type: "object",
          properties: {
            is_favorite: { type: "boolean", example: true },
            favorited_at: {
              type: "string",
              example: "2025-01-15T10:30:00Z",
              nullable: true,
            },
          },
        },
      },
    },
  })
  async checkRestaurantFavorite(
    @Req() req: any,
    @Param("storeId") storeId: number,
  ) {
    const userId = req.user?.id;
    return this.favoritesService.checkRestaurantFavorite(userId, +storeId);
  }

  // ==================== COMBINED ====================

  @Get("all")
  @ApiOperation({
    summary: "Get all favorites",
    description:
      "Retrieve all favorites (both items and restaurants) for the authenticated user in a single response, grouped by type. Returns empty arrays if favorites feature is not available.",
  })
  @ApiQuery({
    name: "lat",
    required: false,
    type: Number,
    description: "User latitude for distance calculation",
    example: 9.93523,
  })
  @ApiQuery({
    name: "lng",
    required: false,
    type: Number,
    description: "User longitude for distance calculation",
    example: 78.130404,
  })
  @ApiResponse({
    status: 200,
    description: "All favorites retrieved successfully",
    type: AllFavoritesResponseDto,
  })
  async getAllFavorites(
    @Req() req: any,
    @Query("lat") lat?: string,
    @Query("lng") lng?: string,
  ) {
    const userId = req.user?.id;
    const userLat = lat ? parseFloat(lat) : undefined;
    const userLng = lng ? parseFloat(lng) : undefined;
    return this.favoritesService.getAllFavorites(userId, userLat, userLng);
  }
}
