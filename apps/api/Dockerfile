# Production-only image — multi-stage build, no source or dev tooling in
# the final image, runs as a non-root user.

FROM node:20-bookworm-slim AS base
WORKDIR /app
COPY package.json package-lock.json* ./

FROM base AS deps
RUN npm install --omit=dev

FROM base AS build
RUN npm install
COPY . .
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system app && useradd --system --gid app app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER app
EXPOSE 4000
# Migrations run on every boot — every schema.sql statement is idempotent,
# so this is safe on every container start, not just the first.
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
