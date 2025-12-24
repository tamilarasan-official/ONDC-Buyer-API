import { PartialType } from '@nestjs/swagger';
import { CreateCancelReasonDto } from './create-cancel-reason.dto';

export class UpdateCancelReasonDto extends PartialType(
  CreateCancelReasonDto,
) {}
