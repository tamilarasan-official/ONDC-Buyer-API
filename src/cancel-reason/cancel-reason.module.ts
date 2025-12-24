import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CancelReasonService } from './cancel-reason.service';
import { CancelReasonController } from './cancel-reason.controller';
import { CancelReason } from './entities/cancel-reason.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CancelReason]),
  ],
  controllers: [CancelReasonController],
  providers: [CancelReasonService],
  exports: [CancelReasonService],
})
export class CancelReasonModule {}
