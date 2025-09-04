import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../notification/entities/notification.entity';
import { User } from '../user/entities/user.entity';
import { Order } from '../order/entities/order.entity';

export interface CreateNotificationDto {
  user_id: number;
  title: string;
  message: string;
  type: 'order' | 'promotion' | 'system' | 'review';
  data?: any;
}

export interface NotificationPreferences {
  order_updates: boolean;
  promotional_offers: boolean;
  system_alerts: boolean;
  review_reminders: boolean;
  push_notifications: boolean;
  email_notifications: boolean;
  sms_notifications: boolean;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Create a new notification
   */
  async createNotification(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    try {
      const notification = this.notificationRepository.create({
        user: { id: createNotificationDto.user_id },
        title: createNotificationDto.title,
        message: createNotificationDto.message,
        type: createNotificationDto.type,
        data: createNotificationDto.data || {},
        status: 'unread',
        is_read: false,
      });

      const savedNotification = await this.notificationRepository.save(notification);
      
      this.logger.log(`Notification created for user ${createNotificationDto.user_id}: ${createNotificationDto.title}`);
      
      // TODO: Trigger push notification, email, SMS based on user preferences
      await this.deliverNotification(savedNotification);
      
      return savedNotification;
    } catch (error) {
      this.logger.error(`Failed to create notification: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get user notifications with pagination
   */
  async getUserNotifications(
    userId: number,
    page: number = 1,
    limit: number = 20,
    type?: string,
    unreadOnly: boolean = false
  ) {
    try {
      const queryBuilder = this.notificationRepository
        .createQueryBuilder('notification')
        .leftJoinAndSelect('notification.user', 'user')
        .where('notification.user.id = :userId', { userId })
        .orderBy('notification.created_at', 'DESC');

      if (type) {
        queryBuilder.andWhere('notification.type = :type', { type });
      }

      if (unreadOnly) {
        queryBuilder.andWhere('notification.is_read = :isRead', { isRead: false });
      }

      const [notifications, total] = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      const totalPages = Math.ceil(total / limit);

      return {
        notifications: notifications.map(notification => this.formatNotification(notification)),
        pagination: {
          page,
          limit,
          total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1,
        },
        unread_count: await this.getUnreadCount(userId),
      };
    } catch (error) {
      this.logger.error(`Failed to get user notifications: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: number, userId: number): Promise<Notification> {
    try {
      const notification = await this.notificationRepository.findOne({
        where: { id: notificationId, user: { id: userId } },
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      notification.is_read = true;
      notification.status = 'read';

      const updatedNotification = await this.notificationRepository.save(notification);
      
      this.logger.log(`Notification ${notificationId} marked as read for user ${userId}`);
      
      return updatedNotification;
    } catch (error) {
      this.logger.error(`Failed to mark notification as read: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: number): Promise<{ updated_count: number }> {
    try {
      const result = await this.notificationRepository
        .createQueryBuilder()
        .update(Notification)
        .set({ is_read: true, status: 'read' })
        .where('user.id = :userId AND is_read = :isRead', { userId, isRead: false })
        .execute();

      const updatedCount = result.affected || 0;
      
      this.logger.log(`Marked ${updatedCount} notifications as read for user ${userId}`);
      
      return { updated_count: updatedCount };
    } catch (error) {
      this.logger.error(`Failed to mark all notifications as read: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: number, userId: number): Promise<void> {
    try {
      const result = await this.notificationRepository.delete({
        id: notificationId,
        user: { id: userId },
      });

      if (result.affected === 0) {
        throw new Error('Notification not found');
      }

      this.logger.log(`Notification ${notificationId} deleted for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to delete notification: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: number): Promise<number> {
    try {
      return await this.notificationRepository.count({
        where: { user: { id: userId }, is_read: false },
      });
    } catch (error) {
      this.logger.error(`Failed to get unread count: ${error.message}`, error.stack);
      return 0;
    }
  }

  /**
   * Create order status notification
   */
  async createOrderNotification(
    userId: number,
    orderId: number,
    status: string,
    message: string,
    additionalData?: any
  ): Promise<Notification> {
    const title = this.getOrderNotificationTitle(status);
    const notificationMessage = this.getOrderNotificationMessage(status, message, additionalData);

    return this.createNotification({
      user_id: userId,
      title,
      message: notificationMessage,
      type: 'order',
      data: {
        order_id: orderId,
        status,
        ...additionalData,
      },
    });
  }

  /**
   * Create promotional notification
   */
  async createPromotionalNotification(
    userId: number,
    title: string,
    message: string,
    offerData?: any
  ): Promise<Notification> {
    return this.createNotification({
      user_id: userId,
      title,
      message,
      type: 'promotion',
      data: offerData,
    });
  }

  /**
   * Create system notification
   */
  async createSystemNotification(
    userId: number,
    title: string,
    message: string,
    systemData?: any
  ): Promise<Notification> {
    return this.createNotification({
      user_id: userId,
      title,
      message,
      type: 'system',
      data: systemData,
    });
  }

  /**
   * Create review reminder notification
   */
  async createReviewNotification(
    userId: number,
    orderId: number,
    restaurantName: string
  ): Promise<Notification> {
    return this.createNotification({
      user_id: userId,
      title: 'Rate Your Experience',
      message: `How was your order from ${restaurantName}? Share your feedback!`,
      type: 'review',
      data: {
        order_id: orderId,
        restaurant_name: restaurantName,
      },
    });
  }

  /**
   * Get notification preferences (placeholder - would be stored in user profile)
   */
  async getNotificationPreferences(userId: number): Promise<NotificationPreferences> {
    // TODO: Implement user notification preferences
    // This would typically be stored in a user_preferences table
    return {
      order_updates: true,
      promotional_offers: true,
      system_alerts: true,
      review_reminders: true,
      push_notifications: true,
      email_notifications: true,
      sms_notifications: false,
    };
  }

  /**
   * Update notification preferences (placeholder)
   */
  async updateNotificationPreferences(
    userId: number,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    // TODO: Implement updating user notification preferences
    this.logger.log(`Notification preferences updated for user ${userId}`, preferences);
    
    return {
      order_updates: true,
      promotional_offers: true,
      system_alerts: true,
      review_reminders: true,
      push_notifications: true,
      email_notifications: true,
      sms_notifications: false,
      ...preferences,
    };
  }

  /**
   * Register device token for push notifications
   */
  async registerDeviceToken(userId: number, deviceToken: string, platform: string): Promise<void> {
    // TODO: Implement device token registration
    // This would typically be stored in a user_devices table
    this.logger.log(`Device token registered for user ${userId}: ${deviceToken} (${platform})`);
  }

  /**
   * Unregister device token
   */
  async unregisterDeviceToken(userId: number, deviceToken: string): Promise<void> {
    // TODO: Implement device token unregistration
    this.logger.log(`Device token unregistered for user ${userId}: ${deviceToken}`);
  }

  /**
   * Deliver notification through multiple channels
   */
  private async deliverNotification(notification: Notification): Promise<void> {
    try {
      // TODO: Implement actual delivery logic
      // 1. Check user preferences
      // 2. Send push notification if enabled
      // 3. Send email if enabled
      // 4. Send SMS if enabled
      
      this.logger.log(`Delivering notification ${notification.id} to user ${notification.user?.id}`);
      
      // Placeholder for actual delivery implementation
      await this.sendPushNotification(notification);
      await this.sendEmailNotification(notification);
      await this.sendSMSNotification(notification);
    } catch (error) {
      this.logger.error(`Failed to deliver notification: ${error.message}`, error.stack);
    }
  }

  /**
   * Send push notification (placeholder)
   */
  private async sendPushNotification(notification: Notification): Promise<void> {
    // TODO: Implement Firebase Cloud Messaging or similar
    this.logger.log(`Push notification sent for notification ${notification.id}`);
  }

  /**
   * Send email notification (placeholder)
   */
  private async sendEmailNotification(notification: Notification): Promise<void> {
    // TODO: Implement email service integration
    this.logger.log(`Email notification sent for notification ${notification.id}`);
  }

  /**
   * Send SMS notification (placeholder)
   */
  private async sendSMSNotification(notification: Notification): Promise<void> {
    // TODO: Implement SMS service integration
    this.logger.log(`SMS notification sent for notification ${notification.id}`);
  }

  /**
   * Get order notification title based on status
   */
  private getOrderNotificationTitle(status: string): string {
    const titles = {
      pending: 'Order Placed',
      confirmed: 'Order Confirmed',
      preparing: 'Order Being Prepared',
      out_for_delivery: 'Order Out for Delivery',
      delivered: 'Order Delivered',
      cancelled: 'Order Cancelled',
    };
    return titles[status] || 'Order Update';
  }

  /**
   * Get order notification message based on status
   */
  private getOrderNotificationMessage(status: string, message: string, additionalData?: any): string {
    const baseMessages = {
      pending: 'Your order has been placed successfully and is being processed.',
      confirmed: 'Your order has been confirmed by the restaurant.',
      preparing: 'Your order is being prepared with care.',
      out_for_delivery: 'Your order is out for delivery and will reach you soon.',
      delivered: 'Your order has been delivered. Enjoy your meal!',
      cancelled: 'Your order has been cancelled.',
    };

    const baseMessage = baseMessages[status] || message;
    
    if (additionalData?.estimated_time) {
      return `${baseMessage} Estimated delivery time: ${additionalData.estimated_time}`;
    }
    
    return baseMessage;
  }

  /**
   * Format notification for API response
   */
  private formatNotification(notification: Notification) {
    return {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      status: notification.status,
      is_read: notification.is_read,
      data: notification.data,
      created_at: notification.created_at.toISOString(),
    };
  }
}
