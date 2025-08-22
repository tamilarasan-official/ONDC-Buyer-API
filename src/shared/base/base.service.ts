import { Repository, ObjectLiteral } from 'typeorm';
import { PaginationDto } from '../dto/pagination.dto';
import { PaginationUtil } from '../utils/pagination.util';

export abstract class BaseService<T extends ObjectLiteral> {
  constructor(protected readonly repository: Repository<T>) {}

  /**
   * Find all with pagination
   */
  async findAllWithPagination(
    paginationDto: PaginationDto,
    searchFields: string[] = [],
    defaultSortBy: string = 'createdAt',
    additionalWhere?: any
  ) {
    return PaginationUtil.findWithPagination(
      this.repository,
      paginationDto,
      searchFields,
      defaultSortBy,
      additionalWhere
    );
  }

  /**
   * Find one by ID
   */
  async findOneById(id: number): Promise<T> {
    const entity = await this.repository.findOne({ where: { id } as any });
    if (!entity) {
      throw new Error(`Entity with ID ${id} not found`);
    }
    return entity;
  }

  /**
   * Create entity
   */
  async create(createDto: any): Promise<T> {
    const entity = this.repository.create(createDto);
    return await this.repository.save(entity) as unknown as T;
  }

  /**
   * Update entity
   */
  async update(id: number, updateDto: any): Promise<T> {
    const entity = await this.findOneById(id);
    Object.assign(entity, updateDto);
    return await this.repository.save(entity);
  }

  /**
   * Delete entity
   */
  async remove(id: number): Promise<void> {
    const entity = await this.findOneById(id);
    await this.repository.remove(entity);
  }

  /**
   * Check if entity exists
   */
  async exists(id: number): Promise<boolean> {
    const count = await this.repository.count({ where: { id } as any });
    return count > 0;
  }
} 