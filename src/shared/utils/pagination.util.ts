import { Repository, SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { PaginationDto, PaginationOptions, PaginatedResponse } from '../dto/pagination.dto';

export class PaginationUtil {
  /**
   * Build pagination options from DTO
   */
  static buildPaginationOptions(paginationDto: PaginationDto): PaginationOptions {
    const page = paginationDto.page || 1;
    const limit = paginationDto.limit || 10;
    const skip = (page - 1) * limit;

    // Parse relations string to array
    const relations = paginationDto.relations 
      ? paginationDto.relations.split(',').map(r => r.trim())
      : undefined;

    return {
      page,
      limit,
      skip,
      search: paginationDto.search,
      sortBy: paginationDto.sortBy,
      sortOrder: paginationDto.sortOrder || 'DESC',
      status: paginationDto.status,
      relations,
    };
  }

  /**
   * Apply pagination to a query builder
   */
  static applyPagination<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    options: PaginationOptions,
    searchFields: string[] = [],
    defaultSortBy: string = 'createdAt'
  ): SelectQueryBuilder<T> {
    // Apply relations if provided
    if (options.relations && options.relations.length > 0) {
      options.relations.forEach(relation => {
        queryBuilder.leftJoinAndSelect(`entity.${relation}`, relation);
      });
    }
    if (options.search && searchFields.length > 0) {
      const searchConditions = searchFields.map(field => {
        // Ensure the field includes the table alias
        const fieldWithAlias = field.includes('.') ? field : `entity.${field}`;
        return `LOWER(${fieldWithAlias}) LIKE LOWER(:search)`;
      });
      queryBuilder.andWhere(`(${searchConditions.join(' OR ')})`, {
        search: `%${options.search}%`
      });
    }

    if (options.status !== undefined) {
      queryBuilder.andWhere('entity.status = :status', { status: options.status });
    }

    const sortBy = options.sortBy || defaultSortBy;
    // Ensure the sort field includes the table alias
    const sortField = sortBy.includes('.') ? sortBy : `entity.${sortBy}`;
    queryBuilder.orderBy(sortField, options.sortOrder);

    queryBuilder.skip(options.skip).take(options.limit);

    return queryBuilder;
  }

  /**
   * Create paginated response
   */
  static createPaginatedResponse<T>(
    data: T[],
    total: number,
    options: PaginationOptions
  ): PaginatedResponse<T> {
    const totalPages = Math.ceil(total / options.limit);
    const hasNext = options.page < totalPages;
    const hasPrev = options.page > 1;

    return {
      data,
      meta: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages,
        hasNext,
        hasPrev,
      },
    };
  }

  /**
   * Generic paginated find method for repositories
   */
  static async findWithPagination<T extends ObjectLiteral>(
    repository: Repository<T>,
    paginationDto: PaginationDto,
    searchFields: string[] = [],
    defaultSortBy: string = 'createdAt',
    additionalWhere: any = { '1': 1 }, // Default condition
    defaultRelations: string[] = []
  ): Promise<PaginatedResponse<T>> {
    const options = this.buildPaginationOptions(paginationDto);
    
    // Merge default relations with requested relations
    if (defaultRelations.length > 0) {
      options.relations = [...(options.relations || []), ...defaultRelations];
    }
    
    const queryBuilder = repository.createQueryBuilder('entity');

    // Apply additional where conditions (default is 1 = 1)
    Object.keys(additionalWhere).forEach(key => {
      queryBuilder.andWhere(`${key} = :${key}`, { [key]: additionalWhere[key] });
    });

    this.applyPagination(queryBuilder, options, searchFields, defaultSortBy);

    const [data, total] = await queryBuilder.getManyAndCount();

    return this.createPaginatedResponse(data, total, options);
  }
} 