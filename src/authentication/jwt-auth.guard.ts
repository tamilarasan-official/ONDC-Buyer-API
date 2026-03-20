import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { Request } from "express";
import { verifyAccessToken } from "../shared/utils/jwt";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const openRoutes = [
      /^\/authentication(\/|$)/,
      /^\/public(\/|$)/,
      { method: "GET", pattern: /^\/roles(\/|$)/ },
    ];
    if (
      openRoutes.some((route) => {
        if (route instanceof RegExp) {
          return route.test(request.path);
        }
        if (
          typeof route === "object" &&
          route.method &&
          route.pattern instanceof RegExp
        ) {
          return (
            request.method === route.method && route.pattern.test(request.path)
          );
        }
        return false;
      })
    ) {
      return true;
    }

    const authHeader = request.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) throw new UnauthorizedException("No token provided");

    try {
      const user = verifyAccessToken(token);
      // Guests are allowed only on discovery routes via GuestOrUserAuthGuard.
      if (user && (user as any).type === "guest") {
        throw new ForbiddenException("Guest token cannot access this API");
      }
      (request as any).user = user;
      return true;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException("Invalid token");
    }
  }
}
