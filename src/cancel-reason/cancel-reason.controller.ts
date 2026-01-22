import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CancelReasonService } from './cancel-reason.service';
import { CreateCancelReasonDto } from './dto/create-cancel-reason.dto';
import { UpdateCancelReasonDto } from './dto/update-cancel-reason.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';

@ApiTags("Cancel Reason")
@Controller('cancel-reason')
export class CancelReasonController {
  constructor(private readonly cancelReasonService: CancelReasonService) { }

  @Post()
  @ApiOperation({
    summary: 'Create a new cancel reason',
    description: 'Admin endpoint to create a new cancellation reason. Requires admin authentication.'
  })
  @ApiBody({ type: CreateCancelReasonDto })
  @ApiResponse({
    status: 201,
    description: 'Cancel reason created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        statusCode: { type: 'number', example: 201 },
        message: { type: 'string', example: 'Request successful' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            code: { type: 'string', example: '106' },
            reason: { type: 'string', example: 'Restaurant closed' },
            is_rto: { type: 'boolean', example: false },
            is_part_cancel: { type: 'boolean', example: false },
            cancelled_by: { type: 'string', example: 'seller' },
            is_active: { type: 'boolean', example: true },
            created_at: { type: 'string', example: '2026-01-17T17:02:38.168Z' },
            updated_at: { type: 'string', example: '2026-01-17T17:02:38.168Z' }
          }
        },
        timestamp: { type: 'string', example: '2026-01-17T17:02:38.168Z' }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Failed to create cancel reason. Please check your data and try again.' },
        timestamp: { type: 'string', example: '2026-01-17T17:02:38.168Z' }
      }
    }
  })
  create(@Body() createCancelReasonDto: CreateCancelReasonDto) {
    console.log('createCancelReasonDto: ', createCancelReasonDto);
    return this.cancelReasonService.create(createCancelReasonDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all active cancel reasons',
    description: 'Public endpoint to retrieve all active cancellation reasons. Returns only buyer-relevant fields (code, reason, is_rto, is_part_cancel, cancelled_by). Used during order cancellation flow.'
  })
  @ApiResponse({
    status: 200,
    description: 'Cancel reasons retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'Request successful' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              code: { type: 'string', example: '100' },
              reason: { type: 'string', example: 'Placed duplicate order' },
              is_rto: { type: 'boolean', example: true },
              is_part_cancel: { type: 'boolean', example: true },
              cancelled_by: { type: 'string', example: 'buyer' }
            }
          },
          example: [
            {
              code: '100',
              reason: 'Placed duplicate order',
              is_rto: true,
              is_part_cancel: true,
              cancelled_by: 'buyer'
            },
            {
              code: '101',
              reason: 'Ordered by mistake',
              is_rto: true,
              is_part_cancel: true,
              cancelled_by: 'buyer'
            },
            {
              code: '102',
              reason: 'Ordered wrong food item',
              is_rto: true,
              is_part_cancel: true,
              cancelled_by: 'buyer'
            },
            {
              code: '103',
              reason: 'Price changed after placing the order',
              is_rto: true,
              is_part_cancel: true,
              cancelled_by: 'buyer'
            },
            {
              code: '104',
              reason: 'Need to change delivery address',
              is_rto: true,
              is_part_cancel: true,
              cancelled_by: 'buyer'
            },
            {
              code: '105',
              reason: 'Other reason',
              is_rto: true,
              is_part_cancel: true,
              cancelled_by: 'buyer'
            }
          ]
        },
        timestamp: { type: 'string', example: '2026-01-17T17:02:38.168Z' }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - failed to retrieve cancel reasons',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Failed to retrieve cancel reasons.' },
        timestamp: { type: 'string', example: '2026-01-17T17:02:38.168Z' }
      }
    }
  })
  findAll() {
    return this.cancelReasonService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get cancel reason by ID',
    description: 'Get a specific cancel reason by its ID. Returns only active cancel reasons with buyer-relevant fields.'
  })
  @ApiParam({
    name: 'id',
    description: 'Cancel reason ID',
    example: 1,
    type: 'number'
  })
  @ApiResponse({
    status: 200,
    description: 'Cancel reason retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'Request successful' },
        data: {
          type: 'object',
          properties: {
            code: { type: 'string', example: '100' },
            reason: { type: 'string', example: 'Placed duplicate order' },
            is_rto: { type: 'boolean', example: true },
            is_part_cancel: { type: 'boolean', example: true },
            cancelled_by: { type: 'string', example: 'buyer' }
          }
        },
        timestamp: { type: 'string', example: '2026-01-17T17:02:38.168Z' }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Cancel reason not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Cancel reason not found' },
        timestamp: { type: 'string', example: '2026-01-17T17:02:38.168Z' }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Failed to retrieve cancel reason.' },
        timestamp: { type: 'string', example: '2026-01-17T17:02:38.168Z' }
      }
    }
  })
  findOne(@Param('id') id: string) {
    return this.cancelReasonService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update cancel reason',
    description: 'Admin endpoint to update an existing cancel reason. Requires admin authentication.'
  })
  @ApiParam({
    name: 'id',
    description: 'Cancel reason ID',
    example: 1,
    type: 'number'
  })
  @ApiBody({ type: UpdateCancelReasonDto })
  @ApiResponse({
    status: 200,
    description: 'Cancel reason updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'Request successful' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            code: { type: 'string', example: '100' },
            reason: { type: 'string', example: 'Placed duplicate order (updated)' },
            is_rto: { type: 'boolean', example: true },
            is_part_cancel: { type: 'boolean', example: true },
            cancelled_by: { type: 'string', example: 'buyer' },
            is_active: { type: 'boolean', example: true },
            created_at: { type: 'string', example: '2026-01-17T17:02:38.168Z' },
            updated_at: { type: 'string', example: '2026-01-17T17:10:00.000Z' }
          }
        },
        timestamp: { type: 'string', example: '2026-01-17T17:10:00.000Z' }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Cancel reason not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Cancel reason not found' },
        timestamp: { type: 'string', example: '2026-01-17T17:02:38.168Z' }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Failed to update cancel reason. Please check your data and try again.' },
        timestamp: { type: 'string', example: '2026-01-17T17:02:38.168Z' }
      }
    }
  })
  update(@Param('id') id: string, @Body() updateCancelReasonDto: UpdateCancelReasonDto) {
    return this.cancelReasonService.update(+id, updateCancelReasonDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete cancel reason',
    description: 'Admin endpoint to delete a cancel reason. Requires admin authentication.'
  })
  @ApiParam({
    name: 'id',
    description: 'Cancel reason ID',
    example: 1,
    type: 'number'
  })
  @ApiResponse({
    status: 200,
    description: 'Cancel reason deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'Request successful' },
        data: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Cancel reason deleted successfully' }
          }
        },
        timestamp: { type: 'string', example: '2026-01-17T17:02:38.168Z' }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Cancel reason not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Cancel reason not found' },
        timestamp: { type: 'string', example: '2026-01-17T17:02:38.168Z' }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Failed to delete cancel reason.' },
        timestamp: { type: 'string', example: '2026-01-17T17:02:38.168Z' }
      }
    }
  })
  remove(@Param('id') id: string) {
    return this.cancelReasonService.remove(+id);
  }
}
