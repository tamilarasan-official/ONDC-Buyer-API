import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppSettingsService } from "../shared/services/app-settings.service";
import Razorpay from "razorpay";
import * as crypto from "crypto";

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private razorpay: Razorpay;
  private keyId: string;
  private keySecret: string;
  private webhookSecret: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly appSettingsService: AppSettingsService,
  ) {
    this.initializeRazorpay();
  }

  private async initializeRazorpay() {
    // Get Razorpay credentials from database - no defaults to prevent errors
    const keyId = await this.appSettingsService.get("RAZORPAY_KEY_ID");
    const keySecret = await this.appSettingsService.get("RAZORPAY_KEY_SECRET");

    // Validate credentials are configured
    if (!keyId || !keySecret) {
      // Backend log - detailed information for debugging
      this.logger.error(
        `❌ Razorpay credentials not configured. RAZORPAY_KEY_ID=${keyId ? "SET" : "MISSING"}, RAZORPAY_KEY_SECRET=${keySecret ? "SET" : "MISSING"}. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in app settings.`,
      );
      // User-friendly error message
      throw new Error("Payment service is temporarily unavailable. Please contact support.");
    }

    this.keyId = keyId;
    this.keySecret = keySecret;

    // Get webhook secret (optional - for better security)
    try {
      const webhookSecret = await this.appSettingsService.get("RAZORPAY_WEBHOOK_SECRET");
      if (webhookSecret && webhookSecret.trim() !== "") {
        this.webhookSecret = webhookSecret.trim();
        this.logger.log(`🔐 Razorpay webhook secret configured`);
      } else {
        this.logger.warn(
          `⚠️ RAZORPAY_WEBHOOK_SECRET not configured. Webhook verification will use API key secret as fallback. For better security, configure RAZORPAY_WEBHOOK_SECRET in app settings.`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `⚠️ Could not load RAZORPAY_WEBHOOK_SECRET. Webhook verification will use API key secret as fallback.`,
      );
    }

    try {
      this.razorpay = new Razorpay({
        key_id: this.keyId,
        key_secret: this.keySecret,
      });

      this.logger.log(`🔑 Razorpay initialized with Key ID: ${this.keyId}`);
    } catch (error) {
      // Backend log - detailed error information
      this.logger.error(
        `❌ Failed to initialize Razorpay service. Error: ${error.message || error}, Stack: ${error.stack || "N/A"}`,
      );
      // User-friendly error message
      throw new Error("Payment service initialization failed. Please contact support.");
    }
  }

  /**
   * Create Razorpay order
   */
  async createOrder(
    amount: number,
    currency: string = "INR",
    receipt?: string,
  ) {
    try {
      this.logger.log(
        `💳 Creating Razorpay order for amount: ${amount} ${currency}`,
      );

      // Validate amount
      if (!amount || amount <= 0) {
        // Backend log
        this.logger.error(
          `❌ Invalid amount provided for Razorpay order creation. Amount: ${amount}, Currency: ${currency}`,
        );
        // User-friendly error message
        throw new BadRequestException("Invalid payment amount. Please try again.");
      }

      // Validate Razorpay instance
      if (!this.razorpay) {
        // Backend log
        this.logger.error(
          `❌ Razorpay instance not initialized. keyId=${this.keyId ? "SET" : "MISSING"}, keySecret=${this.keySecret ? "SET" : "MISSING"}. Please configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in app settings.`,
        );
        // User-friendly error message
        throw new BadRequestException("Payment service is temporarily unavailable. Please try again later.");
      }

      const options = {
        amount: amount, // Amount in paise
        currency: currency,
        receipt: receipt || `receipt_${Date.now()}`,
        notes: {
          order_type: "food_delivery",
          created_at: new Date().toISOString(),
        },
      };

      this.logger.log(`🔧 Razorpay options:`, options);
      const order = await this.razorpay.orders.create(options);

      this.logger.log(`✅ Razorpay order created: ${order.id}`);
      return order;
    } catch (error) {
      // Backend log - detailed error information for debugging
      this.logger.error(`❌ Error creating Razorpay order. Amount: ${amount} ${currency}, Receipt: ${receipt || "N/A"}`);
      this.logger.error(`❌ Razorpay API error details:`, {
        message: error?.message,
        code: error?.code,
        statusCode: error?.statusCode,
        response: error?.response,
        stack: error?.stack,
      });
      
      // User-friendly error message
      const userMessage = error?.statusCode === 400 
        ? "Invalid payment request. Please check your payment details and try again."
        : "Unable to process payment at the moment. Please try again later.";
      
      throw new BadRequestException(userMessage);
    }
  }

  /**
   * Verify payment signature
   */
  verifyPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): boolean {
    try {
      this.logger.log(
        `🔍 Verifying payment signature for order: ${razorpayOrderId}`,
      );

      const body = razorpayOrderId + "|" + razorpayPaymentId;
      const expectedSignature = crypto
        .createHmac("sha256", this.keySecret)
        .update(body.toString())
        .digest("hex");

      const isValid = expectedSignature === razorpaySignature;

      this.logger.log(
        `🔐 Payment signature verification: ${isValid ? "VALID" : "INVALID"}`,
      );
      return isValid;
    } catch (error) {
      // Backend log - detailed error information for debugging
      this.logger.error(
        `❌ Error verifying payment signature. Order ID: ${razorpayOrderId}, Payment ID: ${razorpayPaymentId}`,
      );
      this.logger.error(`❌ Signature verification error details:`, {
        message: error?.message,
        stack: error?.stack,
      });
      // Return false for invalid signature - this is handled by the caller
      return false;
    }
  }

  /**
   * Verify webhook signature
   * Uses webhook secret if configured, otherwise falls back to API key secret
   */
  verifyWebhookSignature(body: string, signature: string): boolean {
    try {
      this.logger.log(`🔍 Verifying webhook signature`);

      // Use webhook secret if configured, otherwise fall back to API key secret
      const secretToUse = this.webhookSecret || this.keySecret;
      const secretType = this.webhookSecret ? "webhook secret" : "API key secret (fallback)";

      this.logger.log(`🔐 Using ${secretType} for webhook signature verification`);

      const expectedSignature = crypto
        .createHmac("sha256", secretToUse)
        .update(body)
        .digest("hex");

      const isValid = expectedSignature === signature;

      this.logger.log(
        `🔐 Webhook signature verification: ${isValid ? "VALID" : "INVALID"} (using ${secretType})`,
      );

      if (!isValid && !this.webhookSecret) {
        this.logger.warn(
          `⚠️ Webhook signature verification failed. Consider configuring RAZORPAY_WEBHOOK_SECRET in app settings for better security.`,
        );
      }

      return isValid;
    } catch (error) {
      // Backend log - detailed error information for debugging
      this.logger.error(`❌ Error verifying webhook signature from Razorpay`);
      this.logger.error(`❌ Webhook signature verification error details:`, {
        message: error?.message,
        stack: error?.stack,
        bodyLength: body?.length || 0,
      });
      // Return false for invalid signature - this is handled by the caller
      return false;
    }
  }

  /**
   * Get payment details from Razorpay
   */
  async getPaymentDetails(paymentId: string) {
    try {
      this.logger.log(`💳 Fetching payment details for: ${paymentId}`);

      if (!this.razorpay) {
        // Backend log
        this.logger.error(
          `❌ Razorpay instance not initialized while fetching payment details. Payment ID: ${paymentId}, keyId=${this.keyId ? "SET" : "MISSING"}, keySecret=${this.keySecret ? "SET" : "MISSING"}`,
        );
        // User-friendly error message
        throw new BadRequestException("Payment service is temporarily unavailable. Please try again later.");
      }

      const payment = await this.razorpay.payments.fetch(paymentId);

      this.logger.log(`✅ Payment details fetched: ${payment.id}`);
      return payment;
    } catch (error) {
      // Backend log - detailed error information for debugging
      this.logger.error(
        `❌ Error fetching payment details from Razorpay. Payment ID: ${paymentId}`,
      );
      this.logger.error(`❌ Razorpay API error details:`, {
        message: error?.message,
        code: error?.code,
        statusCode: error?.statusCode,
        response: error?.response,
        stack: error?.stack,
      });
      
      // User-friendly error message
      const userMessage = error?.statusCode === 404
        ? "Payment not found. Please verify your payment details."
        : "Unable to fetch payment details. Please try again later.";
      
      throw new BadRequestException(userMessage);
    }
  }

  /**
   * Capture payment
   */
  async capturePayment(
    paymentId: string,
    amount: number,
    currency: string = "INR",
  ) {
    try {
      this.logger.log(
        `💰 Capturing payment: ${paymentId} for amount: ${amount}`,
      );

      const payment = await this.razorpay.payments.capture(
        paymentId,
        amount,
        currency,
      );

      this.logger.log(`✅ Payment captured successfully: ${payment.status}`);
      return payment;
    } catch (error) {
      // Backend log - detailed error information for debugging
      this.logger.error(
        `❌ Error capturing payment in Razorpay. Payment ID: ${paymentId}, Amount: ${amount} ${currency}`,
      );
      this.logger.error(`❌ Razorpay API error details:`, {
        message: error?.message,
        code: error?.code,
        statusCode: error?.statusCode,
        response: error?.response,
        stack: error?.stack,
      });
      
      // User-friendly error message
      const userMessage = error?.statusCode === 400
        ? "Payment capture failed. Please contact support for assistance."
        : "Unable to process payment. Please try again later.";
      
      throw new BadRequestException(userMessage);
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
          reason: "customer_request",
          refunded_at: new Date().toISOString(),
        },
      };

      if (amount) {
        refundOptions.amount = amount;
      }

      const refund = await this.razorpay.payments.refund(
        paymentId,
        refundOptions,
      );

      this.logger.log(`✅ Refund processed successfully: ${refund.id}`);
      return refund;
    } catch (error) {
      // Backend log - detailed error information for debugging
      this.logger.error(
        `❌ Error processing refund in Razorpay. Payment ID: ${paymentId}, Amount: ${amount || "FULL"}, Notes: ${JSON.stringify(notes || {})}`,
      );
      this.logger.error(`❌ Razorpay API error details:`, {
        message: error?.message,
        code: error?.code,
        statusCode: error?.statusCode,
        response: error?.response,
        stack: error?.stack,
      });
      
      // User-friendly error message
      const userMessage = error?.statusCode === 400
        ? "Refund request is invalid. Please contact support for assistance."
        : "Unable to process refund at the moment. Please try again later or contact support.";
      
      throw new BadRequestException(userMessage);
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
      name: orderData.restaurant_name || "Food Delivery",
      description: `Order #${orderData.order_number}`,
      order_id: orderData.razorpay_order_id,
      prefill: {
        name: customerData.name,
        email: customerData.email,
        contact: customerData.phone,
      },
      notes: {
        order_id: orderData.order_id,
        order_number: orderData.order_number,
      },
      theme: {
        color: "#3399cc",
      },
      handler: function (response: any) {
        // This will be handled by the frontend
        console.log("Payment successful:", response);
      },
    };
  }
}
