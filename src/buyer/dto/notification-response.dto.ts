import { ApiProperty } from '@nestjs/swagger';

export class NotificationDataDto {
  @ApiProperty({
    description: 'Notification ID',
    example: 1,
    type: 'number'
  })
  id: number;

  @ApiProperty({
    description: 'Notification title',
    example: 'Order Confirmed'
  })
  title: string;

  @ApiProperty({
    description: 'Notification message',
    example: 'Your order has been confirmed by the restaurant.'
  })
  message: string;

  @ApiProperty({
    description: 'Notification type',
    example: 'order',
    enum: ['order', 'promotion', 'system', 'review']
  })
  type: string;

  @ApiProperty({
    description: 'Notification status',
    example: 'unread',
    enum: ['unread', 'read']
  })
  status: string;

  @ApiProperty({
    description: 'Is notification read',
    example: false,
    type: 'boolean'
  })
  is_read: boolean;

  @ApiProperty({
    description: 'Additional notification data',
    example: {
      order_id: 123,
      status: 'confirmed'
    }
  })
  data: any;

  @ApiProperty({
    description: 'Notification created timestamp',
    example: '2025-01-15T12:00:00Z'
  })
  created_at: string;
}

export class NotificationPaginationDto {
  @ApiProperty({
    description: 'Current page number',
    example: 1,
    type: 'number'
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
    type: 'number'
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of notifications',
    example: 150,
    type: 'number'
  })
  total: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 8,
    type: 'number'
  })
  total_pages: number;

  @ApiProperty({
    description: 'Has next page',
    example: true,
    type: 'boolean'
  })
  has_next: boolean;

  @ApiProperty({
    description: 'Has previous page',
    example: false,
    type: 'boolean'
  })
  has_prev: boolean;
}

export class NotificationListResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
    type: 'boolean'
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Notifications retrieved successfully'
  })
  message: string;

  @ApiProperty({
    description: 'List of notifications',
    type: [NotificationDataDto]
  })
  data: NotificationDataDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: NotificationPaginationDto
  })
  pagination: NotificationPaginationDto;

  @ApiProperty({
    description: 'Number of unread notifications',
    example: 5,
    type: 'number'
  })
  unread_count: number;
}

export class NotificationResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
    type: 'boolean'
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Notification marked as read'
  })
  message: string;

  @ApiProperty({
    description: 'Notification data',
    type: NotificationDataDto
  })
  data: NotificationDataDto;
}

export class MarkAllReadResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
    type: 'boolean'
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'All notifications marked as read'
  })
  message: string;

  @ApiProperty({
    description: 'Number of notifications updated',
    example: 15,
    type: 'number'
  })
  updated_count: number;
}

export class NotificationPreferencesDto {
  @ApiProperty({
    description: 'Enable/disable order update notifications',
    example: true,
    type: 'boolean'
  })
  order_updates: boolean;

  @ApiProperty({
    description: 'Enable/disable promotional offer notifications',
    example: true,
    type: 'boolean'
  })
  promotional_offers: boolean;

  @ApiProperty({
    description: 'Enable/disable system alert notifications',
    example: true,
    type: 'boolean'
  })
  system_alerts: boolean;

  @ApiProperty({
    description: 'Enable/disable review reminder notifications',
    example: true,
    type: 'boolean'
  })
  review_reminders: boolean;

  @ApiProperty({
    description: 'Enable/disable push notifications',
    example: true,
    type: 'boolean'
  })
  push_notifications: boolean;

  @ApiProperty({
    description: 'Enable/disable email notifications',
    example: true,
    type: 'boolean'
  })
  email_notifications: boolean;

  @ApiProperty({
    description: 'Enable/disable SMS notifications',
    example: false,
    type: 'boolean'
  })
  sms_notifications: boolean;
}

export class NotificationPreferencesResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
    type: 'boolean'
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Notification preferences retrieved successfully'
  })
  message: string;

  @ApiProperty({
    description: 'Notification preferences',
    type: NotificationPreferencesDto
  })
  data: NotificationPreferencesDto;
}

export class DeviceTokenResponseDto {
  @ApiProperty({
    description: 'Success status',
    example: true,
    type: 'boolean'
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Device token registered successfully'
  })
  message: string;

  @ApiProperty({
    description: 'Device token information',
    example: {
      device_token: 'fcm_token_here_123456789',
      platform: 'android',
      registered_at: '2025-01-15T12:00:00Z'
    }
  })
  data: {
    device_token: string;
    platform: string;
    registered_at: string;
  };
}
