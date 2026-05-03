# ---- Dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/

RUN npm install --workspace=apps/web

# ---- Build ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY apps/web ./apps/web
COPY package.json ./

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL=http://localhost:4000

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=true

RUN cp /app/node_modules/pdfjs-dist/build/pdf.worker.min.mjs /app/apps/web/public/pdf.worker.min.mjs

WORKDIR /app/apps/web
RUN npm run build

# ---- Production runner ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser  --system --uid 1001 nextjs

# With outputFileTracingRoot set to monorepo root, standalone contains the full
# workspace path structure. server.js sits at standalone root; pages are under apps/web/
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]
