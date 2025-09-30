import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

export interface AirtelSmsRequest {
  customerId: string;
  destinationAddress: string[];
  dltTemplateId: string;
  entityId: string;
  message: string;
  messageType: 'PROMOTIONAL' | 'TRANSACTIONAL' | 'SERVICE_IMPLICIT';
  sourceAddress: string;
  urlShortenerParams?: {
    campaignId: string;
    campaignName: string;
    campaignType: string;
    hitsAllowed: number;
    isEnabled: string;
    isUniqueUrl: string;
    metaData: object;
    shortCode: string;
    systemMetaData: object;
    validity: number;
  };
}

export interface AirtelSmsResponse {
  status: string;
  message: string;
  messageRequestId?: string;
  incorrectNum?: string[];
  errorCode?: string;
  errorDescription?: string;
}

@Injectable()
export class AirtelSmsProvider {
  private readonly logger = new Logger(AirtelSmsProvider.name);
  private readonly baseUrl = 'https://iqsms.airtel.in/api/v1';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async sendSms(
    phoneNumber: string,
    message: string,
  ): Promise<AirtelSmsResponse> {
    try {
      const cleanPhoneNumber = this.cleanPhoneNumber(phoneNumber);

      // Prepare Airtel SMS request
      const customerId = this.configService.get<string>('AIRTEL_CUSTOMER_ID');
      const dltTemplateId = this.configService.get<string>(
        'AIRTEL_DLT_TEMPLATE_ID',
      );
      const entityId = this.configService.get<string>('AIRTEL_ENTITY_ID');
      const sourceAddress =
        this.configService.get<string>('AIRTEL_SOURCE_ADDRESS') || 'ONDC';

      if (!customerId || !dltTemplateId || !entityId) {
        throw new BadRequestException(
          'Missing required Airtel SMS configuration',
        );
      }

      const requestBody: AirtelSmsRequest = {
        customerId: customerId,
        destinationAddress: [cleanPhoneNumber],
        dltTemplateId: dltTemplateId,
        entityId: entityId,
        message: message,
        messageType: 'SERVICE_IMPLICIT',
        sourceAddress: sourceAddress,
      };

      this.logger.log(`Sending SMS to ${cleanPhoneNumber} via Airtel API`);

      // Make API call to Airtel with Basic Auth (username/password)
      const username = this.configService.get<string>('AIRTEL_USERNAME');
      const password = this.configService.get<string>('AIRTEL_PASSWORD');

      if (!username || !password) {
        throw new BadRequestException('Missing Airtel username or password');
      }

      const basicAuth = Buffer.from(`${username}:${password}`).toString(
        'base64',
      );

      const response = await firstValueFrom(
        this.httpService
          .post(`${this.baseUrl}/send-prepaid-sms`, requestBody, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${basicAuth}`,
            },
            timeout: 10000,
          })
          .pipe(
            timeout(10000),
            catchError((error) => {
              this.logger.error(
                'Airtel SMS API error:',
                error.response?.data || error.message,
              );
              throw new BadRequestException(
                `SMS sending failed: ${error.response?.data?.message || error.message}`,
              );
            }),
          ),
      );

      const responseData: AirtelSmsResponse = response.data;

      this.logger.log('SMS sent successfully via Airtel', {
        phoneNumber: cleanPhoneNumber,
        messageId: responseData.messageRequestId,
        status: responseData.status,
      });

      return responseData;
    } catch (error) {
      this.logger.error(`Failed to send SMS via Airtel: ${error.message}`);
      throw error;
    }
  }

  private cleanPhoneNumber(phoneNumber: string): string {
    // Remove all non-numeric characters
    let cleaned = phoneNumber.replace(/\D/g, '');

    // Remove country code if present and return only 10-digit number
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      // Remove the '91' country code
      return cleaned.substring(2);
    } else if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
      // Already 10 digits, return as is
      return cleaned;
    }

    throw new BadRequestException(
      `Invalid Indian mobile number: ${phoneNumber}`,
    );
  }

  validateConfig(): boolean {
    const requiredFields = [
      'AIRTEL_CUSTOMER_ID',
      'AIRTEL_DLT_TEMPLATE_ID',
      'AIRTEL_ENTITY_ID',
      'AIRTEL_USERNAME',
      'AIRTEL_PASSWORD',
      'AIRTEL_SOURCE_ADDRESS',
    ];

    const missingFields = requiredFields.filter(
      (field) => !this.configService.get<string>(field),
    );

    if (missingFields.length > 0) {
      this.logger.error(
        `Missing Airtel SMS configuration: ${missingFields.join(', ')}`,
      );
      return false;
    }

    return true;
  }
}
