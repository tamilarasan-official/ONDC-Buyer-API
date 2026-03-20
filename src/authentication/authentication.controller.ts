import {
  Controller,
  Post,
  Body,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from "@nestjs/swagger";
import { AuthenticationService } from "./authentication.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { GenerateOtpDto } from "./dto/generate-otp.dto";
import { GuestLoginDto } from "./dto/guest-login.dto";

@ApiTags("Authentication")
@Controller("authentication")
export class AuthenticationController {
  constructor(private readonly authenticationService: AuthenticationService) {}

  @Post("generate-otp")
  @ApiOperation({
    summary: "Generate OTP for phone number",
    description:
      "Generate a one-time password (OTP) for the provided phone number. The OTP will be sent via SMS and is valid for 1 minute.",
  })
  @ApiBody({ type: GenerateOtpDto })
  @ApiResponse({
    status: 201,
    description: "OTP generated and sent successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "OTP sent successfully" },
        data: {
          type: "object",
          properties: {
            phone_number: { type: "number", example: 9876543210 },
            otp_expires_at: { type: "string", example: "2025-01-15T12:05:00Z" },
            message: {
              type: "string",
              example: "OTP sent to your registered phone number",
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Invalid phone number format",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Invalid phone number format" },
        error: { type: "string", example: "BAD_REQUEST" },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: "Failed to send OTP",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Failed to send OTP" },
        error: { type: "string", example: "INTERNAL_SERVER_ERROR" },
      },
    },
  })
  generateOtp(@Body() generateOtpDto: GenerateOtpDto) {
    return this.authenticationService.generateOtp(generateOtpDto);
  }

  @Post("login")
  @ApiOperation({
    summary: "Login with phone number and OTP",
    description:
      "Authenticate user using phone number and OTP. Returns access token and refresh token upon successful authentication.\n\nIf the client includes an optional `identity_token` (from `POST /authentication/guest-login`) in the request body, the server will link the guest identity for analytics attribution and invalidate active guest sessions for that identity.",
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: "Login successful",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Login successful" },
        data: {
          type: "object",
          properties: {
            access_token: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
            refresh_token: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
            existing_user: {
              type: "boolean",
              example: false,
              description:
                "Indicates if the user has completed their profile (added name and email). False for new users, true for existing users with complete profile.",
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Invalid OTP or phone number",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Invalid OTP or phone number" },
        error: { type: "string", example: "BAD_REQUEST" },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "OTP expired or invalid",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "OTP expired or invalid" },
        error: { type: "string", example: "UNAUTHORIZED" },
      },
    },
  })
  login(@Body() loginDto: LoginDto) {
    return this.authenticationService.login(loginDto);
  }

  @Post("guest-login")
  @ApiOperation({
    summary: "Guest login",
    description:
      "Issue a restricted guest JWT token for discovery APIs. OTP is not required. If `identity_token` is provided and valid, the server keeps the same guest identity for analytics; it only rotates the short-lived session (JWT).",
  })
  @ApiBody({ type: GuestLoginDto, required: false })
  @ApiResponse({
    status: 200,
    description: "Guest token issued successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Guest login successful" },
        data: {
          type: "object",
          properties: {
            access_token: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
            token_type: { type: "string", example: "Bearer" },
            is_guest: { type: "boolean", example: true },
            expires_in_seconds: { type: "number", example: 1800 },
            identity_token: {
              type: "string",
              description:
                "Long-lived identity token (opaque). Store it on the client to keep guest analytics stable across app restarts.",
              nullable: true,
              example: "aZxY...opaque...",
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid guest login payload",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Invalid guest login payload" },
        error: { type: "string", example: "BAD_REQUEST" },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: "Internal server error",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Failed to issue guest token" },
        error: { type: "string", example: "INTERNAL_SERVER_ERROR" },
      },
    },
  })
  guestLogin(@Body() guestLoginDto: GuestLoginDto = {}) {
    return this.authenticationService.guestLogin(guestLoginDto);
  }

  @Post("refresh-token")
  @ApiOperation({
    summary: "Refresh access token",
    description:
      "Generate a new access token using a valid refresh token. This endpoint is used to maintain user session without requiring re-authentication.",
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: "Token refreshed successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Token refreshed successfully" },
        data: {
          type: "object",
          properties: {
            access_token: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
            refresh_token: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
            token_type: { type: "string", example: "Bearer" },
            expires_in: { type: "number", example: 3600 },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Invalid or expired refresh token",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: {
          type: "string",
          example: "Invalid or expired refresh token",
        },
        error: { type: "string", example: "UNAUTHORIZED" },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - invalid token format",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: false },
        message: { type: "string", example: "Invalid token format" },
        error: { type: "string", example: "BAD_REQUEST" },
      },
    },
  })
  refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authenticationService.refreshToken(refreshTokenDto);
  }
}
