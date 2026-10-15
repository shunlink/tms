"use client";

import type { ToastInput } from "@/components/toast";
import type { ApiErrorBody } from "./api-errors";

type ToastPush = (t: ToastInput) => void;

/** Parse API error JSON into a user-friendly message. Never surfaces raw backend errors. */
export function parseApiError(data: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!data || typeof data !== "object") return fallback;
  const body = data as Partial<ApiErrorBody>;
  if (typeof body.error === "string" && body.error.trim()) {
    return body.error;
  }
  return fallback;
}

export function showApiError(
  toast: { push: ToastPush },
  data: unknown,
  fallback?: string
) {
  toast.push({
    title: parseApiError(data, fallback),
    variant: "error",
  });
}

export function showSuccess(toast: { push: ToastPush }, title: string, description?: string) {
  toast.push({ title, description, variant: "success" });
}

export function showWarning(toast: { push: ToastPush }, title: string, description?: string) {
  toast.push({ title, description, variant: "warning" });
}

export function showInfo(toast: { push: ToastPush }, title: string, description?: string) {
  toast.push({ title, description, variant: "info" });
}

/** Map OTP error codes to toast messages. */
export function otpErrorMessage(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "Unable to complete OTP verification. Please try again.";
  }
  const body = data as Partial<ApiErrorBody>;
  if (body.error) return body.error;

  switch (body.code) {
    case "OTP_EXPIRED":
      return "OTP expired. Please request a new OTP.";
    case "OTP_INVALID":
      return "Incorrect OTP.";
    case "OTP_TOO_MANY_ATTEMPTS":
    case "OTP_LOCKED":
      return "Too many attempts. Please request a new OTP.";
    case "OTP_RESEND_COOLDOWN":
      return body.retryAfter
        ? `Please wait ${body.retryAfter} seconds before requesting another OTP.`
        : "Please wait before requesting another OTP.";
    case "OTP_SEND_LIMIT":
      return "Too many OTP requests. Please try again later.";
    default:
      return "Unable to complete OTP verification. Please try again.";
  }
}
