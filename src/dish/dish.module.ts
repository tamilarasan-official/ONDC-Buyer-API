import { Module } from "@nestjs/common";
import { DishService } from "./dish.service";
import { DishController } from "./dish.controller";
import { Dish } from "./entities/dish.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UploadService } from "src/shared/upload.service";
import { GuestSession } from "src/authentication/entities/guest-session.entity";
import { GuestOrUserAuthGuard } from "src/authentication/guest-or-user-auth.guard";

@Module({
  imports: [TypeOrmModule.forFeature([Dish, GuestSession])],
  controllers: [DishController],
  providers: [DishService, UploadService, GuestOrUserAuthGuard],
  exports: [DishService],
})
export class DishModule {}
