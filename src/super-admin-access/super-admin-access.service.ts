import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { CreateAdminAccessDto } from './dto/create-admin-access.dto';
import { UpdateAdminAccessDto } from './dto/update-admin-access.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { AdminAccess } from './entities/super-admin-access.entity';
import { Repository } from 'typeorm';
import { AdminAccessLog } from './entities/super-admin-log.entity';

@Injectable()
export class AdminAccessService {
  constructor(
    @InjectRepository(AdminAccess)
    private readonly adminAccessRepo: Repository<AdminAccess>,

    @InjectRepository(AdminAccessLog)
    private readonly adminAccessLogRepository: Repository<AdminAccessLog>
  ) { }

  async create(dto: CreateAdminAccessDto): Promise<AdminAccess> {
    const exists = await this.adminAccessRepo.findOne({
      where: [{ slug: dto.slug }],
    });

    if (exists) {
      throw new ConflictException('Slug already exists');
    }

    const adminAccess = this.adminAccessRepo.create({
      ...dto,
      api_key: this.generateApiKey(),
    });

    return this.adminAccessRepo.save(adminAccess);
  }

  async findAll(): Promise<AdminAccess[]> {
    return this.adminAccessRepo.find({
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number): Promise<AdminAccess> {
    const record = await this.adminAccessRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Admin access not found');
    return record;
  }

  async update(
    id: number,
    dto: UpdateAdminAccessDto,
  ): Promise<AdminAccess> {
    const record = await this.findOne(id);
    Object.assign(record, dto);
    return this.adminAccessRepo.save(record);
  }

  async regenerateApiKey(id: number): Promise<{ api_key: string }> {
    const record = await this.findOne(id);

    record.api_key = this.generateApiKey();
    record.push_count = 0;

    await this.adminAccessRepo.save(record);

    return { api_key: record.api_key };
  }

  async disable(id: number): Promise<void> {
    const record = await this.findOne(id);
    record.active = false;
    await this.adminAccessRepo.save(record);
  }

  async validateApiKey(apiKey: string): Promise<AdminAccess> {
    const record = await this.adminAccessRepo.findOne({
      where: {
        api_key: apiKey,
        active: true,
      },
    });

    if (!record) {
      throw new NotFoundException('Invalid or inactive API key');
    }

    // Update usage metrics
    record.last_push_at = new Date();
    record.push_count = Number(record.push_count) + 1;

    await this.adminAccessRepo.save(record);

    return record;
  }

  private generateApiKey(prefix = 'adm'): string {
    return `${prefix}_${randomBytes(24).toString('hex')}`;
  }

  async createLog(
    role: string | undefined,
    key: string,
    is_active: boolean,
  ) {
    await this.adminAccessLogRepository.save({
      role,
      history: [{ key, is_active }],
    });
  }


}
