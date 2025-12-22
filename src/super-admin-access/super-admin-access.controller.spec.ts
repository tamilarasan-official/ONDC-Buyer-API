import { Test, TestingModule } from '@nestjs/testing';
import { AdminAccessController } from './super-admin-access.controller';
import { AdminAccessService } from './super-admin-access.service';

describe('AdminAccessController', () => {
  let controller: AdminAccessController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAccessController],
      providers: [AdminAccessService],
    }).compile();

    controller = module.get<AdminAccessController>(AdminAccessController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
