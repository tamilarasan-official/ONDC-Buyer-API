import { BadRequestException } from "@nestjs/common";

/**
 * Multipart clients may send `sessions` as:
 * - JSON string of an array
 * - A plain array
 * - An object with numeric keys `{ "0": {...}, "1": {...} }` (nested field names)
 *
 * This always yields a proper array of session-like objects for validation + service.
 */
export function normalizeSessionsPayload(value: unknown): unknown[] | undefined {
  if (value === undefined || value === null || value === "") return undefined;

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim().replace(/^\uFEFF/, "");
    if (!trimmed) return undefined;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new BadRequestException(
        "Invalid sessions format. Expected JSON array.",
      );
    }
    return normalizeSessionsPayload(parsed);
  }

  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return [];

    const allNumericKeys = keys.every((k) => /^\d+$/.test(k));
    if (allNumericKeys) {
      return keys
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => obj[k]);
    }

    const looksLikeSession =
      "day_from" in obj ||
      "day_to" in obj ||
      "start_hhmm" in obj ||
      "end_hhmm" in obj ||
      "start_time" in obj ||
      "end_time" in obj ||
      "startTime" in obj ||
      "endTime" in obj;

    if (looksLikeSession) {
      return [obj];
    }

    // Last resort: one unknown object — let validation fail clearly if wrong shape
    return [obj];
  }

  throw new BadRequestException(
    "Invalid sessions format. Expected JSON array.",
  );
}
