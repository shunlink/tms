# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---- builder ----
FROM node:20-alpine AS builder
# Prisma needs OpenSSL at generate time (Alpine otherwise picks openssl-1.1.x and breaks at runtime).
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Drop retired sources that may linger on the VPS after overlay deploys (see scripts/deploy-stale-paths.txt).
RUN rm -f "src/app/(dashboard)/bidding-management/BiddingDashboard.tsx"
RUN npx prisma generate
RUN npm run build

# ---- runner ----
FROM node:20-alpine AS runner
# Chromium for LR/invoice PDF (puppeteer-core); not installed on bare Alpine by default.
RUN apk add --no-cache \
    openssl \
    libc6-compat \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV CHROME_PATH=/usr/bin/chromium

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js
# Email worker (BullMQ + Resend) — same image as app
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/lib ./src/lib

EXPOSE 3000

# Apply migrations, then start. Seed manually once if needed:
#   docker compose exec app npm run db:seed
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
