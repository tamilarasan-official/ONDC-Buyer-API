import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";

@Injectable()
export class DeliveryPricingService {
  private readonly logger = new Logger(DeliveryPricingService.name);
  private readonly apiUrl: string;
  private readonly apiToken: string | undefined;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const baseUrl =
      this.configService.get<string>("TAZTY_DELIVERY_PARTNER_API_BASE_URL") || "";
    this.apiUrl = baseUrl.length > 0 ? `${baseUrl}/quote/delivery-charge` : "";
    this.apiToken = this.configService.get<string>(
      "TAZTY_DELIVERY_PARTNER_API_KEY",
    );

    if (!this.apiToken) {
      this.logger.warn(
        "TAZTY_DELIVERY_PARTNER_API_KEY not configured. Delivery fee API calls will fail.",
      );
    }
  }

  /**
   * Get delivery charge and estimated delivery time from Delivery Pricing API
   * @param pickupLat Pickup latitude (store location)
   * @param pickupLng Pickup longitude (store location)
   * @param dropoffLat Dropoff latitude (user location)
   * @param dropoffLng Dropoff longitude (user location)
   * @returns Object with delivery charge and estimated_delivery_time, or { charge: 0, estimated_delivery_time: null } if API call fails
   */
  async getDeliveryCharge(
    pickupLat: number,
    pickupLng: number,
    dropoffLat: number,
    dropoffLng: number,
  ): Promise<{ charge: number; estimated_delivery_time: string | null }> {
    try {
      if (!this.apiToken) {
        this.logger.warn(
          "Delivery Pricing API token not configured. Returning default values.",
        );
        return { charge: 0, estimated_delivery_time: null };
      }

      this.logger.log(
        `📦 Fetching delivery charge: pickup(${pickupLat}, ${pickupLng}) → dropoff(${dropoffLat}, ${dropoffLng})`,
      );

      const requestBody = {
        pickup: {
          lat: pickupLat,
          lng: pickupLng,
        },
        dropoff: {
          lat: dropoffLat,
          lng: dropoffLng,
        },
      };

      const response = await firstValueFrom(
        this.httpService.post(
          this.apiUrl,
          requestBody,
          {
            headers: {
              accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.apiToken}`,
            },
            timeout: 10000, // 10 seconds timeout
          },
        ),
      );

      if (!response.data) {
        this.logger.warn("TAZTY Delivery Pricing API returned no data");
        return { charge: 0, estimated_delivery_time: null };
      }

      // Extract response data matching API structure: { distance, charge, currency, policy_type, estimated_delivery_time }
      const charge = Number(response.data.charge ?? 0);
      const distance = Number(response.data.distance ?? 0);
      const currency = response.data.currency || "INR";
      const policyType = response.data.policy_type;
      const estimatedDeliveryTime = response.data.estimated_delivery_time || null;

      this.logger.log(
        `✅ Delivery charge fetched: ₹${charge} (distance: ${distance}km, currency: ${currency}, policy: ${policyType}, estimated_time: ${estimatedDeliveryTime || "N/A"})`,
      );

      return {
        charge,
        estimated_delivery_time: estimatedDeliveryTime,
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to fetch delivery charge: ${error.message}`,
        error.stack,
      );

      // Handle specific error types
      if (error.code === "ECONNABORTED") {
        this.logger.warn("Delivery Pricing API request timeout");
      } else if (error.response?.status) {
        this.logger.warn(
          `Delivery Pricing API returned status ${error.response.status}`,
        );
      }

      // Always return default values on error (fallback strategy)
      return { charge: 0, estimated_delivery_time: null };
    }
  }
}

