import { Test, TestingModule } from '@nestjs/testing';
import { CancelReasonController } from './cancel-reason.controller';
import { CancelReasonService } from './cancel-reason.service';

describe('CancelReasonController', () => {
  let controller: CancelReasonController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CancelReasonController],
      providers: [CancelReasonService],
    }).compile();

    controller = module.get<CancelReasonController>(CancelReasonController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
