import { Controller, Get, Query, Post, Body, Logger } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from "@nestjs/swagger";
import { OndcSearchService } from "./ondc-search.service";
import { CatalogIngestionService } from "../catalog-ingestion/catalog-ingestion.service";
import { ONDCOnSearchResponseDto } from "./dto/ondc-search.dto";

@ApiTags("ONDC Search")
@Controller("ondc-search")
export class OndcSearchController {
  private readonly logger = new Logger(OndcSearchController.name);

  constructor(
    private readonly ondcSearchService: OndcSearchService,
    private readonly catalogIngestionService: CatalogIngestionService,
  ) {}

  /**
   * Test endpoint for ONDC catalog refresh - sends SEARCH request only
   */
  @Post("catalog-refresh")
  @ApiOperation({
    summary: "Trigger ONDC catalog refresh",
    description:
      "Sends a SEARCH request to ONDC network to refresh catalog data. The search URL is dynamically constructed from the configured BPP URI. The catalog data will be received asynchronously via /on_search webhook endpoint. Optionally filter by specific store ID.",
  })
  @ApiBody({
    description: "Catalog refresh parameters",
    schema: {
      type: "object",
      properties: {
        city: {
          type: "string",
          example: "std:0452",
          description: "City code for catalog refresh (e.g., std:0452 for Madurai, std:080 for Bangalore)",
        },
        storeId: {
          type: "string",
          example: "965",
          description: "Optional store/provider ID to refresh specific store catalog",
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Search request sent successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: {
          type: "string",
          example:
            "Search request sent to ONDC. Catalog data will be received via /on_search webhook.",
        },
        data: {
          type: "object",
          properties: {
            message_id: {
              type: "string",
              example: "f6ea6c85-4338-4503-a0d1-5a888bb916f4",
            },
            ack_status: { type: "string", example: "ACK" },
            status: {
              type: "string",
              example: "waiting_for_catalog",
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Catalog refresh failed",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Catalog refresh failed" },
        error: { type: "string", example: "Search request failed" },
      },
    },
  })
  async catalogRefresh(@Body() body: { city?: string, storeId?: string }) {
    try {
      const result = await this.ondcSearchService.performCatalogRefresh(
        body.city,
        body.storeId,
      );

      return {
        success: result.success,
        message: result.success
          ? "Search request sent to ONDC. Catalog data will be received via /on_search webhook."
          : "Search request failed",
        data: {
          message_id: result.message_id,
          ack_status: result.ack_status,
          status: result.success ? "waiting_for_catalog" : "search_failed",
        },
      };
    } catch (error) {
      return {
        success: false,
        message: "Catalog refresh failed",
        error: error.message,
      };
    }
  }

  /**
   * Test endpoint for specific ONDC search
   */
  @Post("search")
  @ApiOperation({
    summary: "Perform ONDC search",
    description:
      "Test endpoint to perform specific ONDC search with custom parameters. The search URL is dynamically constructed from the configured BPP URI. Optionally filter by specific store ID.",
  })
  @ApiBody({
    description: "Search parameters for ONDC search",
    schema: {
      type: "object",
      properties: {
        city: {
          type: "string",
          example: "std:0452",
          description: "City code for search",
        },
        search_term: {
          type: "string",
          example: "pizza",
          description: "Search term",
        },
        category_id: {
          type: "string",
          example: "F&B",
          description: "Category ID",
        },
        gps: {
          type: "string",
          example: "12.9716,77.5946",
          description: "GPS coordinates",
        },
        area_code: {
          type: "string",
          example: "560001",
          description: "Area code",
        },
        storeId: {
          type: "string",
          example: "965",
          description: "Optional store/provider ID to search specific store",
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Search completed successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Search completed successfully" },
        data: {
          type: "object",
          properties: {
            providers_count: { type: "number", example: 5 },
            search_params: { type: "object" },
            responses: { type: "array", items: { type: "object" } },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Search failed",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Search failed" },
        error: { type: "string", example: "Invalid search parameters" },
        search_params: { type: "object" },
      },
    },
  })
  async search(
    @Body()
    searchParams: {
      city?: string;
      search_term?: string;
      category_id?: string;
      gps?: string;
      area_code?: string;
      storeId?: string;
    },
  ) {
    try {
      const result = await this.ondcSearchService.searchSpecific(searchParams);

      return {
        success: true,
        message: "Search completed",
        data: {
          providers_count: result.length,
          search_params: searchParams,
          responses: result,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: "Search failed",
        error: error.message,
        search_params: searchParams,
      };
    }
  }

  /**
   * ONDC webhook endpoint to receive catalog data - handles multiple ON_SEARCH calls
   */
  @Post("on_search")
  @ApiOperation({
    summary: "Receive ONDC catalog data",
    description:
      "Webhook endpoint to receive catalog data from ONDC network. Processes catalog data and returns ACK/NACK response.",
  })
  @ApiBody({
    description: "ONDC on_search catalog payload",
    type: ONDCOnSearchResponseDto,
    examples: {
      "complete-catalog": {
        summary: "Complete Catalog Payload",
        description: "Full catalog payload with all required fields",
        value: {
          context: {
            domain: "ONDC:RET11",
            country: "IND",
            city: "std:0452",
            action: "on_search",
            core_version: "1.2.0",
            bap_id: "devapi.tazty.in",
            bap_uri: "https://devapi.tazty.in",
            bpp_id: "ondcbeta.squadcube.in",
            bpp_uri: "https://ondcbeta.squadcube.in/sqc",
            transaction_id: "f6ea6c85-4338-4503-a0d1-5a888bb916f4",
            message_id: "f6ea6c85-4338-4503-a0d1-5a888bb916f4",
            timestamp: "2025-10-28T21:43:52.344Z",
            ttl: "PT30S",
          },
          message: {
            catalog: {
              "bpp/descriptor": {
                name: "Squadcube",
                short_desc:
                  "Squadcube is a seller platform that enables multiple sellers to list and sell their products on the ONDC network.",
                long_desc:
                  "Squadcube is a comprehensive seller platform designed to empower businesses to seamlessly list and sell their products on the ONDC network.",
                symbol: "https://ondcstg.squadcube.in/app/image/sq-logo.svg",
                images: ["https://ondcstg.squadcube.in/app/image/sq-logo.svg"],
                tags: [
                  {
                    code: "bpp_terms",
                    list: [
                      {
                        code: "np_type",
                        value: "MSN",
                      },
                    ],
                  },
                ],
              },
              "bpp/fulfillments": [
                {
                  id: "F1",
                  type: "Delivery",
                },
                {
                  id: "F2",
                  type: "Self-Pickup",
                },
              ],
              "bpp/providers": [
                {
                  id: "965",
                  time: {
                    label: "enable",
                    timestamp: "2025-10-28T21:43:52.344Z",
                  },
                  descriptor: {
                    name: "Hotel Temple city",
                    short_desc:
                      "Hotel Temple city is a f&b store offering products through the ONDC platform online.",
                    long_desc:
                      "Hotel Temple city is a f&b store that offers a wide range of products online through the ONDC platform.",
                    symbol:
                      "https://in-maa-1.linodeobjects.com/sqc-bucket/staging/stores/965/logo/1761301387125-6e7e80cb-270e-40cc-a34a-5d24025d5ac8.jpg",
                    images: [
                      "https://in-maa-1.linodeobjects.com/sqc-bucket/staging/stores/965/logo/1761301387125-6e7e80cb-270e-40cc-a34a-5d24025d5ac8.jpg",
                    ],
                    food_type: "Veg",
                    tags: ["South Indian", "North Indian", "Chinese"],
                  },
                  locations: [
                    {
                      id: "LOC625007",
                      time: {
                        label: "enable",
                        timestamp: "2025-10-28T21:43:52.344Z",
                        days: "1,2,3,4,5",
                        schedule: {
                          holidays: [],
                        },
                        range: {
                          start: "0900",
                          end: "1900",
                        },
                      },
                      gps: "9.945789,78.156181",
                      address: {
                        locality: "625007 Opp MGR Bus Stand",
                        street: "Melur Main Rd",
                        city: "MADURAI",
                        area_code: "625007",
                        state: "TAMIL NADU",
                      },
                      circle: {
                        gps: "9.945789,78.156181",
                        radius: {
                          unit: "km",
                          value: "5",
                        },
                      },
                    },
                  ],
                  fulfillments: [
                    {
                      id: "F1",
                      type: "Delivery",
                      contact: {
                        phone: "9894683335",
                        email: "templecity@yopmail.com",
                      },
                    },
                  ],
                  categories: [
                    {
                      id: "CUSMN0965000",
                      parent_category_id: "",
                      descriptor: {
                        name: "Fried Rice",
                        short_desc: "Fried Rice",
                        long_desc: "Fried Rice",
                      },
                      tags: [
                        {
                          code: "type",
                          list: [
                            {
                              code: "type",
                              value: "custom_menu",
                            },
                          ],
                        },
                        {
                          code: "display",
                          list: [
                            {
                              code: "rank",
                              value: "1",
                            },
                          ],
                        },
                      ],
                    },
                  ],
                  items: [
                    {
                      id: "22756",
                      time: {
                        label: "enable",
                        timestamp: "2025-10-28T21:43:52.344Z",
                      },
                      descriptor: {
                        name: "Panner Fried Rice",
                        short_desc: "Panner Fried Rice, code : 22756",
                        long_desc: "Panner Fried Rice",
                        symbol:
                          "https://in-maa-1.linodeobjects.com/sqc-bucket/staging/stores/965/products/22756/thumbnail_image/1761301895849-873e5709-491a-461b-a570-fa9f4aaefcc9.jpeg",
                        images: [
                          "https://in-maa-1.linodeobjects.com/sqc-bucket/staging/stores/965/products/22756/thumbnail_image/1761301895849-873e5709-491a-461b-a570-fa9f4aaefcc9.jpeg",
                        ],
                      },
                      quantity: {
                        unitized: {
                          measure: {
                            unit: "unit",
                            value: "1",
                          },
                        },
                        available: {
                          count: "99",
                        },
                        maximum: {
                          count: "5",
                        },
                      },
                      price: {
                        currency: "INR",
                        value: "230.00",
                        maximum_value: "230.00",
                      },
                      category_id: "F&B",
                      category_ids: ["CUSMN0965000:1"],
                      fulfillment_id: "F1",
                      location_id: "LOC625007",
                      related: false,
                      "@ondc/org/returnable": false,
                      "@ondc/org/cancellable": true,
                      "@ondc/org/return_window": "P0D",
                      "@ondc/org/seller_pickup_return": false,
                      "@ondc/org/time_to_ship": "PT2H",
                      "@ondc/org/available_on_cod": false,
                      "@ondc/org/contact_details_consumer_care":
                        "Support Team,templecity@yopmail.com,9894683335",
                      tax: {
                        percent: 5,
                      },
                      additional_information: {
                        id: 521,
                        food_type: "veg",
                        serving_info: "null",
                        tags: null,
                        spice_levels: null,
                        frosting: null,
                        nutritional_info: {
                          fat_count: {
                            uom: "grams",
                            value: "",
                          },
                          fiber_count: {
                            uom: "grams",
                            value: "",
                          },
                          calorie_count: {
                            uom: "grams",
                            value: "",
                          },
                          protein_count: {
                            uom: "grams",
                            value: "",
                          },
                          weight_per_saving: {
                            uom: "grams",
                            value: "",
                          },
                          carbohydrates_count: {
                            uom: "grams",
                            value: "",
                          },
                        },
                      },
                      tags: [
                        {
                          code: "origin",
                          list: [
                            {
                              code: "country",
                              value: "IND",
                            },
                          ],
                        },
                      ],
                    },
                  ],
                  tags: [
                    {
                      code: "timing",
                      list: [
                        {
                          code: "type",
                          value: "All",
                        },
                        {
                          code: "location",
                          value: "LOC625007",
                        },
                        {
                          code: "day_from",
                          value: "1",
                        },
                        {
                          code: "day_to",
                          value: "5",
                        },
                        {
                          code: "time_from",
                          value: "0900",
                        },
                        {
                          code: "time_to",
                          value: "1900",
                        },
                      ],
                    },
                    {
                      code: "serviceability",
                      list: [
                        {
                          code: "location",
                          value: "LOC625007",
                        },
                        {
                          code: "category",
                          value: "F&B",
                        },
                        {
                          code: "type",
                          value: "12",
                        },
                        {
                          code: "val",
                          value: "IND",
                        },
                        {
                          code: "unit",
                          value: "country",
                        },
                      ],
                    },
                    {
                      code: "order_value",
                      list: [
                        {
                          code: "min_value",
                          value: "100.00",
                        },
                      ],
                    },
                    {
                      code: "catalog_link",
                      list: [
                        {
                          code: "type",
                          value: "inline",
                        },
                      ],
                    },
                  ],
                  ttl: "P1D",
                  "@ondc/org/fssai_license_no": "12345678910111",
                },
              ],
            },
          },
        },
      },
      "minimal-catalog": {
        summary: "Minimal Valid Catalog",
        description: "Minimal payload with only required fields",
        value: {
          context: {
            domain: "ONDC:RET11",
            country: "IND",
            city: "std:0452",
            action: "on_search",
            core_version: "1.2.0",
            bap_id: "test-bap",
            bap_uri: "https://test-bap.com",
            bpp_id: "test-bpp",
            bpp_uri: "https://test-bpp.com",
            transaction_id: "test-transaction-123",
            message_id: "test-message-123",
            timestamp: "2025-10-28T21:43:52.344Z",
            ttl: "PT30S",
          },
          message: {
            catalog: {
              "bpp/descriptor": {
                name: "Test Store",
              },
              "bpp/providers": [
                {
                  id: "provider-1",
                  descriptor: {
                    name: "Test Provider",
                  },
                  locations: [
                    {
                      id: "LOC1",
                      gps: "12.9716,77.5946",
                      address: {
                        city: "BANGALORE",
                        state: "KARNATAKA",
                      },
                    },
                  ],
                  fulfillments: [
                    {
                      id: "F1",
                      type: "Delivery",
                    },
                  ],
                  categories: [
                    {
                      id: "CAT1",
                      descriptor: {
                        name: "Test Category",
                      },
                    },
                  ],
                  items: [
                    {
                      id: "ITEM1",
                      descriptor: {
                        name: "Test Item",
                      },
                      price: {
                        currency: "INR",
                        value: "100.00",
                      },
                      category_id: "F&B",
                      fulfillment_id: "F1",
                      location_id: "LOC1",
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Catalog data processed successfully",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "object",
          properties: {
            ack: {
              type: "object",
              properties: {
                status: { type: "string", example: "ACK" },
                message_id: {
                  type: "string",
                  example: "f6ea6c85-4338-4503-a0d1-5a888bb916f4",
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Invalid catalog data - missing required fields",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "object",
          properties: {
            ack: {
              type: "object",
              properties: {
                status: { type: "string", example: "NACK" },
                message_id: {
                  type: "string",
                  example: "f6ea6c85-4338-4503-a0d1-5a888bb916f4",
                },
                message: {
                  type: "string",
                  example:
                    "Catalog Data not processed - missing required fields",
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: "Internal server error during catalog processing",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "object",
          properties: {
            ack: {
              type: "object",
              properties: {
                status: { type: "string", example: "NACK" },
                message_id: {
                  type: "string",
                  example: "f6ea6c85-4338-4503-a0d1-5a888bb916f4",
                },
                error: {
                  type: "object",
                  properties: {
                    code: {
                      type: "string",
                      example: "CATALOG_PROCESSING_FAILED",
                    },
                    message: {
                      type: "string",
                      example: "Database connection failed",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  async receiveOndcCatalog(@Body() catalogData: ONDCOnSearchResponseDto) {
    try {
      // Simple validation
      if (
        catalogData?.context &&
        catalogData?.message?.catalog &&
        catalogData.message.catalog["bpp/descriptor"] &&
        catalogData.message.catalog["bpp/providers"] &&
        Array.isArray(catalogData.message.catalog["bpp/providers"]) &&
        catalogData.message.catalog["bpp/providers"].length > 0
      ) {
        this.logger.log(
          `Received catalog data from ONDC. Message ID: ${catalogData.context?.message_id}`,
        );

        // Process the catalog data using existing perfect ingestion service (NO CHANGES TO INGESTION LOGIC)
        const result = await this.catalogIngestionService.ingestCatalogData([
          catalogData as any,
        ]);

        this.logger.log(
          `Catalog data processed successfully. Message ID: ${catalogData.context?.message_id}`,
        );

        // Send ACK response back to ONDC
        return {
          message: {
            ack: {
              status: "ACK",
              message_id: catalogData.context?.message_id || "unknown",
            },
          },
        };
      } else {
        this.logger.warn(
          `Invalid catalog data received. Missing required fields.`,
        );
        return {
          message: {
            ack: {
              status: "NACK",
              message_id: catalogData?.context?.message_id || "unknown",
              message: "Catalog Data not processed - missing required fields",
            },
          },
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to process catalog data: ${error.message}`,
        error.stack,
      );

      // Send NACK response back to ONDC
      return {
        message: {
          ack: {
            status: "NACK",
            message_id: catalogData.context?.message_id || "unknown",
            error: {
              code: "CATALOG_PROCESSING_FAILED",
              message: error.message,
            },
          },
        },
      };
    }
  }

  /**
   * Complete catalog refresh with ingestion endpoint - now just sends SEARCH request
   */
  @Post("catalog-refresh-and-ingest")
  @ApiOperation({
    summary: "Trigger catalog refresh and wait for ingestion",
    description:
      "Sends a SEARCH request to ONDC network. The search URL is dynamically constructed from the configured BPP URI. Catalog data will be received asynchronously via /on_search webhook endpoint. Optionally filter by specific store ID.",
  })
  @ApiBody({
    description: "Catalog refresh parameters",
    schema: {
      type: "object",
      properties: {
        city: {
          type: "string",
          example: "std:0452",
          description: "City code for catalog refresh (e.g., std:0452 for Madurai, std:080 for Bangalore)",
        },
        storeId: {
          type: "string",
          example: "965",
          description: "Optional store/provider ID to refresh specific store catalog",
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Search request sent successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: {
          type: "string",
          example:
            "Search request sent to ONDC. Multiple catalog data will be received via /on_search webhook.",
        },
        data: {
          type: "object",
          properties: {
            search_stats: {
              type: "object",
              properties: {
                message_id: { type: "string", example: "f6ea6c85-4338-4503-a0d1-5a888bb916f4" },
                ack_status: { type: "string", example: "ACK" },
                status: { type: "string", example: "waiting_for_multiple_catalogs" },
              },
            },
            note: {
              type: "string",
              example: "Each provider will send separate catalog data via /on_search webhook",
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Catalog refresh failed",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Catalog refresh failed" },
        error: { type: "string", example: "Search request failed: NACK" },
      },
    },
  })
  async catalogRefreshAndIngest(@Body() body: { city?: string, storeId?: string }) {
    try {
      // Step 1: Send SEARCH request to ONDC (gets acknowledgement only)
      this.logger.log("Starting catalog refresh process");
      const searchResult = await this.ondcSearchService.performCatalogRefresh(
        body?.city||"std:0452",
        body?.storeId,
      );

      if (!searchResult.success) {
        throw new Error(`Search request failed: ${searchResult.ack_status}`);
      }

      return {
        success: true,
        message:
          "Search request sent to ONDC. Multiple catalog data will be received via /on_search webhook.",
        data: {
          search_stats: {
            message_id: searchResult.message_id,
            ack_status: searchResult.ack_status,
            status: "waiting_for_multiple_catalogs",
          },
          note: "Each provider will send separate catalog data via /on_search webhook",
        },
      };
    } catch (error) {
      return {
        success: false,
        message: "Catalog refresh failed",
        error: error.message,
      };
    }
  }

  /**
   * Health check endpoint
   */
  @Get("health")
  healthCheck() {
    return {
      success: true,
      message: "ONDC Search Service is running",
      timestamp: new Date().toISOString(),
    };
  }
}
