import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { AppSettingsService } from "./app-settings.service";

@Injectable()
export class DeliveryPricingService {
  private readonly logger = new Logger(DeliveryPricingService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly appSettingsService: AppSettingsService,
  ) { }

  /**
   * Get delivery charge and estimated delivery time from Delivery Pricing API
   * @param pickupLat Pickup latitude (store location)
   * @param pickupLng Pickup longitude (store location)
   * @param dropoffLat Dropoff latitude (user location)
   * @param dropoffLng Dropoff longitude (user location)
   * @returns Object with delivery charge, distance, and estimated_delivery_time, or { charge: 0, distance: 0, estimated_delivery_time: null } if API call fails
   */
  async getDeliveryCharge(
    pickupLat: number,
    pickupLng: number,
    dropoffLat: number,
    dropoffLng: number,
  ): Promise<{
    charge: number;
    tax: number;
    percent: number;
    distance: number;
    estimated_delivery_time: string | null;
  }> {
    try {
      // Get API configuration from app settings
      const baseUrl = await this.appSettingsService.get("TAZTY_DELIVERY_PARTNER_API_BASE_URL");
      const apiToken = await this.appSettingsService.get("TAZTY_DELIVERY_PARTNER_API_KEY");

      if (!apiToken || !baseUrl) {
        this.logger.warn(
          "Delivery Pricing API not configured in app settings. TAZTY_DELIVERY_PARTNER_API_BASE_URL and TAZTY_DELIVERY_PARTNER_API_KEY must be set. Returning default values.",
        );
        return {
          charge: 0,
          tax: 0,
          percent: 0,
          distance: 0,
          estimated_delivery_time: null,
        };
      }

      const apiUrl = baseUrl.trim().endsWith("/")
        ? `${baseUrl.trim()}quote/delivery-charge`
        : `${baseUrl.trim()}/quote/delivery-charge`;

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
          apiUrl,
          requestBody,
          {
            headers: {
              accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiToken}`,
            },
            timeout: 10000, // 10 seconds timeout
          },
        ),
      );
      
      if (!response.data) {
        this.logger.warn("TAZTY Delivery Pricing API returned no data");
        return {
          charge: 0,
          tax: 0,
          percent: 0,
          distance: 0,
          estimated_delivery_time: null,
        };
      }

      // Extract response data matching API structure: { distance, charge, currency, policy_type, estimated_delivery_time }
      const charge = Number(response.data.charge ?? 0);
      const tax = Number(response.data.tax ?? 0);
      const percent = Number(response.data.percentage ?? 0);
      const distance = Number(response.data.distance ?? 0);
      const currency = response.data.currency || "INR";
      const policyType = response.data.policy_type;
      const estimatedDeliveryTime = response.data.estimated_delivery_time || null;

      this.logger.log(
        `✅ Delivery charge fetched: ₹${charge} + ₹${tax} (distance: ${distance}km, currency: ${currency}, policy: ${policyType}, estimated_time: ${estimatedDeliveryTime || "N/A"})`,
      );

      return {
        charge,
        tax,
        percent,
        distance, // Include distance in response
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
      return {
        charge: 0,
        tax: 0,
        percent: 0,
        distance: 0,
        estimated_delivery_time: null,
      };
    }
  }
}

