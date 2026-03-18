import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Order } from "../order/entities/order.entity";
import { Item } from "../item/entities/item.entity";
import { Coupon } from "../coupon/entities/coupon.entity";
import { AppSettings } from "../shared/entities/app-settings.entity";
import { platform } from "os";
import { CartService } from "./cart.service";
import { SellerSyncQueueService } from "../seller-sync/seller-sync.queue.service";

@Injectable()
export class SellerPushService {
  private readonly logger = new Logger(SellerPushService.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
    @InjectRepository(AppSettings)
    private readonly appSettingsRepository: Repository<AppSettings>,
    private readonly cartService: CartService,
    private readonly sellerSyncQueueService: SellerSyncQueueService,
  ) { }

  /**
   * Push order to seller: insert outbox first (durable), then enqueue. On success mark queued.
   * COD orders use a delay (SELLER_SYNC_COD_DELAY_MS, default 30s).
   */
  async pushOrderToSeller(order: Order): Promise<void> {
    try {
      this.logger.log(
        `Enqueuing order ${order.order_number} for seller sync`,
      );

      const payload = await this.transformOrderToSellerPayload(order);

      let row = await this.sellerSyncQueueService.getOutboxRow(
        "order.push",
        order.order_number,
      );
      if (!row) {
        row = await this.sellerSyncQueueService.addOutboxRow(
          "order.push",
          order.order_number,
          payload as Record<string, unknown>,
        );
      }

      const delayMs =
        order.payment_method === "cod"
          ? this.sellerSyncQueueService.getCodDelayMs()
          : undefined;

      const jobId = await this.sellerSyncQueueService.enqueueOrderPush(
        payload,
        delayMs != null ? { delayMs } : undefined,
      );
      await this.sellerSyncQueueService.updateOutboxToQueued(
        row.id,
        jobId ?? undefined,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to push order ${order.order_number} to seller: ${error.message}`,
        error.stack,
      );

      // Don't throw error - we don't want to fail order creation if seller push fails
      // Just log the error for monitoring
      if (error.response) {
        this.logger.error(
          `Seller API Error Response: ${JSON.stringify(error.response.data)}`,
        );
      }
    }
  }

  /**
   * Build items array including main items and customization items
   */
  private async buildItemsArray(orderItems: any[]): Promise<any[]> {
    const items: any[] = [];

    for (const orderItem of orderItems) {
      // Build base item object
      const itemPayload: any = {
        product_id: orderItem.item.reference_id,
        quantity: orderItem.quantity,
        price: Number(orderItem.unit_price || 0).toFixed(2),
      };

      // NEW: Add preorder details if this is a preorder item
      if (orderItem.is_preorder && orderItem.preorder_campaign_id) {
        try {
          const preorderCoupon = await this.couponRepository.findOne({
            where: { id: orderItem.preorder_campaign_id },
          });

          if (preorderCoupon && preorderCoupon.type_meta) {
            itemPayload.is_preorder = true;
            itemPayload.preorder_campaign = {
              campaign_id: preorderCoupon.campaign_id,
              title: preorderCoupon.type_meta.title || "Preorder",
              delivery_date: preorderCoupon.type_meta.delivery_date,
              free_delivery: preorderCoupon.type_meta.free_delivery === true,
            };
          }
        } catch (error) {
          this.logger.warn(
            `Could not fetch preorder coupon ${orderItem.preorder_campaign_id}: ${error.message}`,
          );
        }
      }

      items.push(itemPayload);

      // Add customization items if they exist
      if (orderItem.customizations && Array.isArray(orderItem.customizations)) {
        for (const customization of orderItem.customizations) {
          if (
            customization.selected_options &&
            Array.isArray(customization.selected_options)
          ) {
            // Get customization item details for each selected option
            for (const optionId of customization.selected_options) {
              try {
                // Find the customization item by ID (this would need to be injected or passed)
                // For now, we'll need to modify the method to accept item repository
                // This is a temporary solution - we need to refactor this
                const customizationItem = await this.getItemById(optionId);
                if (customizationItem && customizationItem.reference_id) {
                  items.push({
                    product_id: customizationItem.reference_id,
                    quantity: orderItem.quantity, // Customization quantity matches main item quantity
                    price: Number(
                      customizationItem.prices?.[0]?.base_price || 0,
                    ).toFixed(2),
                  });
                }
              } catch (error) {
                this.logger.warn(
                  `Could not find customization item with ID ${optionId}: ${error.message}`,
                );
              }
            }
          }
        }
      }
    }

    return items;
  }

  /**
   * Get item by ID with prices
   */
  private async getItemById(itemId: number): Promise<Item | null> {
    try {
      return await this.itemRepository
        .createQueryBuilder("item")
        .leftJoinAndSelect("item.prices", "price")
        .where("item.id = :id", { id: itemId })
        .getOne();
    } catch (error) {
      this.logger.error(`Error fetching item ${itemId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Transform order data to seller payload format.
   * Public so OrderService can build payload inside the same transaction as order creation.
   */
  async transformOrderToSellerPayload(order: Order) {
    const address = {
      address1: order.delivery_address_line1,
      address2: order.delivery_address_line2,
      address3: order.delivery_address_line3,
      city: order.delivery_city,
      state: order.delivery_state,
      pincode: order.delivery_pincode,
      latitude: order.delivery_latitude,
      longitude: order.delivery_longitude,
    };

    // Build items array with preorder details
    const items = await this.buildItemsArray(order.order_items);

    // NEW: Check if order has any preorder items
    const hasPreorderItems = order.order_items?.some(
      (item) => item.is_preorder === true,
    );

    // NEW: Get preorder delivery date (from first preorder item)
    let preorderDeliveryDate: string | undefined;
    if (hasPreorderItems) {
      const firstPreorderItem = order.order_items?.find(
        (item) => item.is_preorder === true && item.preorder_campaign_id,
      );
      if (firstPreorderItem?.preorder_campaign_id) {
        try {
          const preorderCoupon = await this.couponRepository.findOne({
            where: { id: firstPreorderItem.preorder_campaign_id },
          });
          if (preorderCoupon?.type_meta?.delivery_date) {
            preorderDeliveryDate = preorderCoupon.type_meta.delivery_date;
          }
        } catch (error) {
          this.logger.warn(
            `Could not fetch preorder delivery date: ${error.message}`,
          );
        }
      }
    }
    // Get payment gateway charges from app settings
    const paymentGatewayChargesDetails = await this.appSettingsRepository.findOne({
      where: { key: "PAYMENT_GATEWAY_CHARGES_PERCENT" },
    });
    const paymentGatewayChargesPercent = parseFloat(paymentGatewayChargesDetails?.value || '0');
    
    // Convert order values to numbers for calculations
    const platformFee = parseFloat(String(order.platform_fee || 0));
    const platformFeeTax = parseFloat(String(order.platform_fee_tax || 0));
    const platformPercent = parseFloat(String(order.platform_percent || 18.00));
    
    const paymentGatewayCharges = (order.total_amount * paymentGatewayChargesPercent) / 100;
    const buyerappFinderFee = platformFee - paymentGatewayCharges;
    const totalBuyerappCharges = buyerappFinderFee + platformFeeTax;

    const buyer_app_settlement_config = {
      platform_fee: platformFee.toFixed(2),
      platform_fee_tax: platformFeeTax.toFixed(2),
      platform_percent: platformPercent.toFixed(2),
      payment_gateway_charges: paymentGatewayCharges.toFixed(2),
      payment_gateway_charges_percent: paymentGatewayChargesPercent.toFixed(2),
      buyer_app_charges: buyerappFinderFee.toFixed(2),
      buyer_app_charges_tax: platformFeeTax.toFixed(2),
      total_buyer_app_charges: totalBuyerappCharges.toFixed(2),
      settlement_done_by: "seller",
      settlement_amount: buyerappFinderFee.toFixed(2),

      buyer_app_charge_type:'amount',
      settlement_basis:'delivery',
      settlement_window:'P3D',
      withholding_amount:0,
    }

    const payload: any = {
      contact_number: order.user.phone_number.toString(),
      store_id: order.store.reference_id,
      items: items,
      billing: {
        name: order.user.name || "Customer",
        email: order.user.email || order.user.phone_number + "@tazty.in", // Use phone as fallback email
        phone: order.user.phone_number.toString(),
        address: {
          address1: address.address1,
          address2: address.address2 || "",
          address3: address.address3 || "",
          city: address.city,
          state: address.state,
          country: "IND", // Default to India
          pincode: address.pincode.toString(), // Ensure pincode is string
          gps: `${Number(address.latitude || 0)},${Number(address.longitude || 0)}`,
        },
      },
      shipping: {
        name: order.user.name || "Customer",
        email: order.user.email || order.user.phone_number + "@tazty.in", // Use phone as fallback email
        phone: order.user.phone_number.toString(),
        address: {
          address1: address.address1,
          address2: address.address2 || "",
          address3: address.address3 || "",
          city: address.city,
          state: address.state,
          country: "IND", // Default to India
          pincode: address.pincode.toString(), // Ensure pincode is string
          gps: `${Number(address.latitude || 0)},${Number(address.longitude || 0)}`,
        },
      },
      delivery_type: "Delivery",
      instructions: order.notes,
      pickup_date_time: "",
      payment_method: order.payment_method,
      payment_status: order.payment_status === "paid" ? "received" : "pending",
      delivery_charge: Number(order.delivery_fee || 0).toFixed(2),
      platform_charge: Number(order.platform_fee || 0).toFixed(2),
      delivery_percent: Number(order.delivery_percent || 18.00).toFixed(2),
      platform_percent: Number(order.platform_percent || 18.00).toFixed(2),
      delivery_fee_tax: Number(order.delivery_fee_tax || 0).toFixed(2),
      platform_fee_tax: Number(order.platform_fee_tax || 0).toFixed(2),
      discount_amount: Number(order.discount_amount || 0).toFixed(2),
      tax_amount: Number(order.tax_amount || 0).toFixed(2),
      total_tax_amount: Number(order.total_tax_amount || 0).toFixed(2),
      tip_amount: Number(order.tip_amount || 0).toFixed(2),
      total_amount: Number(order.total_amount || 0).toFixed(2),
      external_order_no: order.order_number,
      order_through: "tazty",
      collected_by: order.payment_method === "cod" ? "seller" : "buyer",
      buyer_app_settlement_config,
    };

    // NEW: Add preorder fields if order has preorder items
    if (hasPreorderItems) {
      payload.order_type = "preorder";
      if (preorderDeliveryDate) {
        payload.preorder_delivery_date = preorderDeliveryDate;
        // Use preorder delivery_date for pickup_date_time and estimated_delivery_time
        payload.pickup_date_time = preorderDeliveryDate;
      }
      // Include estimated_delivery_time from order (which was set based on preorder delivery_date)
      if (order.estimated_delivery_time) {
        payload.estimated_delivery_time = order.estimated_delivery_time.toISOString();
      }
    } else {
      // For regular orders, use order's estimated_delivery_time if available
      if (order.estimated_delivery_time) {
        payload.estimated_delivery_time = order.estimated_delivery_time.toISOString();
      }
    }

    return payload;
  }

  /**
   * Test seller push with sample data
   */
  async testSellerPush(): Promise<void> {
    const testPayload = {
      contact_number: "9629295619",
      store_id: "test_store_123",
      items: [
        {
          product_id: "test_item_456",
          quantity: 1,
          price: "30.00",
        },
      ],
      billing: {
        name: "Test Customer",
        email: "test@example.com",
        phone: "9629295619",
        address: {
          address1: "Test Address",
          address2: "Test Street",
          address3: "Test Area",
          city: "Madurai",
          state: "Tamil Nadu",
          country: "IND",
          pincode: "625002",
          gps: "9.938019,78.127190",
        },
      },
      shipping: {
        name: "Test Customer",
        email: "test@example.com",
        phone: "9629295619",
        address: {
          address1: "Test Address",
          address2: "Test Street",
          address3: "Test Area",
          city: "Madurai",
          state: "Tamil Nadu",
          country: "IND",
          pincode: "625002",
          gps: "9.938019,78.127190",
        },
      },
      delivery_type: "Delivery",
      pickup_date_time: "",
      payment_method: "online",
      payment_status: "received",
      delivery_charge: "84.96",
      total_amount: "254.96",
      external_order_no: "2025-09-16-510562",
      order_through: "tazty",
    };

    try {
      // Route test payload through async seller sync queue as an order push
      await this.sellerSyncQueueService.enqueueOrderPush(testPayload);

      // Previous direct HTTP call – kept for reference
      // const sellerApiUrl =
      //   process.env.SELLER_API_URL || "http://localhost:3001";
      // const endpoint = `${sellerApiUrl}/orders`;
      // const response = await firstValueFrom(
      //   this.httpService.post(endpoint, testPayload, {
      //     headers: {
      //       "Content-Type": "application/json",
      //       Accept: "application/json",
      //     },
      //     timeout: 10000,
      //   }),
      // );
      // this.logger.log(
      //   `✅ Test seller push successful. Status: ${response.status}`,
      // );
    } catch (error) {
      this.logger.error(`❌ Test seller push failed: ${error.message}`);
    }
  }
}
