import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET || "k9VvFQ2tYj8nLZ7k+3kR0Bt5C+M2DgUuYz+9V9F4QlA=";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ||
  "T3Kqz8gAe0J1aV9q+YrmMvH3sYDjBmxUNRTOvfhBrHo=";
const GUEST_ACCESS_TOKEN_TTL_SECONDS =
  Number(process.env.GUEST_ACCESS_TOKEN_TTL_SECONDS) || 1800;

export function generateAccessToken(
  payload: object,
  expiresIn: jwt.SignOptions["expiresIn"] = "1h",
) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function generateRefreshToken(payload: object) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, JWT_SECRET);
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, JWT_REFRESH_SECRET);
}

export function generateGuestAccessToken(payload: object) {
  return generateAccessToken(payload, GUEST_ACCESS_TOKEN_TTL_SECONDS);
}
