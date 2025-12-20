import { Test, TestingModule } from '@nestjs/testing';
import { AdminAccessService } from './super-admin-access.service';

describe('AdminAccessService', () => {
  let service: AdminAccessService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminAccessService],
    }).compile();

    service = module.get<AdminAccessService>(AdminAccessService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
