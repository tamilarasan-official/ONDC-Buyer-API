import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly razorpay: Razorpay;
  private readonly keyId: string;
  private readonly keySecret: string;

  constructor(private readonly configService: ConfigService) {
    // Get Razorpay credentials from environment or use defaults
    this.keyId = this.configService.get<string>('RAZORPAY_KEY_ID') || 'rzp_test_1DP5mmOlF5G5ag';
    this.keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET') || 'thisisasecretkey';

    // Validate credentials
    if (!this.keyId || !this.keySecret || this.keyId === 'rzp_test_1DP5mmOlF5G5ag') {
      this.logger.warn(`⚠️ Using default Razorpay test credentials. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables for production.`);
    }

    try {
      this.razorpay = new Razorpay({
        key_id: this.keyId,
        key_secret: this.keySecret,
      });

      this.logger.log(`🔑 Razorpay initialized with Key ID: ${this.keyId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to initialize Razorpay:`, error);
      throw new Error('Failed to initialize Razorpay service');
    }
  }

  /**
   * Create Razorpay order
   */
  async createOrder(amount: number, currency: string = 'INR', receipt?: string) {
    try {
      this.logger.log(`💳 Creating Razorpay order for amount: ${amount} ${currency}`);

      // Validate amount
      if (!amount || amount <= 0) {
        throw new Error('Invalid amount provided');
      }

      // Development fallback - return mock order if using default credentials
      if (this.keyId === 'rzp_test_1DP5mmOlF5G5ag') {
        this.logger.warn(`⚠️ Using mock Razorpay order for development`);
        return {
          id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          amount: amount,
          currency: currency,
          receipt: receipt || `receipt_${Date.now()}`,
          status: 'created',
          created_at: Math.floor(Date.now() / 1000)
        };
      }

      // Validate Razorpay instance
      if (!this.razorpay) {
        throw new Error('Razorpay instance not initialized');
      }

      const options = {
        amount: amount, // Amount in paise
        currency: currency,
        receipt: receipt || `receipt_${Date.now()}`,
        notes: {
          order_type: 'food_delivery',
          created_at: new Date().toISOString()
        }
      };

      this.logger.log(`🔧 Razorpay options:`, options);
      const order = await this.razorpay.orders.create(options);
      
      this.logger.log(`✅ Razorpay order created: ${order.id}`);
      return order;
    } catch (error) {
      this.logger.error(`❌ Error creating Razorpay order:`, error);
      this.logger.error(`❌ Error details:`, {
        message: error?.message,
        code: error?.code,
        statusCode: error?.statusCode,
        response: error?.response
      });
      throw new BadRequestException(`Failed to create payment order: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Verify payment signature
   */
  verifyPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ): boolean {
    try {
      this.logger.log(`🔍 Verifying payment signature for order: ${razorpayOrderId}`);

      const body = razorpayOrderId + '|' + razorpayPaymentId;
      const expectedSignature = crypto
        .createHmac('sha256', this.keySecret)
        .update(body.toString())
        .digest('hex');

      const isValid = expectedSignature === razorpaySignature;
      
      this.logger.log(`🔐 Payment signature verification: ${isValid ? 'VALID' : 'INVALID'}`);
      return isValid;
    } catch (error) {
      this.logger.error(`❌ Error verifying payment signature: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(body: string, signature: string): boolean {
    try {
      this.logger.log(`🔍 Verifying webhook signature`);

      const expectedSignature = crypto
        .createHmac('sha256', this.keySecret)
        .update(body)
        .digest('hex');

      const isValid = expectedSignature === signature;
      
      this.logger.log(`🔐 Webhook signature verification: ${isValid ? 'VALID' : 'INVALID'}`);
      return isValid;
    } catch (error) {
      this.logger.error(`❌ Error verifying webhook signature: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Get payment details from Razorpay
   */
  async getPaymentDetails(paymentId: string) {
    try {
      this.logger.log(`💳 Fetching payment details for: ${paymentId}`);

      // Development fallback
      if (this.keyId === 'rzp_test_1DP5mmOlF5G5ag') {
        this.logger.warn(`⚠️ Using mock payment details for development`);
        return {
          id: paymentId,
          amount: 123000,
          currency: 'INR',
          status: 'captured',
          method: 'card',
          created_at: Math.floor(Date.now() / 1000)
        };
      }

      if (!this.razorpay) {
        throw new Error('Razorpay instance not initialized');
      }

      const payment = await this.razorpay.payments.fetch(paymentId);
      
      this.logger.log(`✅ Payment details fetched: ${payment.id}`);
      return payment;
    } catch (error) {
      this.logger.error(`❌ Error fetching payment details:`, error);
      throw new BadRequestException(`Failed to fetch payment details: ${error?.message || 'Unknown error'}`);
    }
  }


  /**
   * Capture payment
   */
  async capturePayment(paymentId: string, amount: number, currency: string = 'INR') {
    try {
      this.logger.log(`💰 Capturing payment: ${paymentId} for amount: ${amount}`);

      const payment = await this.razorpay.payments.capture(paymentId, amount, currency);
      
      this.logger.log(`✅ Payment captured successfully: ${payment.status}`);
      return payment;
    } catch (error) {
      this.logger.error(`❌ Error capturing payment: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to capture payment');
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(paymentId: string, amount?: number, notes?: any) {
    try {
      this.logger.log(`💸 Processing refund for payment: ${paymentId}`);

      const refundOptions: any = {
        payment_id: paymentId,
        notes: notes || {
          reason: 'customer_request',
          refunded_at: new Date().toISOString()
        }
      };

      if (amount) {
        refundOptions.amount = amount;
      }

      const refund = await this.razorpay.payments.refund(paymentId, refundOptions);
      
      this.logger.log(`✅ Refund processed successfully: ${refund.id}`);
      return refund;
    } catch (error) {
      this.logger.error(`❌ Error processing refund: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to process refund');
    }
  }

  /**
   * Get Razorpay key for frontend
   */
  getRazorpayKey(): string {
    return this.keyId;
  }

  /**
   * Generate payment options for frontend
   */
  generatePaymentOptions(orderData: any, customerData: any) {
    return {
      key: this.keyId,
      amount: orderData.amount,
      currency: orderData.currency,
      name: orderData.restaurant_name || 'Food Delivery',
      description: `Order #${orderData.order_number}`,
      order_id: orderData.razorpay_order_id,
      prefill: {
        name: customerData.name,
        email: customerData.email,
        contact: customerData.phone
      },
      notes: {
        order_id: orderData.order_id,
        order_number: orderData.order_number
      },
      theme: {
        color: '#3399cc'
      },
      handler: function (response: any) {
        // This will be handled by the frontend
        console.log('Payment successful:', response);
      }
    };
  }
}
