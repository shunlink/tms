-- Add OTP purpose tracking to prevent cross-flow OTP reuse
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "otpPurpose" TEXT;
