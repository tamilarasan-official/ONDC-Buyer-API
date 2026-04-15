import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { CollectionService } from "./collection.service";
import { CreateCollectionDto } from "./dto/create-collection.dto";
import { UpdateCollectionDto } from "./dto/update-collection.dto";
import { PaginationDto } from "../shared/dto/pagination.dto";
import { CollectionFiltersDto } from "./dto/collection-filters.dto";
import { MoveCollectionDto } from "./dto/reorder-collections.dto";

@ApiTags("Collection Management")
@Controller("collection")
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Post()
  @ApiOperation({ summary: "Create collection" })
  create(@Body() dto: CreateCollectionDto) {
    return this.collectionService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: "List collections" })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.collectionService.findAll(paginationDto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get collection by id" })
  @ApiParam({ name: "id", type: Number })
  findOne(@Param("id") id: string) {
    return this.collectionService.findOne(+id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update collection" })
  update(@Param("id") id: string, @Body() dto: UpdateCollectionDto) {
    return this.collectionService.update(+id, dto);
  }

  @Patch(":id/move")
  @ApiOperation({ summary: "Move collection to new sequence position" })
  moveCollection(@Param("id") id: string, @Body() dto: MoveCollectionDto) {
    return this.collectionService.moveCollection(+id, dto.new_position);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete collection" })
  remove(@Param("id") id: string) {
    return this.collectionService.remove(+id);
  }

  @Get(":id/items")
  @ApiOperation({ summary: "Preview collection items for table" })
  @ApiQuery({ name: "lat", required: false, type: Number, example: 9.9252 })
  @ApiQuery({ name: "lng", required: false, type: Number, example: 78.1198 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  previewItems(
    @Param("id") id: string,
    @Query() paginationDto: PaginationDto,
    @Query("lat") lat?: string,
    @Query("lng") lng?: string,
    @Query("limit") limit?: string,
  ) {
    return this.collectionService.previewItems(+id, paginationDto, {
      ...(lat !== undefined ? { user_lat: Number(lat) } : {}),
      ...(lng !== undefined ? { user_lng: Number(lng) } : {}),
      ...(limit !== undefined ? { limit: Number(limit) } : {}),
    });
  }

  @Post("preview")
  @ApiOperation({ summary: "Preview items by filters without saving collection" })
  @ApiBody({ type: CollectionFiltersDto })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  previewByFilters(
    @Body() filters: CollectionFiltersDto,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.collectionService.previewByFilters(filters, paginationDto);
  }
}

