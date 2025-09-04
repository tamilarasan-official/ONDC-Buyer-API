import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface FCMNotificationPayload {
  title: string;
  body: string;
  data?: { [key: string]: string };
  imageUrl?: string;
}

export interface FCMNotificationOptions {
  priority?: 'high' | 'normal';
  timeToLive?: number;
  collapseKey?: string;
  badge?: number;
  sound?: string;
  clickAction?: string;
}

@Injectable()
export class FCMService {
  private readonly logger = new Logger(FCMService.name);
  private app: admin.app.App;

  constructor(private readonly configService: ConfigService) {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    try {
      // Initialize Firebase Admin SDK
      const serviceAccount = {
        type: 'service_account',
        project_id: this.configService.get<string>('FCM_PROJECT_ID'),
        private_key_id: this.configService.get<string>('FCM_PRIVATE_KEY_ID'),
        private_key: this.configService.get<string>('FCM_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
        client_email: this.configService.get<string>('FCM_CLIENT_EMAIL'),
        client_id: this.configService.get<string>('FCM_CLIENT_ID'),
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: this.configService.get<string>('FCM_CLIENT_X509_CERT_URL'),
      };

      this.app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
        projectId: this.configService.get<string>('FCM_PROJECT_ID'),
      });

      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK:', error);
      throw new Error('Firebase initialization failed');
    }
  }

  /**
   * Send notification to a single device token
   */
  async sendToDevice(
    token: string,
    payload: FCMNotificationPayload,
    options?: FCMNotificationOptions
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const message: admin.messaging.Message = {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: payload.data || {},
        android: {
          priority: options?.priority || 'high',
          ttl: options?.timeToLive || 3600000, // 1 hour default
          collapseKey: options?.collapseKey,
          notification: {
            sound: options?.sound || 'default',
            clickAction: options?.clickAction,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: options?.sound || 'default',
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`FCM notification sent successfully to token ${token}: ${response}`);
      
      return {
        success: true,
        messageId: response,
      };
    } catch (error) {
      this.logger.error(`Failed to send FCM notification to token ${token}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send notification to multiple device tokens
   */
  async sendToMultipleDevices(
    tokens: string[],
    payload: FCMNotificationPayload,
    options?: FCMNotificationOptions
  ): Promise<{
    successCount: number;
    failureCount: number;
    results: Array<{ token: string; success: boolean; messageId?: string; error?: string }>;
  }> {
    try {
      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: payload.data || {},
        android: {
          priority: options?.priority || 'high',
          ttl: options?.timeToLive || 3600000,
          collapseKey: options?.collapseKey,
          notification: {
            sound: options?.sound || 'default',
            clickAction: options?.clickAction,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: options?.sound || 'default',
            },
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      
      const results = tokens.map((token, index) => {
        const result = response.responses[index];
        return {
          token,
          success: result.success,
          messageId: result.messageId,
          error: result.error?.message,
        };
      });

      this.logger.log(`FCM multicast notification sent: ${response.successCount} success, ${response.failureCount} failures`);
      
      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        results,
      };
    } catch (error) {
      this.logger.error('Failed to send FCM multicast notification:', error);
      throw error;
    }
  }

  /**
   * Send notification to a topic
   */
  async sendToTopic(
    topic: string,
    payload: FCMNotificationPayload,
    options?: FCMNotificationOptions
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const message: admin.messaging.Message = {
        topic,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: payload.data || {},
        android: {
          priority: options?.priority || 'high',
          ttl: options?.timeToLive || 3600000,
          collapseKey: options?.collapseKey,
          notification: {
            sound: options?.sound || 'default',
            clickAction: options?.clickAction,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: options?.sound || 'default',
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`FCM topic notification sent successfully to topic ${topic}: ${response}`);
      
      return {
        success: true,
        messageId: response,
      };
    } catch (error) {
      this.logger.error(`Failed to send FCM topic notification to topic ${topic}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Subscribe device tokens to a topic
   */
  async subscribeToTopic(tokens: string[], topic: string): Promise<{
    successCount: number;
    failureCount: number;
    errors: string[];
  }> {
    try {
      const response = await admin.messaging().subscribeToTopic(tokens, topic);
      this.logger.log(`Subscribed ${response.successCount} tokens to topic ${topic}`);
      
      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        errors: response.errors.map(error => error.error?.message || 'Unknown error'),
      };
    } catch (error) {
      this.logger.error(`Failed to subscribe tokens to topic ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribe device tokens from a topic
   */
  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<{
    successCount: number;
    failureCount: number;
    errors: string[];
  }> {
    try {
      const response = await admin.messaging().unsubscribeFromTopic(tokens, topic);
      this.logger.log(`Unsubscribed ${response.successCount} tokens from topic ${topic}`);
      
      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        errors: response.errors.map(error => error.error?.message || 'Unknown error'),
      };
    } catch (error) {
      this.logger.error(`Failed to unsubscribe tokens from topic ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Validate device token
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      // Send a test message to validate the token
      const message: admin.messaging.Message = {
        token,
        data: { test: 'true' },
        android: { priority: 'high' },
        apns: { payload: { aps: { contentAvailable: true } } },
      };

      await admin.messaging().send(message);
      return true;
    } catch (error) {
      this.logger.warn(`Token validation failed for ${token}:`, error.message);
      return false;
    }
  }

  /**
   * Get FCM service status
   */
  getServiceStatus(): { initialized: boolean; projectId?: string } {
    return {
      initialized: !!this.app,
      projectId: this.configService.get<string>('FCM_PROJECT_ID'),
    };
  }
}
