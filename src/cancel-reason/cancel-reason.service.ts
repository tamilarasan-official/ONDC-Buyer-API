import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateCancelReasonDto } from './dto/create-cancel-reason.dto';
import { UpdateCancelReasonDto } from './dto/update-cancel-reason.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { CancelReason } from './entities/cancel-reason.entity';
import { Repository } from 'typeorm';

@Injectable()
export class CancelReasonService {
  constructor(
    @InjectRepository(CancelReason)
    private readonly orderCancelReasonRepository: Repository<CancelReason>,
  ) { }

  async create(createCancelReasonDto: CreateCancelReasonDto) {
    try {
      const orderCancelReason = this.orderCancelReasonRepository.create(
        createCancelReasonDto,
      );

      const storedReason =
        await this.orderCancelReasonRepository.save(orderCancelReason);

      return storedReason;
    } catch (error) {
      throw new BadRequestException(
        'Failed to create cancel reason. Please check your data and try again.',
      );
    }
  }

  async findAll() {
    try {
      const reasons = await this.orderCancelReasonRepository.find({
        order: { created_at: 'ASC' },
        select: ['code', 'reason', 'is_rto', 'is_part_cancel', 'cancelled_by'],
        where: { is_active: true },
      });

      return reasons;
    } catch (error) {
      throw new BadRequestException('Failed to retrieve cancel reasons.');
    }
  }

  async findOne(id: number) {
    try {
      const reason = await this.orderCancelReasonRepository.findOne({
        where: { id, is_active: true },
        select: ['code', 'reason', 'is_rto', 'is_part_cancel','cancelled_by'],
      });

      if (!reason) {
        throw new NotFoundException('Cancel reason not found');
      }

      return reason;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to retrieve cancel reason.');
    }
  }

  async update(
    id: number,
    updateOrderCancelReasonDto: UpdateCancelReasonDto,
  ) {
    try {
      const reason = await this.orderCancelReasonRepository.findOne({
        where: { id },
      });

      if (!reason) {
        throw new NotFoundException('Cancel reason not found');
      }

      Object.assign(reason, updateOrderCancelReasonDto);
      const updatedReason = await this.orderCancelReasonRepository.save(reason);

      return updatedReason;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to update cancel reason. Please check your data and try again.',
      );
    }
  }

  async remove(id: number) {
    try {
      const reason = await this.orderCancelReasonRepository.findOne({
        where: { id },
      });

      if (!reason) {
        throw new NotFoundException('Cancel reason not found');
      }

      await this.orderCancelReasonRepository.delete(id);

      return { message: 'Cancel reason deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete cancel reason.');
    }
  }
}
