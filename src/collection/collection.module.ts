import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CollectionController } from "./collection.controller";
import { CollectionService } from "./collection.service";
import { Collection } from "./entities/collection.entity";
import { CollectionEntry } from "./entities/collection-entry.entity";
import { Item } from "../item/entities/item.entity";
import { Store } from "../store/entities/store.entity";
import { UploadService } from "../shared/upload.service";
import { StoreTimingModule } from "../shared/store-timing/store-timing.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Collection, CollectionEntry, Item, Store]),
    StoreTimingModule,
  ],
  controllers: [CollectionController],
  providers: [CollectionService, UploadService],
  exports: [CollectionService],
})
export class CollectionModule {}

