import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";
import { map, catchError } from "rxjs/operators";
import { of } from "rxjs";
import { Response, Request } from "express";
import { ClassSerializerInterceptor } from "@nestjs/common/serializer/class-serializer.interceptor";

/**
 * Wrapper around ClassSerializerInterceptor that safely handles
 * responses that have already been sent (e.g., webhooks using @Res())
 * 
 * The issue: ClassSerializerInterceptor tries to serialize data even when
 * using @Res() and manually sending responses, causing "Cannot set headers
 * after they are sent" errors.
 * 
 * Solution: Skip serialization for webhook endpoints and catch serialization
 * errors that occur when response is already sent.
 */
@Injectable()
export class SafeClassSerializerInterceptor extends ClassSerializerInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Skip serialization for webhook endpoints (they use @Res() to manually send responses)
    const isWebhookEndpoint = request.url?.includes("/webhook/");
    if (isWebhookEndpoint) {
      return next.handle();
    }

    // Use parent's intercept method but catch errors from serialization
    return super.intercept(context, next).pipe(
      map((data) => {
        // If response was sent, return data as-is
        if (response.headersSent || response.finished) {
          return data;
        }
        return data;
      }),
      catchError((error) => {
        // If error is "Cannot set headers after they are sent" and response is already sent,
        // return undefined to prevent further processing
        if (
          (error.message?.includes("Cannot set headers") ||
            error.message?.includes("removeListener")) &&
          (response.headersSent || response.finished)
        ) {
          // Response already sent, return empty observable
          return of(undefined);
        }
        // Re-throw other errors
        throw error;
      }),
    );
  }
}

