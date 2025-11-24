import { Injectable, Logger, HttpException, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { v4 as uuidv4 } from "uuid";
import {
  ONDCSearchRequestDto,
  ONDCSearchResponseDto,
} from "./dto/ondc-search.dto";

@Injectable()
export class OndcSearchService {
  private readonly logger = new Logger(OndcSearchService.name);
  private readonly bap_id: string;
  private readonly bap_uri: string;
  private readonly bpp_id: string;
  private readonly bpp_uri: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.bap_id = this.configService.get<string>("ONDC_BAP_ID") || "";
    this.bap_uri = this.configService.get<string>("ONDC_BAP_URI") || "";
    this.bpp_id = this.configService.get<string>("ONDC_BPP_ID") || "";
    this.bpp_uri = this.configService.get<string>("ONDC_BPP_URI") || "";
  }

  /**
   * Perform ONDC search request
   */
  async performSearch(searchParams: {
    city?: string;
    gps?: string;
    area_code?: string;
    search_term?: string;
    category_id?: string;
    storeId?: string;
  }): Promise<ONDCSearchResponseDto[]> {
    try {
      const searchRequest = this.buildSearchRequest(searchParams);

      this.logger.log(
        `Performing ONDC search for city: ${searchParams.city || "default"}`,
      );

      const ondcSearchUrl = `${this.bpp_uri}/search`;
      const response = await firstValueFrom(
        this.httpService.post(ondcSearchUrl, searchRequest, {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 30000, // 30 seconds timeout
        }),
      );

      if (!response.data) {
        throw new HttpException(
          "No data received from ONDC search",
          HttpStatus.NO_CONTENT,
        );
      }

      // ONDC search may return array of responses (one per provider)
      const responses = Array.isArray(response.data)
        ? response.data
        : [response.data];

      this.logger.log(
        `Received ${responses.length} provider response(s) from ONDC search`,
      );

      return responses;
    } catch (error) {
      this.logger.error(`ONDC search failed: ${error.message}`, error.stack);

      if (error.response?.status === 404) {
        throw new HttpException(
          "ONDC search endpoint not found",
          HttpStatus.NOT_FOUND,
        );
      } else if (error.response?.status >= 500) {
        throw new HttpException(
          "ONDC service temporarily unavailable",
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      } else if (error.code === "ECONNABORTED") {
        throw new HttpException(
          "ONDC search request timeout",
          HttpStatus.REQUEST_TIMEOUT,
        );
      }

      throw new HttpException(
        `ONDC search failed: ${error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Build ONDC search request payload
   */
  private buildSearchRequest(searchParams: {
    city?: string;
    gps?: string;
    area_code?: string;
    search_term?: string;
    category_id?: string;
    storeId?: string;
  }): ONDCSearchRequestDto {
    const transactionId = uuidv4();
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();
     
    if (!this.bap_id || !this.bap_uri || !this.bpp_id || !this.bpp_uri) {
      throw new HttpException(
        "ONDC_BAP_ID, ONDC_BAP_URI, ONDC_BPP_ID, and ONDC_BPP_URI must be configured",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    let searchRequest: ONDCSearchRequestDto = {
      context: {
        domain: "ONDC:RET11", // F&B domain
        action: "search",
        country: "IND",
        city: searchParams.city || "std:0452",
        core_version: "1.2.0",
        bap_id: this.bap_id,
        bap_uri: this.bap_uri,
        bpp_id: this.bpp_id,
        bpp_uri:this.bpp_uri,
        transaction_id: transactionId,
        message_id: messageId,
        timestamp: timestamp,
        ttl: "PT30S",
      },
      message: {
        intent: {
          payment: {
            "@ondc/org/buyer_app_finder_fee_type": "percent",
            "@ondc/org/buyer_app_finder_fee_amount": "3",
          },
        },
      },
    };

    // Add search filters if provided
    if (searchParams.search_term) {
      searchRequest.message.intent.item = {
        descriptor: {
          name: searchParams.search_term,
        },
      };
    }

    if (searchParams.category_id) {
      searchRequest.message.intent.category = {
        id: searchParams.category_id,
      };
    }

    if (searchParams.gps || searchParams.area_code) {
      searchRequest.message.intent.fulfillment = {
        end: {
          location: {
            gps: searchParams.gps,
            area_code: searchParams.area_code,
          },
        },
      };
    }

    if (searchParams.storeId) {
      searchRequest.message.catalog = {
        "bpp/providers": [{ id: searchParams.storeId }],
      };
    }

    return searchRequest;
  }

  /**
   * Perform a complete catalog refresh search - returns only acknowledgement
   */
  async performCatalogRefresh(
    city: string = "std:0452",
    storeId?: string,
  ): Promise<{ success: boolean; message_id: string; ack_status: string }> {
    this.logger.log(`Starting complete catalog refresh for city: ${city}`);

    try {
      // Step 1: Send SEARCH request (gets acknowledgement only)
      const searchRequest = this.buildSearchRequest({ city, storeId });
      
      const ondcSearchUrl = `${this.bpp_uri}/search`;
      const searchResponse = await this.httpService.axiosRef.post(
        ondcSearchUrl,
        searchRequest,
      );

      // Step 2: Extract acknowledgement details
      const ack = searchResponse.data.message?.ack;
      const messageId = searchResponse.data.context?.message_id || "unknown";
      const ackStatus = ack?.status || "unknown";

      this.logger.log(
        `Search request sent successfully. Message ID: ${messageId}, Status: ${ackStatus}`,
      );

      return {
        success: ackStatus === "ACK",
        message_id: messageId,
        ack_status: ackStatus,
      };
    } catch (error) {
      this.logger.error(`Search request failed: ${error.message}`, error.stack);
      return {
        success: false,
        message_id: "unknown",
        ack_status: "NACK",
      };
    }
  }

  /**
   * Search for specific items or categories
   */
  async searchSpecific(searchParams: {
    city?: string;
    search_term?: string;
    category_id?: string;
    gps?: string;
    area_code?: string;
    storeId?: string;
  }): Promise<ONDCSearchResponseDto[]> {
    this.logger.log(
      `Performing specific search: ${JSON.stringify(searchParams)}`,
    );

    return this.performSearch(searchParams);
  }
}
