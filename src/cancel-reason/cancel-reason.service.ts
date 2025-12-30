import { Injectable } from '@nestjs/common';
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
    const orderCancelReason = this.orderCancelReasonRepository.create(
      createCancelReasonDto,
    );

    const storedReason =
      this.orderCancelReasonRepository.save(orderCancelReason);

    return {
      success: true,
      message: "Order cancel reason created successfully",
      stored_reason: storedReason,
    };
  }

  async findAll() {
    const reasons = await this.orderCancelReasonRepository.find();
    return {
      success: true,
      message: "Order cancel reasons retrieved successfully",
      stored_reason: reasons,
    };
  }

  async findOne(id: number) {
    const reason = await this.orderCancelReasonRepository.findOne({
      where: { id },
    });
    if (!reason) {
      return {
        success: false,
        message: "Order cancel reason not found",
        statusCode: 404
      };
    }
    return {
      success: true,
      message: "Order cancel reason retrieved successfully",
      stored_reason: reason,
    };
  }

  async update(
    id: number,
    updateOrderCancelReasonDto: UpdateCancelReasonDto,
  ) {
    const reason = await this.orderCancelReasonRepository.findOne({
      where: { id },
    });
    if (!reason) {
      return { success: false, message: 'Order cancel reason not found', statusCode: 404};
    }

    Object.assign(reason, updateOrderCancelReasonDto);
    const updatedReason = await this.orderCancelReasonRepository.save(reason);

    return {
      success: true,
      message: "Order cancel reason updated successfully",
      stored_reason: updatedReason,
    };
  }

  async remove(id: number) {
    const reason = await this.orderCancelReasonRepository.findOne({
      where: { id },
    });
    if (!reason) {
      return {success: false, message: 'Order cancel reason not found', statusCode: 404};
    }

    this.orderCancelReasonRepository.delete(id);

    return {
      success: true,
      message: 'Order cancel reason deleted successfully',
      statusCode: 200,
    };
  }
}
