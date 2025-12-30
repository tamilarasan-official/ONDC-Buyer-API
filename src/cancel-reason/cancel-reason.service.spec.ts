import { Test, TestingModule } from '@nestjs/testing';
import { CancelReasonService } from './cancel-reason.service';

describe('CancelReasonService', () => {
  let service: CancelReasonService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CancelReasonService],
    }).compile();

    service = module.get<CancelReasonService>(CancelReasonService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
