import { Injectable, Logger } from "@nestjs/common";
import { MailerService } from "@nestjs-modules/mailer";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async storeCreation(to: string, storeDetails: any) {
    try {
      await this.mailerService.sendMail({
        to,
        subject: "Your Store has been created!",
        template: "store-registration",
        context: {
          store: storeDetails,
        },
      });

      this.logger.log(`Store creation email sent successfully to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send store creation email to ${to}:`, error);
    }
  }

  async forgotPassword(to: string, userDetails: any) {
    try {
      await this.mailerService.sendMail({
        to,
        subject: "Password reset requested",
        template: "forgot-password",
        context: {
          resetLink: userDetails.resetLink,
          userName: userDetails.userName,
        },
      });

      this.logger.log(`Password reset email sent successfully to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to}:`, error);
    }
  }

  async orderDelivered(to: string, orderDetails: any) {
    try {
      await this.mailerService.sendMail({
        to,
        subject: `Your Tazty order #${orderDetails.order_number} was delivered`,
        template: "order-delivered",
        context: {
          app_url: process.env.APP_URL ?? 'http://localhost:3008',
          customer_name: orderDetails.customer_name,
          order_number: orderDetails.order_number,
          store_name: orderDetails.store_name,
          store_address: orderDetails.store_address,
          delivery_address: orderDetails.delivery_address,
          order_items: orderDetails.order_items,
          subtotal: orderDetails.subtotal,
          platform_fee: orderDetails.platform_fee,
          delivery_fee: orderDetails.delivery_fee,
          tax_amount: orderDetails.tax_amount,
          total_amount: orderDetails.total_amount,
          payment_method: orderDetails.payment_method,
          payment_label: orderDetails.payment_label,
          placed_at: orderDetails.placed_at,
          delivered_at: orderDetails.delivered_at,
          invoice_url: orderDetails.invoice_url ?? null,
        },
      });

      this.logger.log(
        `Order delivered email sent successfully to ${to} for order #${orderDetails.order_number}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send order delivered email to ${to} for order #${orderDetails.order_number}:`,
        error,
      );
    }
  }
}
