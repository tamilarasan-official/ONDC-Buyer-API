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
  private readonly guestAccessRules: Array<{
    method: string;
    matches: (path: string) => boolean;
    message: string;
  }> = [
    {
      method: "POST",
      matches: (path: string) => path === "/api/buyer/orders",
      message: "Please register as a Tazty user first to place an order.",
    },
    {
      method: "POST",
      matches: (path: string) => path === "/api/buyer/cart/apply-coupon",
      message: "Please register as a Tazty user first to apply a coupon.",
    },
    {
      method: "GET",
      matches: (path: string) =>
        path === "/api/buyer/orders" ||
        path === "/api/buyer/orders/pending-payment" ||
        path.startsWith("/api/buyer/orders/"),
      message: "Please register as a Tazty user first to view your orders.",
    },
    {
      method: "GET",
      matches: (path: string) => path === "/user/profile",
      message: "Please register as a Tazty user first to view your profile.",
    },
  ];

  private normalizePath(path: string): string {
    const lowerCasedPath = (path || "").toLowerCase();
    if (lowerCasedPath.length > 1 && lowerCasedPath.endsWith("/")) {
      return lowerCasedPath.slice(0, -1);
    }
    return lowerCasedPath;
  }

  private getGuestAccessMessage(request: Request): string {
    const method = (request.method || "").toUpperCase();
    const path = this.normalizePath(request.path || "");

    const matchedRule = this.guestAccessRules.find(
      (rule) => rule.method === method && rule.matches(path),
    );

    if (matchedRule) {
      return matchedRule.message;
    }

    return "Please register as a Tazty user first to access this API.";
  }

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
        throw new ForbiddenException(this.getGuestAccessMessage(request));
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
