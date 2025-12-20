import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { Response } from "express";

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse<Response>();
    
    return next.handle().pipe(
      map((data) => {
        // Skip transformation if response has already been sent (e.g., webhooks using @Res())
        if (response.headersSent || response.finished) {
          return data;
        }
        
        // Skip transformation if data is undefined or null (response was already sent)
        if (data === undefined || data === null) {
          return data;
        }
        
        return {
          success: true,
          statusCode: response.statusCode || 200,
          message: "Request successful",
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
