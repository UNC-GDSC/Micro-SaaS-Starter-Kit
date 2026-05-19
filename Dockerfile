FROM node:22-alpine AS base
# openssl: Prisma binary detection
# python3 make g++: node-gyp (required by better-sqlite3 and other native devDeps)
RUN apk add --no-cache libc6-compat openssl python3 make g++

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# prisma/schema.prisma is needed by the postinstall script (prisma generate)
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --legacy-peer-deps

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client (uses binaryTargets from schema.prisma)
RUN npx prisma generate

# Build application
# NODE_OPTIONS caps RSS so the 7 GB GHA runner never OOMs during next build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=3500"
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next && chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma: schema + CLI package for `prisma migrate deploy`
# We invoke `node ./node_modules/prisma/build/index.js` directly so that
# __dirname resolves correctly and prisma_schema_build_bg.wasm is found.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
