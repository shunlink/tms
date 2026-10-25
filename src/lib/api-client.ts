/**
 * Client-side API helpers. Use readApiError / reportApiFailure for all fetch mutations.
 * Server routes should use forbidden() / unauthorized() from @/lib/api.
 */

import type { ToastInput } from "@/components/toast";
import {
  DEFAULT_FORBIDDEN_MESSAGE,
  DEFAULT_NOT_FOUND_MESSAGE,
  DEFAULT_UNAUTHORIZED_MESSAGE,
  friendlyValidationError,
  type ApiErrorBody,
  type ApiErrorCode,
} from "./api-errors";
function otpErrorMessageFromBody(body: unknown): string {
  if (!body || typeof body !== "object") {
    return "Unable to complete OTP verification. Please try again.";
  }
  const partial = body as Partial<ApiErrorBody>;
  if (partial.error) return partial.error;

  switch (partial.code) {
    case "OTP_EXPIRED":
      return "OTP expired. Please request a new OTP.";
    case "OTP_INVALID":
      return "Incorrect OTP.";
    case "OTP_TOO_MANY_ATTEMPTS":
    case "OTP_LOCKED":
      return "Too many attempts. Please request a new OTP.";
    case "OTP_RESEND_COOLDOWN":
      return partial.retryAfter
        ? `Please wait ${partial.retryAfter} seconds before requesting another OTP.`
        : "Please wait before requesting another OTP.";
    case "OTP_SEND_LIMIT":
      return "Too many OTP requests. Please try again later.";
    default:
      return "Unable to complete OTP verification. Please try again.";
  }
}

export type ResolvedApiError = {
  message: string;
  code?: ApiErrorCode;
  fieldErrors?: Record<string, string>;
  status: number;
  retryAfter?: number;
};

const GENERIC_ERRORS = new Set(
  ["forbidden", "unauthorized", "not found", "internal server error", "error"].map((s) =>
    s.toLowerCase()
  )
);

const CODE_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  FORBIDDEN: DEFAULT_FORBIDDEN_MESSAGE,
  UNAUTHORIZED: DEFAULT_UNAUTHORIZED_MESSAGE,
  NOT_FOUND: DEFAULT_NOT_FOUND_MESSAGE,
  CONFLICT: "This action could not be completed because of a conflict. Please refresh and try again.",
  RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
  VALIDATION_ERROR: "Please check the form and try again.",
  SERVER_ERROR: "Something went wrong on our side. Please try again later.",
  FILE_INVALID: "The file could not be accepted. Check the format and size, then try again.",
};

function isTechnicalMessage(msg: string): boolean {
  const lower = msg.toLowerCase();
  if (lower.includes("prisma") || lower.includes("unique constraint")) return true;
  if (lower.includes("invalid `") || lower.includes("invocation")) return true;
  if (msg.length > 280) return true;
  return false;
}

function sanitizeRawError(raw: string | undefined, status: number, fallback: string): string {
  if (!raw?.trim()) return statusFallback(status, fallback);
  const trimmed = raw.trim();
  if (GENERIC_ERRORS.has(trimmed.toLowerCase())) return statusFallback(status, fallback);
  if (isTechnicalMessage(trimmed)) return statusFallback(status, fallback);
  return friendlyValidationError(trimmed);
}

function statusFallback(status: number, fallback: string): string {
  if (status === 401) return DEFAULT_UNAUTHORIZED_MESSAGE;
  if (status === 403) return DEFAULT_FORBIDDEN_MESSAGE;
  if (status === 404) return DEFAULT_NOT_FOUND_MESSAGE;
  if (status === 409) return CODE_MESSAGES.CONFLICT ?? fallback;
  if (status === 429) return CODE_MESSAGES.RATE_LIMITED ?? fallback;
  if (status >= 500) return CODE_MESSAGES.SERVER_ERROR ?? fallback;
  return fallback;
}

function bodyAsApiError(body: unknown): Partial<ApiErrorBody> {
  if (!body || typeof body !== "object") return {};
  return body as Partial<ApiErrorBody>;
}

/** Map HTTP response + JSON body to a user-facing error. */
export function resolveApiError(
  res: Pick<Response, "status" | "ok">,
  body?: unknown,
  fallback = "Something went wrong. Please try again."
): ResolvedApiError {
  const status = res.status || 500;
  const partial = bodyAsApiError(body);
  const code = partial.code;
  const fieldErrors = partial.fieldErrors;

  if (code && code.startsWith("OTP_")) {
    const message = otpErrorMessageFromBody(body);
    return { message, code, fieldErrors, status, retryAfter: partial.retryAfter };
  }

  if (code && CODE_MESSAGES[code]) {
    const custom = typeof partial.error === "string" ? partial.error.trim() : "";
    const useCustom = Boolean(custom && !GENERIC_ERRORS.has(custom.toLowerCase()));
    return {
      message: useCustom ? friendlyValidationError(custom) : CODE_MESSAGES[code]!,
      code,
      fieldErrors,
      status,
      retryAfter: partial.retryAfter,
    };
  }

  if (typeof partial.error === "string" && partial.error.trim()) {
    return {
      message: sanitizeRawError(partial.error, status, fallback),
      code,
      fieldErrors,
      status,
      retryAfter: partial.retryAfter,
    };
  }

  if (code === "OTP_RESEND_COOLDOWN" && partial.retryAfter) {
    return {
      message: `Please wait ${partial.retryAfter} seconds before trying again.`,
      code,
      status,
      retryAfter: partial.retryAfter,
    };
  }

  return {
    message: statusFallback(status, fallback),
    code,
    fieldErrors,
    status,
    retryAfter: partial.retryAfter,
  };
}

export async function readJsonBody(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

export async function readApiError(
  res: Response,
  fallback?: string
): Promise<ResolvedApiError> {
  const body = await readJsonBody(res);
  return resolveApiError(res, body, fallback);
}

export type ApiFetchResult<T> =
  | { ok: true; data: T; res: Response }
  | { ok: false; error: ResolvedApiError; res: Response; body: unknown };

export async function apiFetch<T = unknown>(
  url: string,
  init?: RequestInit,
  fallback?: string
): Promise<ApiFetchResult<T>> {
  const res = await fetch(url, init);
  const body = await readJsonBody(res);
  if (!res.ok) {
    return { ok: false, error: resolveApiError(res, body, fallback), res, body };
  }
  return { ok: true, data: body as T, res };
}

type ToastPush = (t: ToastInput) => void;

export type ReportApiFailureOptions = {
  toast?: { push: ToastPush };
  setError?: (message: string) => void;
  fallback?: string;
  /** Skip toast and setError (background requests). */
  silent?: boolean;
};

/** Apply resolved error to inline state and/or toast. */
export function reportApiFailure(
  res: Response,
  body: unknown,
  opts?: ReportApiFailureOptions
): ResolvedApiError {
  const err = resolveApiError(res, body, opts?.fallback);
  if (!opts?.silent) {
    opts?.setError?.(err.message);
    opts?.toast?.push({ title: err.message, variant: "error" });
  }
  return err;
}

export async function reportApiFailureFromResponse(
  res: Response,
  opts?: ReportApiFailureOptions
): Promise<ResolvedApiError> {
  const body = await readJsonBody(res);
  return reportApiFailure(res, body, opts);
}

export function showApiErrorAndSetState(
  setError: (message: string) => void,
  toast: { push: ToastPush },
  res: Response,
  body: unknown,
  fallback?: string
) {
  reportApiFailure(res, body, { setError, toast, fallback });
}
