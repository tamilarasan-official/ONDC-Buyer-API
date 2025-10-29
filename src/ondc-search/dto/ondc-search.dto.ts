import { Type } from 'class-transformer';
import { IsArray, IsISO8601, IsOptional, IsString, ValidateNested } from 'class-validator';

export class ONDCSearchRequestDto {
  context: {
    domain: string; // 'ONDC:RET11' for F&B
    action: string; // 'search'
    country: string; // 'IND'
    city: string; // std:0452, std:044 etc
    core_version: string; // '1.2.0'
    bap_id: string;
    bap_uri: string;
    bpp_id: string;
    transaction_id: string; // UUID
    message_id: string; // UUID
    timestamp: string; // ISO datetime
    ttl: string; // 'PT30S'
  };

  message: {
    intent: {
      payment: {
        '@ondc/org/buyer_app_finder_fee_type': string; // 'percent'
        '@ondc/org/buyer_app_finder_fee_amount': string; // '3'
      };
      // Optional search filters
      fulfillment?: {
        end?: {
          location?: {
            gps?: string;
            area_code?: string;
          };
        };
      };
      item?: {
        descriptor?: {
          name?: string;
        };
      };
      category?: {
        id?: string;
      };
    };
  };
}

export class ONDCSearchResponseDto {
  context: {
    domain: string;
    country: string;
    city: string;
    action: string;
    core_version: string;
    bap_id: string;
    bap_uri: string;
    bpp_id: string;
    bpp_uri: string;
    transaction_id: string;
    message_id: string;
    timestamp: string;
  };

  message: {
    catalog: {
      'bpp/descriptor': {
        name: string;
        symbol?: string;
        short_desc?: string;
        long_desc?: string;
        images?: string[];
        tags?: Tag[];
      };
      'bpp/fulfillments'?: Fulfillment[];
      'bpp/providers': Provider[];
    };
  };
}

export interface Provider {
  id: string;
  time?: {
    label: string;
    timestamp: string;
  };
  fulfillments?: Fulfillment[];
  descriptor: {
    name: string;
    symbol?: string;
    short_desc?: string;
    long_desc?: string;
    images?: string[];
    food_type?: string;
    tags?: string[];
  };
  '@ondc/org/fssai_license_no'?: string;
  ttl?: string;
  locations: Location[];
  categories: Category[];
  items: Item[];
  offers?: Offer[];
  tags?: Tag[];
}

export interface Fulfillment {
  id: string;
  type: string;
  contact?: {
    phone?: string;
    email?: string;
  };
}

export interface Location {
  id: string;
  time?: {
    label: string;
    timestamp: string;
    days?: string;
    schedule?: {
      holidays?: string[];
      frequency?: string;
      times?: string[];
    };
    range?: {
      start: string;
      end: string;
    };
  };
  gps: string;
  address: {
    locality?: string;
    street?: string;
    city?: string;
    area_code?: string;
    state?: string;
  };
  circle?: {
    gps: string;
    radius: {
      unit: string;
      value: string;
    };
  };
}

export interface Category {
  id: string;
  parent_category_id?: string;
  descriptor: {
    name: string;
    short_desc?: string;
    long_desc?: string;
    images?: string[];
  };
  tags?: Tag[];
}

export interface Item {
  id: string;
  parent_item_id?: string; // For variant items linking to variant group
  time?: {
    label: string;
    timestamp: string;
  };
  descriptor: {
    name: string;
    code?: string;
    symbol?: string;
    short_desc?: string;
    long_desc?: string;
    images?: string[];
  };
  quantity?: {
    unitized?: {
      measure: {
        unit: string;
        value: string;
      };
    };
    available?: {
      count: string;
    };
    maximum?: {
      count: string;
    };
  };
  price?: {
    currency: string;
    value: string;
    maximum_value?: string;
    tags?: Tag[];
  };
  category_id?: string;
  category_ids?: string[];
  fulfillment_id?: string;
  location_id?: string;
  related?: boolean;
  recommended?: boolean;
  '@ondc/org/returnable'?: boolean;
  '@ondc/org/cancellable'?: boolean;
  '@ondc/org/return_window'?: string;
  '@ondc/org/seller_pickup_return'?: boolean;
  '@ondc/org/time_to_ship'?: string;
  '@ondc/org/available_on_cod'?: boolean;
  '@ondc/org/contact_details_consumer_care'?: string;
  tax?: {
    percent: number;
  };
  additional_information?: {
    id?: number;
    food_type?: string;
    serving_info?: string;
    tags?: any;
    spice_levels?: any;
    frosting?: any;
    nutritional_info?: any;
    [key: string]: any; // Allow for additional properties
  };
  tags?: Tag[];
}

export interface Offer {
  id: string;
  descriptor: {
    code: string;
    images?: string[];
  };
  location_ids?: string[];
  item_ids?: string[];
  time?: {
    label: string;
    range: {
      start: string;
      end: string;
    };
  };
  tags?: Tag[];
}

export interface Tag {
  code: string;
  list: TagItem[];
}

export interface TagItem {
  code: string;
  value: string;
}

export class ContextDto {
  @IsString() domain: string;
  @IsString() country: string;
  @IsString() city: string;
  @IsString() action: string;
  @IsString() core_version: string;
  @IsString() bap_id: string;
  @IsString() bap_uri: string;
  @IsString() bpp_id: string;
  @IsString() bpp_uri: string;
  @IsString() transaction_id: string;
  @IsString() message_id: string;
  @IsISO8601() timestamp: string;
}

export class BppDescriptorDto {
  @IsString() name: string;
  @IsOptional() @IsString() symbol?: string;
  @IsOptional() @IsString() short_desc?: string;
  @IsOptional() @IsString() long_desc?: string;
  @IsOptional() @IsArray() images?: string[];
  @IsOptional() tags?: any[]; // If you have a Tag shape, replace 'any' with it.
}

export class CatalogDto {

  @ValidateNested() @Type(() => BppDescriptorDto)
  "bpp/descriptor": BppDescriptorDto;

  @IsOptional() bpp_fulfillments?: any[]; 
  
  @IsArray() "bpp/providers": any[];       
}

export class MessageDto {
  @ValidateNested() @Type(() => CatalogDto)
  catalog: CatalogDto;
}


// New DTOs for ONDC protocol flow
export class ONDCSearchAckDto {
  context: {
    domain: string;
    country: string;
    city: string;
    action: string;
    core_version: string;
    bap_id: string;
    bap_uri: string;
    bpp_id: string;
    bpp_uri: string;
    transaction_id: string;
    message_id: string;
    timestamp: string;
  };

  message: {
    ack: {
      status: 'ACK' | 'NACK';
      message_id: string;
      error?: {
        code: string;
        message: string;
      };
    };
  };
}

export class ONDCOnSearchResponseDto {
  @ValidateNested() @Type(() => ContextDto)
  context: ContextDto;

  @ValidateNested() @Type(() => MessageDto)
  message: MessageDto;
}
