import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoritesService } from './favorites.service';
import { FavoritesController } from './favorites.controller';
import { UserFavoriteItem } from './entities/user-favorite-item.entity';
import { UserFavoriteRestaurant } from './entities/user-favorite-restaurant.entity';
import { Item } from '../item/entities/item.entity';
import { Store } from '../store/entities/store.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserFavoriteItem,
      UserFavoriteRestaurant,
      Item,
      Store,
    ]),
  ],
  controllers: [FavoritesController],
  providers: [FavoritesService],
  exports: [FavoritesService],
})
export class FavoritesModule {}
