import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";

/**
 * Logging interceptor for all HTTP requests
 * Logs request details (method, URL, headers, body, query params)
 * and response details (status, timing)
 * Can be enabled/disabled via ENABLE_REQUEST_LOGGING environment variable
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);
  private readonly isEnabled: boolean;
  private readonly sensitiveFields = [
    "password",
    "token",
    "access_token",
    "refresh_token",
    "authorization",
    "api_key",
    "secret",
    "otp",
    "pin",
  ];

  constructor(private readonly configService: ConfigService) {
    this.isEnabled =
      this.configService.get<string>("ENABLE_REQUEST_LOGGING", "false") ===
      "true";
    
    if (this.isEnabled) {
      this.logger.log("Request logging is ENABLED");
    } else {
      this.logger.log("Request logging is DISABLED");
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!this.isEnabled) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url, body, query, headers, ip } = request;
    const startTime = Date.now();
    const userAgent = headers["user-agent"] || "unknown";

    // Sanitize sensitive data
    const sanitizedBody = this.sanitizeData(body);
    const sanitizedQuery = this.sanitizeData(query);
    const sanitizedHeaders = this.sanitizeHeaders(headers);

    // Build request log message
    const requestLogParts = [
      `📥 ${method} ${url}`,
      Object.keys(sanitizedQuery).length > 0
        ? `Query: ${JSON.stringify(sanitizedQuery)}`
        : null,
      body && Object.keys(sanitizedBody).length > 0
        ? `Body: ${JSON.stringify(sanitizedBody)}`
        : null,
      `IP: ${ip}`,
      `User-Agent: ${userAgent}`,
    ]
      .filter((part) => part !== null)
      .join(" | ");

    // Log request details
    this.logger.log(requestLogParts);

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          // Limit response data logging to prevent huge logs (only for small responses)
          let responseData = "";
          if (data) {
            try {
              const dataStr =
                typeof data === "object"
                  ? JSON.stringify(data)
                  : String(data);
              // Only log response data if it's small (less than 1000 chars)
              if (dataStr.length < 1000) {
                responseData = ` | Response: ${dataStr}`;
              } else {
                responseData = ` | Response: ${dataStr.substring(0, 200)}... (truncated)`;
              }
            } catch (e) {
              responseData = " | Response: [Unable to serialize]";
            }
          }

          // Log response details
          this.logger.log(
            `📤 ${method} ${url} | Status: ${statusCode} | Duration: ${duration}ms${responseData}`,
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || response.statusCode || 500;

          // Log error details
          this.logger.error(
            `❌ ${method} ${url} | Status: ${statusCode} | Duration: ${duration}ms | Error: ${error.message || "Unknown error"}`,
            error.stack,
          );
        },
      }),
    );
  }

  /**
   * Sanitize sensitive data from objects
   */
  private sanitizeData(data: any): any {
    if (!data || typeof data !== "object") {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = this.sensitiveFields.some((field) =>
        lowerKey.includes(field),
      );

      if (isSensitive) {
        sanitized[key] = "***REDACTED***";
      } else if (value && typeof value === "object") {
        sanitized[key] = this.sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize headers, especially authorization headers
   */
  private sanitizeHeaders(headers: any): any {
    if (!headers || typeof headers !== "object") {
      return headers;
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey === "authorization" ||
        lowerKey === "cookie" ||
        lowerKey.includes("token") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("api-key")
      ) {
        sanitized[key] = "***REDACTED***";
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

