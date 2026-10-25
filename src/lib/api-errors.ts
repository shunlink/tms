import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "OTP_INVALID"
  | "OTP_EXPIRED"
  | "OTP_LOCKED"
  | "OTP_USED"
  | "OTP_TOO_MANY_ATTEMPTS"
  | "OTP_RESEND_COOLDOWN"
  | "OTP_SEND_LIMIT"
  | "OTP_PURPOSE_MISMATCH"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "FILE_INVALID"
  | "SERVER_ERROR";

export type ApiErrorBody = {
  success: false;
  error: string;
  code?: ApiErrorCode;
  fieldErrors?: Record<string, string>;
  retryAfter?: number;
};

export type ApiSuccessBody<T = unknown> = {
  success: true;
  data?: T;
};

export const DEFAULT_FORBIDDEN_MESSAGE =
  "You don't have permission to perform this action. Ask your administrator if you need access.";

export const DEFAULT_UNAUTHORIZED_MESSAGE = "Please sign in again to continue.";

export const DEFAULT_NOT_FOUND_MESSAGE = "The requested item could not be found.";

export function forbiddenErrorBody(message?: string): ApiErrorBody {
  const trimmed = message?.trim();
  const error =
    !trimmed || trimmed === "Forbidden" ? DEFAULT_FORBIDDEN_MESSAGE : trimmed;
  return {
    success: false,
    error,
    code: "FORBIDDEN",
  };
}

export function unauthorizedErrorBody(message?: string): ApiErrorBody {
  return {
    success: false,
    error: message?.trim() || DEFAULT_UNAUTHORIZED_MESSAGE,
    code: "UNAUTHORIZED",
  };
}

export function notFoundErrorBody(message?: string): ApiErrorBody {
  const trimmed = message?.trim();
  const error =
    !trimmed || trimmed === "Not found" ? DEFAULT_NOT_FOUND_MESSAGE : trimmed;
  return {
    success: false,
    error,
    code: "NOT_FOUND",
  };
}

export class AppError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fieldErrors?: Record<string, string>;
  readonly retryAfter?: number;

  constructor(
    message: string,
    opts: {
      status?: number;
      code?: ApiErrorCode;
      fieldErrors?: Record<string, string>;
      retryAfter?: number;
    } = {}
  ) {
    super(message);
    this.name = "AppError";
    this.status = opts.status ?? 400;
    this.code = opts.code ?? "SERVER_ERROR";
    this.fieldErrors = opts.fieldErrors;
    this.retryAfter = opts.retryAfter;
  }
}

export function apiError(
  message: string,
  status = 400,
  opts?: { code?: ApiErrorCode; fieldErrors?: Record<string, string>; retryAfter?: number }
) {
  const body: ApiErrorBody = {
    success: false,
    error: message,
    code: opts?.code,
    fieldErrors: opts?.fieldErrors,
    retryAfter: opts?.retryAfter,
  };
  return NextResponse.json(body, { status });
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status });
}

/** Map thrown errors (including AppError) to safe API responses. */
export function handleThrownError(e: unknown) {
  if (e instanceof AppError) {
    return apiError(e.message, e.status, {
      code: e.code,
      fieldErrors: e.fieldErrors,
      retryAfter: e.retryAfter,
    });
  }

  const msg = e instanceof Error ? e.message : String(e);

  if (msg.includes("OTP expired")) {
    return apiError("OTP expired. Please request a new OTP.", 400, { code: "OTP_EXPIRED" });
  }
  if (msg.includes("OTP locked") || msg.includes("Too many incorrect")) {
    return apiError("Too many incorrect attempts. Please request a new OTP.", 400, {
      code: "OTP_TOO_MANY_ATTEMPTS",
    });
  }
  if (msg.includes("OTP already used")) {
    return apiError("This OTP has already been used. Please request a new OTP.", 400, {
      code: "OTP_USED",
    });
  }
  if (msg.includes("Invalid OTP") || msg.includes("Invalid or expired OTP")) {
    return apiError("Incorrect OTP. Please try again.", 400, { code: "OTP_INVALID" });
  }
  if (msg.includes("Please wait") && msg.includes("before requesting")) {
    const match = msg.match(/(\d+)\s*second/);
    const retryAfter = match ? Number.parseInt(match[1], 10) : undefined;
    return apiError(msg, 429, { code: "OTP_RESEND_COOLDOWN", retryAfter });
  }
  if (msg.includes("Too many OTP requests")) {
    return apiError(msg, 429, { code: "OTP_SEND_LIMIT" });
  }
  if (msg.includes("not found") || msg.includes("does not match")) {
    return apiError(
      msg.includes("Driver") ? "Driver not found or phone does not match." : msg,
      404,
      { code: "NOT_FOUND" }
    );
  }

  return null;
}

/** User-friendly validation message from Zod validate() output. */
export function friendlyValidationError(raw: string): string {
  const first = raw.split(";")[0]?.trim() ?? raw;
  const colon = first.indexOf(": ");
  if (colon === -1) return first;
  const field = first.slice(0, colon);
  const message = first.slice(colon + 2);
  if (field === "body" || !field) return message;
  return message;
}
