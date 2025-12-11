FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED 1

# Increase memory for build
ENV NODE_OPTIONS=--max-old-space-size=2048

# Generate Prisma Client
RUN npx prisma generate

# Compile the scheduler script
# Using npx tsc to compile the specific file to JS
RUN npx tsc scripts/scheduler.ts --esModuleInterop --module commonjs --target es2017 --skipLibCheck --moduleResolution node

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install prisma globally for migrations (needed for the startup command)
RUN npm install -g prisma

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
mkdir .next
chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy the compiled scheduler script and prisma schema
RUN mkdir scripts
COPY --from=builder --chown=nextjs:nodejs /app/scripts/scheduler.js ./scripts/
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
