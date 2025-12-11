export class OtpResponseDto {
  success: boolean;
  message: string;
  phone_number: string;
  expires_in_minutes: number;
  otp?: string; // Only for development/testing
  messageRequestId?: string;
  incorrectNum?: string[];
  timestamp: Date;
}

export class VerifyOtpResponseDto {
  success: boolean;
  message: string;
  verified: boolean;
  phone_number: string;
  attempts_remaining?: number;
  timestamp: Date;
}
