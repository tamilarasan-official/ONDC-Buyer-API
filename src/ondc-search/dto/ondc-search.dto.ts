import { IsOptional, IsString, IsObject } from 'class-validator';

export class ONDCSearchRequestDto {
  @IsString()
  domain: string = 'ONDC:RET11'; // F&B domain

  @IsString()
  country: string = 'IND';

  @IsString()
  city: string; // std:080 for Bangalore

  @IsString()
  action: string = 'search';

  @IsString()
  core_version: string = '1.2.0';

  @IsString()
  bap_id: string;

  @IsString()
  bap_uri: string;

  @IsString()
  transaction_id: string;

  @IsString()
  message_id: string;

  @IsString()
  timestamp: string;

  @IsOptional()
  @IsObject()
  message?: {
    intent?: {
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
      };
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
  time?: {
    label: string;
    timestamp: string;
  };
  descriptor: {
    name: string;
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
