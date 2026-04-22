import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { CollectionService } from "./collection.service";
import { CreateCollectionDto } from "./dto/create-collection.dto";
import { UpdateCollectionDto } from "./dto/update-collection.dto";
import { PaginationDto } from "../shared/dto/pagination.dto";
import { MoveCollectionDto } from "./dto/reorder-collections.dto";
import { AddCollectionEntriesDto } from "./dto/add-collection-entries.dto";
import { ReorderCollectionEntriesDto } from "./dto/reorder-collection-entries.dto";

@ApiTags("Collection Management")
@Controller("collection")
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Post()
  @UseInterceptors(FileInterceptor("image"))
  @ApiOperation({ summary: "Create collection" })
  create(
    @Body() dto: CreateCollectionDto,
    @UploadedFile() imageFile?: Express.Multer.File,
  ) {
    if (imageFile && !["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(imageFile.mimetype)) {
      throw new BadRequestException("Invalid image type. Only JPG, PNG, and WebP are allowed.");
    }
    return this.collectionService.create(dto, imageFile);
  }

  @Get()
  @ApiOperation({ summary: "List collections" })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.collectionService.findAll(paginationDto);
  }

  @Get("options/stores")
  @ApiOperation({ summary: "List selectable stores for collection entries" })
  findSelectableStores(@Query() paginationDto: PaginationDto) {
    return this.collectionService.listSelectableStores(paginationDto);
  }

  @Get("options/items")
  @ApiOperation({ summary: "List selectable items for collection entries" })
  @ApiQuery({ name: "store_id", required: false, type: Number })
  findSelectableItems(
    @Query() paginationDto: PaginationDto,
    @Query("store_id") storeId?: string,
  ) {
    return this.collectionService.listSelectableItems(
      Number(storeId || 0),
      paginationDto,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Get collection by id" })
  @ApiParam({ name: "id", type: Number })
  findOne(@Param("id") id: string) {
    return this.collectionService.findOne(+id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update collection" })
  @UseInterceptors(FileInterceptor("image"))
  update(
    @Param("id") id: string,
    @Body() dto: UpdateCollectionDto,
    @UploadedFile() imageFile?: Express.Multer.File,
  ) {
    if (imageFile && !["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(imageFile.mimetype)) {
      throw new BadRequestException("Invalid image type. Only JPG, PNG, and WebP are allowed.");
    }
    return this.collectionService.update(+id, dto, imageFile);
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
  @ApiOperation({ summary: "Get resolved collection entities for table" })
  @ApiQuery({ name: "lat", required: false, type: Number, example: 9.9252 })
  @ApiQuery({ name: "lng", required: false, type: Number, example: 78.1198 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  previewItems(
    @Param("id") id: string,
    @Query() paginationDto: PaginationDto,
    @Query("lat") lat?: string,
    @Query("lng") lng?: string,
  ) {
    return this.collectionService.previewItems(+id, paginationDto, {
      ...(lat !== undefined ? { user_lat: Number(lat) } : {}),
      ...(lng !== undefined ? { user_lng: Number(lng) } : {}),
    });
  }

  @Post(":id/entries")
  @ApiOperation({ summary: "Add entries to a collection" })
  addEntries(
    @Param("id") id: string,
    @Body() dto: AddCollectionEntriesDto,
  ) {
    return this.collectionService.addEntries(+id, dto.entity_ids);
  }

  @Get(":id/entries")
  @ApiOperation({ summary: "List collection entries" })
  getEntries(@Param("id") id: string) {
    return this.collectionService.getEntries(+id);
  }

  @Patch(":id/entries/reorder")
  @ApiOperation({ summary: "Reorder entries in collection" })
  reorderEntries(
    @Param("id") id: string,
    @Body() dto: ReorderCollectionEntriesDto,
  ) {
    return this.collectionService.reorderEntries(+id, dto.entries);
  }

  @Delete(":id/entries/:entryId")
  @ApiOperation({ summary: "Remove a collection entry" })
  removeEntry(@Param("id") id: string, @Param("entryId") entryId: string) {
    return this.collectionService.removeEntry(+id, +entryId);
  }
}

