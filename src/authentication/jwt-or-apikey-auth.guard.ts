import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { verifyAccessToken } from "../shared/utils/jwt";

/**
 * Authentication guard that supports both JWT and x-api-key
 * - JWT: For buyer authentication (user.id available in request)
 * - x-api-key: For seller/system authentication (no user.id)
 */
@Injectable()
export class JwtOrApiKeyAuthGuard implements CanActivate {
  private readonly validApiKeys: string[];

  constructor(private readonly configService: ConfigService) {
    // Get API keys from environment variable (comma-separated)
    const apiKeys = this.configService.get<string>("SELLER_API_KEYS", "");
    this.validApiKeys = apiKeys
      .split(",")
      .map((key) => key.trim())
      .filter((key) => key.length > 0);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Try x-api-key first
    const apiKey = request.headers["x-api-key"] as string;
    if (apiKey) {
      if (this.validateApiKey(apiKey)) {
        // Mark request as authenticated via API key
        (request as any).authType = "api-key";
        (request as any).user = null; // No user for API key auth
        return true;
      } else {
        throw new UnauthorizedException("Invalid API key");
      }
    }

    // Try JWT token
    const authHeader = request.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (token) {
      try {
        const user = verifyAccessToken(token);
        (request as any).user = user;
        (request as any).authType = "jwt";
        return true;
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new UnauthorizedException("Invalid JWT token");
      }
    }

    // No valid authentication provided
    throw new UnauthorizedException(
      "Authentication required. Provide either 'Authorization: Bearer <token>' or 'x-api-key: <key>' header",
    );
  }

  private validateApiKey(apiKey: string): boolean {
    if (this.validApiKeys.length === 0) {
      // If no API keys configured, deny access
      return false;
    }
    return this.validApiKeys.includes(apiKey);
  }
}

