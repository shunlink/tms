-- Forgot-password flow: store a single hashed email OTP per user.
ALTER TABLE "User" ADD COLUMN     "resetOtpHash" TEXT,
ADD COLUMN     "resetOtpExpiresAt" TIMESTAMP(3);
