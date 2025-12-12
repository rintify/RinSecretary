FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
COPY prisma ./prisma
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
# Using esbuild to bundle dependencies (excluding binary prisma client)
RUN npx esbuild scripts/scheduler.ts --bundle --platform=node --target=node20 --outfile=scripts/scheduler.js --external:@prisma/client

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV TZ=Asia/Tokyo

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install prisma globally for migrations (needed for the startup command)
RUN npm install -g prisma@5.22.0

# Set the correct permission for prerender cache
# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy the compiled scheduler script and prisma schema
RUN mkdir scripts
COPY --from=builder --chown=nextjs:nodejs /app/scripts/scheduler.js ./scripts/
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
