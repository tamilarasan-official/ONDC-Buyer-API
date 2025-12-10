import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Notification } from "../notification/entities/notification.entity";
import { User } from "../user/entities/user.entity";
import { UserDeviceToken } from "../user/entities/user-device-token.entity";
import { Order } from "../order/entities/order.entity";
import {
  FCMService,
  FCMNotificationPayload,
  FCMNotificationOptions,
} from "./fcm.service";

export interface CreateNotificationDto {
  user_id: number;
  title: string;
  message: string;
  type: "order" | "promotion" | "system" | "review";
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
    @InjectRepository(UserDeviceToken)
    private readonly userDeviceTokenRepository: Repository<UserDeviceToken>,
    private readonly fcmService: FCMService,
  ) {}

  // Expose FCM service for external access
  get fcm(): FCMService {
    return this.fcmService;
  }

  /**
   * Create a new notification
   */
  async createNotification(
    createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    try {
      const notification = this.notificationRepository.create({
        user: { id: createNotificationDto.user_id },
        title: createNotificationDto.title,
        message: createNotificationDto.message,
        type: createNotificationDto.type,
        data: createNotificationDto.data || {},
        status: "unread",
        is_read: false,
      });

      const savedNotification =
        await this.notificationRepository.save(notification);

      this.logger.log(
        `✅ NOTIFICATION CREATED | ID: ${savedNotification.id} | User: ${createNotificationDto.user_id} | Type: ${createNotificationDto.type} | Title: "${createNotificationDto.title}" | Message: "${createNotificationDto.message}" | Data: ${JSON.stringify(createNotificationDto.data || {})}`,
      );

      // TODO: Trigger push notification, email, SMS based on user preferences
      await this.deliverNotification(savedNotification);

      return savedNotification;
    } catch (error) {
      this.logger.error(
        `Failed to create notification: ${error.message}`,
        error.stack,
      );
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
    unreadOnly: boolean = false,
  ) {
    try {
      const queryBuilder = this.notificationRepository
        .createQueryBuilder("notification")
        .leftJoinAndSelect("notification.user", "user")
        .where("notification.user.id = :userId", { userId })
        .orderBy("notification.created_at", "DESC");

      if (type) {
        queryBuilder.andWhere("notification.type = :type", { type });
      }

      if (unreadOnly) {
        queryBuilder.andWhere("notification.is_read = :isRead", {
          isRead: false,
        });
      }

      const [notifications, total] = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      const totalPages = Math.ceil(total / limit);

      return {
        notifications: notifications.map((notification) =>
          this.formatNotification(notification),
        ),
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
      this.logger.error(
        `Failed to get user notifications: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(
    notificationId: number,
    userId: number,
  ): Promise<Notification> {
    try {
      const notification = await this.notificationRepository.findOne({
        where: { id: notificationId, user: { id: userId } },
      });

      if (!notification) {
        throw new Error("Notification not found");
      }

      notification.is_read = true;
      notification.status = "read";

      const updatedNotification =
        await this.notificationRepository.save(notification);

      this.logger.log(
        `Notification ${notificationId} marked as read for user ${userId}`,
      );

      return updatedNotification;
    } catch (error) {
      this.logger.error(
        `Failed to mark notification as read: ${error.message}`,
        error.stack,
      );
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
        .set({ is_read: true, status: "read" })
        .where("user.id = :userId AND is_read = :isRead", {
          userId,
          isRead: false,
        })
        .execute();

      const updatedCount = result.affected || 0;

      this.logger.log(
        `Marked ${updatedCount} notifications as read for user ${userId}`,
      );

      return { updated_count: updatedCount };
    } catch (error) {
      this.logger.error(
        `Failed to mark all notifications as read: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(
    notificationId: number,
    userId: number,
  ): Promise<void> {
    try {
      const result = await this.notificationRepository.delete({
        id: notificationId,
        user: { id: userId },
      });

      if (result.affected === 0) {
        throw new Error("Notification not found");
      }

      this.logger.log(
        `Notification ${notificationId} deleted for user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete notification: ${error.message}`,
        error.stack,
      );
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
      this.logger.error(
        `Failed to get unread count: ${error.message}`,
        error.stack,
      );
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
    additionalData?: any,
  ): Promise<Notification> {
    const title = this.getOrderNotificationTitle(status);
    const notificationMessage = this.getOrderNotificationMessage(
      status,
      message,
      additionalData,
    );

    const notification = await this.createNotification({
      user_id: userId,
      title,
      message: notificationMessage,
      type: "order",
      data: {
        order_id: orderId,
        status,
        ...additionalData,
      },
    });
    
    this.logger.log(`📦 ORDER NOTIFICATION | User: ${userId} | Order: ${orderId} | Status: ${status} | Title: "${title}" | Message: "${notificationMessage}" | Data: ${JSON.stringify(additionalData || {})}`);
    
    return notification;
  }

  /**
   * Create review reminder notification
   */
  async createReviewNotification(
    userId: number,
    orderId: number,
    restaurantName: string,
  ): Promise<Notification> {
    const notification = await this.createNotification({
      user_id: userId,
      title: "Rate Your Experience",
      message: `How was your order from ${restaurantName}? Share your feedback!`,
      type: "review",
      data: {
        order_id: orderId,
        restaurant_name: restaurantName,
      },
    });
    
    this.logger.log(`⭐ REVIEW NOTIFICATION | User: ${userId} | Order: ${orderId} | Restaurant: "${restaurantName}" | Title: "Rate Your Experience" | Message: "How was your order from ${restaurantName}? Share your feedback!"`);
    
    return notification;
  }

  /**
   * Create payment success notification
   */
  async createPaymentSuccessNotification(
    userId: number,
    orderId: number,
    amount: number,
    paymentMethod: string,
  ): Promise<Notification> {
    const notification = await this.createNotification({
      user_id: userId,
      title: "Payment Successful",
      message: `Payment of ₹${amount} via ${paymentMethod} completed successfully`,
      type: "order",
      data: {
        order_id: orderId,
        amount: amount,
        payment_method: paymentMethod,
        status: "paid",
      },
    });
    
    this.logger.log(`💰 PAYMENT SUCCESS NOTIFICATION | User: ${userId} | Order: ${orderId} | Amount: ₹${amount} | Method: ${paymentMethod} | Title: "Payment Successful" | Message: "Payment of ₹${amount} via ${paymentMethod} completed successfully"`);
    
    return notification;
  }

  /**
   * Create payment failed notification
   */
  async createPaymentFailedNotification(
    userId: number,
    orderId: number,
    amount: number,
    paymentMethod: string,
    reason?: string,
  ): Promise<Notification> {
    const notification = await this.createNotification({
      user_id: userId,
      title: "Payment Failed",
      message: `Payment of ₹${amount} via ${paymentMethod} failed. ${reason || "Please try again."}`,
      type: "order",
      data: {
        order_id: orderId,
        amount: amount,
        payment_method: paymentMethod,
        status: "failed",
        reason: reason,
      },
    });
    
    this.logger.log(`❌ PAYMENT FAILED NOTIFICATION | User: ${userId} | Order: ${orderId} | Amount: ₹${amount} | Method: ${paymentMethod} | Reason: ${reason || "Not specified"} | Title: "Payment Failed" | Message: "Payment of ₹${amount} via ${paymentMethod} failed. ${reason || "Please try again."}"`);
    
    return notification;
  }

  /**
   * Create promotional notification
   */
  async createPromotionalNotification(
    userId: number,
    title: string,
    message: string,
    offerData?: any,
  ): Promise<Notification> {
    const notification = await this.createNotification({
      user_id: userId,
      title,
      message,
      type: "promotion",
      data: offerData || {},
    });
    
    this.logger.log(`🎁 PROMOTIONAL NOTIFICATION | User: ${userId} | Title: "${title}" | Message: "${message}" | Data: ${JSON.stringify(offerData || {})}`);
    
    return notification;
  }

  /**
   * Create system maintenance notification
   */
  async createSystemMaintenanceNotification(
    userId: number,
    message: string,
    maintenanceData?: any,
  ): Promise<Notification> {
    const notification = await this.createNotification({
      user_id: userId,
      title: "System Maintenance",
      message,
      type: "system",
      data: maintenanceData || {},
    });
    
    this.logger.log(`🔧 SYSTEM MAINTENANCE NOTIFICATION | User: ${userId} | Title: "System Maintenance" | Message: "${message}" | Data: ${JSON.stringify(maintenanceData || {})}`);
    
    return notification;
  }

  /**
   * Get notification preferences (placeholder - would be stored in user profile)
   */
  async getNotificationPreferences(
    userId: number,
  ): Promise<NotificationPreferences> {
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
    preferences: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    // TODO: Implement updating user notification preferences
    this.logger.log(
      `Notification preferences updated for user ${userId}`,
      preferences,
    );

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
   * Unregister device token
   */
  async unregisterDeviceToken(
    userId: number,
    deviceToken: string,
  ): Promise<void> {
    try {
      await this.userDeviceTokenRepository.delete({
        userId: userId,
        token: deviceToken,
      });
      this.logger.log(
        `Device token unregistered for user ${userId}: ${deviceToken}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to unregister device token: ${error.message}`,
        error.stack,
      );
      throw new Error("Failed to unregister device token");
    }
  }

  /**
   * Register device token for push notifications with device metadata
   */
  async registerDeviceToken(
    userId: number,
    deviceToken: string,
    platform: string,
    deviceId?: string,
    appVersion?: string,
  ): Promise<void> {
    try {
      this.logger.log(
        `🔍 Processing FCM token | User: ${userId} | Token Length: ${deviceToken.length} | Device ID: ${deviceId || "N/A"} | App Version: ${appVersion || "N/A"}`,
      );

      // Validate token with FCM service
      this.logger.log(`🔐 Validating with Firebase...`);
      const isValid = await this.fcmService.validateToken(deviceToken);
      
      if (!isValid) {
        this.logger.error(
          `❌ FCM validation failed | User: ${userId} | Token: ${deviceToken}`,
        );
        throw new Error(
          "Invalid FCM token. Please ensure your app is properly configured with Firebase Cloud Messaging.",
        );
      }

      this.logger.log(`✅ FCM validation passed | User: ${userId}`);

      // Check if token already exists
      this.logger.log(`🔎 Checking for existing token...`);
      const existingToken = await this.userDeviceTokenRepository.findOne({
        where: {
          userId: userId,
          token: deviceToken,
        },
      });

      if (existingToken) {
        // Update existing token
        const changes: string[] = [];
        
        if (deviceId && deviceId !== existingToken.device_id) {
          changes.push(`Device ID: ${existingToken.device_id || "null"} → ${deviceId}`);
        }
        if (appVersion && appVersion !== existingToken.app_version) {
          changes.push(`Version: ${existingToken.app_version || "null"} → ${appVersion}`);
        }

        existingToken.is_active = true;
        existingToken.platform = platform;
        existingToken.device_id = deviceId || existingToken.device_id;
        existingToken.app_version = appVersion || existingToken.app_version;
        existingToken.updated_at = new Date();

        await this.userDeviceTokenRepository.save(existingToken);

        this.logger.log(
          `🔄 FCM token UPDATED | User: ${userId} | Changes: ${changes.length > 0 ? changes.join(", ") : "None"}`,
        );
      } else {
        // Create new token
        const newToken = this.userDeviceTokenRepository.create({
          userId: userId,
          user: { id: userId },
          token: deviceToken,
          platform,
          device_id: deviceId,
          app_version: appVersion,
          is_active: true,
        });

        await this.userDeviceTokenRepository.save(newToken);

        this.logger.log(
          `✨ FCM token REGISTERED (new) | User: ${userId} | Platform: ${platform}`,
        );
      }

      // Log statistics
      const userTokenCount = await this.userDeviceTokenRepository.count({
        where: { userId: userId, is_active: true },
      });
      
      this.logger.log(
        `📊 Active devices for user ${userId}: ${userTokenCount}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to register device token for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new Error("Failed to register device token");
    }
  }

  /**
   * Remove invalid device tokens
   */
  private async removeInvalidTokens(tokens: string[]): Promise<void> {
    try {
      await this.userDeviceTokenRepository.update(
        { token: { $in: tokens } as any },
        { is_active: false },
      );
      this.logger.log(`Marked ${tokens.length} invalid tokens as inactive`);
    } catch (error) {
      this.logger.error(
        `Failed to remove invalid tokens: ${error.message}`,
        error.stack,
      );
    }
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

      this.logger.log(
        `Delivering notification ${notification.id} to user ${notification.user?.id}`,
      );

      // Placeholder for actual delivery implementation
      await this.sendPushNotification(notification);
      await this.sendEmailNotification(notification);
      await this.sendSMSNotification(notification);
    } catch (error) {
      this.logger.error(
        `Failed to deliver notification: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send push notification via FCM
   */
  private async sendPushNotification(
    notification: Notification,
  ): Promise<void> {
    try {
      this.logger.log(`📱 SENDING PUSH NOTIFICATION | Notification ID: ${notification.id} | User: ${notification.user?.id} | Type: ${notification.type} | Title: "${notification.title}" | Message: "${notification.message}"`);
      
      // Get user's device tokens
      const user = await this.userRepository.findOne({
        where: { id: notification.user?.id },
        relations: ["device_tokens"],
      });

      if (!user || !user.device_tokens || user.device_tokens.length === 0) {
        this.logger.warn(
          `No device tokens found for user ${notification.user?.id}`,
        );
        return;
      }

      // Check user's push notification preferences
      const preferences = await this.getNotificationPreferences(
        notification.user?.id,
      );
      if (!preferences.push_notifications) {
        this.logger.log(
          `Push notifications disabled for user ${notification.user?.id}`,
        );
        return;
      }

      // FCM requires all data values to be strings
      // Convert notification.data to string values
      const notificationData: { [key: string]: string } = {
        notification_id: notification.id.toString(),
        type: notification.type,
      };

      // Convert all data fields to strings
      if (notification.data && typeof notification.data === "object") {
        Object.keys(notification.data).forEach((key) => {
          const value = notification.data[key];
          // Convert all values to strings for FCM compatibility
          notificationData[key] =
            value !== null && value !== undefined ? String(value) : "";
        });
      }

      const payload: FCMNotificationPayload = {
        title: notification.title,
        body: notification.message,
        data: notificationData,
      };

      const options: FCMNotificationOptions = {
        priority: "high",
        timeToLive: 3600000, // 1 hour
        collapseKey: `notification_${notification.type}`,
      };

      // Send to all user's device tokens
      const tokens = user.device_tokens
        .filter((dt) => dt.is_active)
        .map((dt) => dt.token);

      if (tokens.length === 0) {
        this.logger.warn(
          `No active device tokens found for user ${notification.user?.id}`,
        );
        return;
      }

      const result = await this.fcmService.sendToMultipleDevices(
        tokens,
        payload,
        options,
      );

      this.logger.log(
        `Push notification sent to user ${notification.user?.id}: ${result.successCount} success, ${result.failureCount} failures`,
      );

      // Handle failed tokens (remove invalid tokens)
      if (result.failureCount > 0) {
        const failedTokens = result.results
          .filter((r) => !r.success)
          .map((r) => r.token);

        this.logger.warn(
          `Failed to send push notifications to tokens: ${failedTokens.join(", ")}`,
        );

        // Remove invalid tokens from database
        await this.removeInvalidTokens(failedTokens);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send push notification: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send email notification (placeholder)
   */
  private async sendEmailNotification(
    notification: Notification,
  ): Promise<void> {
    // TODO: Implement email service integration
    this.logger.log(
      `Email notification sent for notification ${notification.id}`,
    );
  }

  /**
   * Send SMS notification (placeholder)
   */
  private async sendSMSNotification(notification: Notification): Promise<void> {
    // TODO: Implement SMS service integration
    this.logger.log(
      `SMS notification sent for notification ${notification.id}`,
    );
  }

  /**
   * Get order notification title based on status
   */
  private getOrderNotificationTitle(status: string): string {
    const titles = {
      pending: "Order Placed",
      confirmed: "Order Confirmed",
      preparing: "Order Being Prepared",
      out_for_delivery: "Order Out for Delivery",
      delivered: "Order Delivered",
      cancelled: "Order Cancelled",
    };
    return titles[status] || "Order Update";
  }

  /**
   * Get order notification message based on status
   */
  private getOrderNotificationMessage(
    status: string,
    message: string,
    additionalData?: any,
  ): string {
    const baseMessages = {
      pending:
        "Your order has been placed successfully and is being processed.",
      confirmed: "Your order has been confirmed by the restaurant.",
      preparing: "Your order is being prepared with care.",
      out_for_delivery:
        "Your order is out for delivery and will reach you soon.",
      delivered: "Your order has been delivered. Enjoy your meal!",
      cancelled: "Your order has been cancelled.",
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
