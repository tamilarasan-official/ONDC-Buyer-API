import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Order } from "../order/entities/order.entity";
import { Item } from "../item/entities/item.entity";

@Injectable()
export class SellerPushService {
  private readonly logger = new Logger(SellerPushService.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
  ) {}

  /**
   * Push order to seller immediately after order creation
   */
  async pushOrderToSeller(order: Order): Promise<void> {
    try {
      this.logger.log(`🚀 Pushing order ${order.order_number} to seller`);

      const payload = await this.transformOrderToSellerPayload(order);

      // Get seller API URL from environment
      const sellerApiUrl =
        process.env.SELLER_API_URL || "http://localhost:3001";
      const endpoint = `${sellerApiUrl}/orders`;

      this.logger.log(`Sending order to seller endpoint: ${endpoint}`);
      this.logger.log(`📤 SELLER PUSH PAYLOAD:`);
      this.logger.log(JSON.stringify(payload, null, 2));

      // Send HTTP request to seller
      const response = await firstValueFrom(
        this.httpService.post(endpoint, payload, {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 10000, // 10 second timeout
        }),
      );

      this.logger.log(
        `✅ Order ${order.order_number} pushed to seller successfully. Status: ${response.status}`,
      );
      return response.data;
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
      // Add main item
      items.push({
        product_id: orderItem.item.reference_id,
        quantity: orderItem.quantity,
        price: Number(orderItem.unit_price || 0).toFixed(2),
      });

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
   * Transform order data to seller payload format
   */
  private async transformOrderToSellerPayload(order: Order) {
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

    return {
      contact_number: order.user.phone_number.toString(),
      store_id: order.store.reference_id,
      items: await this.buildItemsArray(order.order_items),
      billing: {
        name: order.user.name || "Customer",
        email: order.user.email || order.user.phone_number + "@tazty.com", // Use phone as fallback email
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
        email: order.user.email || order.user.phone_number + "@tazty.com", // Use phone as fallback email
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
      delivery_charge: Number(order.delivery_fee).toFixed(2),
      total_amount: Number(order.total_amount).toFixed(2),
      external_order_no: order.order_number,
      order_through: "tazty",
      collected_by:order.payment_method === "cod" ? "seller" : "buyer",
    };
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
      const sellerApiUrl =
        process.env.SELLER_API_URL || "http://localhost:3001";
      const endpoint = `${sellerApiUrl}/orders`;

      this.logger.log(`🧪 Testing seller push to: ${endpoint}`);

      const response = await firstValueFrom(
        this.httpService.post(endpoint, testPayload, {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 10000,
        }),
      );

      this.logger.log(
        `✅ Test seller push successful. Status: ${response.status}`,
      );
    } catch (error) {
      this.logger.error(`❌ Test seller push failed: ${error.message}`);
      if (error.response) {
        this.logger.error(
          `Seller API Error Response: ${JSON.stringify(error.response.data)}`,
        );
      }
    }
  }
}
