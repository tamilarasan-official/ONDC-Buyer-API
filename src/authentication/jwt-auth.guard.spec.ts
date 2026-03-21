import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard";
import * as jwtUtils from "../shared/utils/jwt";

describe("JwtAuthGuard", () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  const createExecutionContext = (request: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it("should block guest token for order creation with specific message", () => {
    const verifySpy = jest
      .spyOn(jwtUtils, "verifyAccessToken")
      .mockReturnValue({ type: "guest", guest_id: "g-1" } as any);

    const request = {
      path: "/api/buyer/orders",
      method: "POST",
      headers: { authorization: "Bearer guest-token" },
    };

    expect(() => guard.canActivate(createExecutionContext(request))).toThrow(
      new ForbiddenException(
        "Please register as a Tazty user first to place an order.",
      ),
    );

    verifySpy.mockRestore();
  });

  it("should block guest token for apply coupon with specific message", () => {
    const verifySpy = jest
      .spyOn(jwtUtils, "verifyAccessToken")
      .mockReturnValue({ type: "guest", guest_id: "g-1" } as any);

    const request = {
      path: "/api/buyer/cart/apply-coupon",
      method: "POST",
      headers: { authorization: "Bearer guest-token" },
    };

    expect(() => guard.canActivate(createExecutionContext(request))).toThrow(
      new ForbiddenException(
        "Please register as a Tazty user first to apply a coupon.",
      ),
    );

    verifySpy.mockRestore();
  });

  it("should block guest token for get orders with specific message", () => {
    const verifySpy = jest
      .spyOn(jwtUtils, "verifyAccessToken")
      .mockReturnValue({ type: "guest", guest_id: "g-1" } as any);

    const request = {
      path: "/api/buyer/orders",
      method: "GET",
      headers: { authorization: "Bearer guest-token" },
    };

    expect(() => guard.canActivate(createExecutionContext(request))).toThrow(
      new ForbiddenException(
        "Please register as a Tazty user first to view your orders.",
      ),
    );

    verifySpy.mockRestore();
  });

  it("should block guest token for get order detail path with specific message", () => {
    const verifySpy = jest
      .spyOn(jwtUtils, "verifyAccessToken")
      .mockReturnValue({ type: "guest", guest_id: "g-1" } as any);

    const request = {
      path: "/api/buyer/orders/123",
      method: "GET",
      headers: { authorization: "Bearer guest-token" },
    };

    expect(() => guard.canActivate(createExecutionContext(request))).toThrow(
      new ForbiddenException(
        "Please register as a Tazty user first to view your orders.",
      ),
    );

    verifySpy.mockRestore();
  });

  it("should block guest token for pending-payment path with specific message", () => {
    const verifySpy = jest
      .spyOn(jwtUtils, "verifyAccessToken")
      .mockReturnValue({ type: "guest", guest_id: "g-1" } as any);

    const request = {
      path: "/api/buyer/orders/pending-payment",
      method: "GET",
      headers: { authorization: "Bearer guest-token" },
    };

    expect(() => guard.canActivate(createExecutionContext(request))).toThrow(
      new ForbiddenException(
        "Please register as a Tazty user first to view your orders.",
      ),
    );

    verifySpy.mockRestore();
  });

  it("should block guest token for user profile with specific message", () => {
    const verifySpy = jest
      .spyOn(jwtUtils, "verifyAccessToken")
      .mockReturnValue({ type: "guest", guest_id: "g-1" } as any);

    const request = {
      path: "/user/profile",
      method: "GET",
      headers: { authorization: "Bearer guest-token" },
    };

    expect(() => guard.canActivate(createExecutionContext(request))).toThrow(
      new ForbiddenException(
        "Please register as a Tazty user first to view your profile.",
      ),
    );

    verifySpy.mockRestore();
  });

  it("should block guest token for order creation with trailing slash path", () => {
    const verifySpy = jest
      .spyOn(jwtUtils, "verifyAccessToken")
      .mockReturnValue({ type: "guest", guest_id: "g-1" } as any);

    const request = {
      path: "/api/buyer/orders/",
      method: "POST",
      headers: { authorization: "Bearer guest-token" },
    };

    expect(() => guard.canActivate(createExecutionContext(request))).toThrow(
      new ForbiddenException(
        "Please register as a Tazty user first to place an order.",
      ),
    );

    verifySpy.mockRestore();
  });

  it("should block guest token for user profile with trailing slash path", () => {
    const verifySpy = jest
      .spyOn(jwtUtils, "verifyAccessToken")
      .mockReturnValue({ type: "guest", guest_id: "g-1" } as any);

    const request = {
      path: "/user/profile/",
      method: "GET",
      headers: { authorization: "Bearer guest-token" },
    };

    expect(() => guard.canActivate(createExecutionContext(request))).toThrow(
      new ForbiddenException(
        "Please register as a Tazty user first to view your profile.",
      ),
    );

    verifySpy.mockRestore();
  });

  it("should keep default message for other protected APIs", () => {
    const verifySpy = jest
      .spyOn(jwtUtils, "verifyAccessToken")
      .mockReturnValue({ type: "guest", guest_id: "g-1" } as any);

    const request = {
      path: "/api/buyer/notifications",
      method: "GET",
      headers: { authorization: "Bearer guest-token" },
    };

    expect(() => guard.canActivate(createExecutionContext(request))).toThrow(
      new ForbiddenException(
        "Please register as a Tazty user first to access this API.",
      ),
    );

    verifySpy.mockRestore();
  });

  it("should throw unauthorized for missing token", () => {
    const request = {
      path: "/api/buyer/orders",
      method: "POST",
      headers: {},
    };

    expect(() => guard.canActivate(createExecutionContext(request))).toThrow(
      new UnauthorizedException("No token provided"),
    );
  });

  it("should allow regular user tokens", () => {
    const verifySpy = jest
      .spyOn(jwtUtils, "verifyAccessToken")
      .mockReturnValue({ id: 100, phone_number: 9999999999 } as any);

    const request: any = {
      path: "/api/buyer/orders",
      method: "POST",
      headers: { authorization: "Bearer user-token" },
    };

    const result = guard.canActivate(createExecutionContext(request));

    expect(result).toBe(true);
    expect(request.user).toEqual({ id: 100, phone_number: 9999999999 });

    verifySpy.mockRestore();
  });
});
