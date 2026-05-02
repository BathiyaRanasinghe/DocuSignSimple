# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root workspace manifests + lock file
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/

RUN npm install --workspace=apps/api

COPY apps/api/tsconfig.json ./apps/api/
COPY apps/api/src ./apps/api/src

WORKDIR /app/apps/api
RUN npm run build

# ---- Production stage ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 4000
CMD ["node", "dist/index.js"]
