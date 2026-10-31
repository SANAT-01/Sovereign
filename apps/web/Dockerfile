# Production-only image — Next's `output: "standalone"` bundle
# (next.config.js), no source or dev tooling in the final image, runs as a
# non-root user.

FROM node:20-bookworm-slim AS base
WORKDIR /app
COPY package.json package-lock.json* ./

FROM base AS deps
RUN npm install

FROM deps AS build
# next.config.js's rewrites() is resolved at build time (baked into
# .next/routes-manifest.json), not read fresh at container start — so
# API_URL must be set here, as a build ARG, not just in docker-compose's
# runtime `environment:`.
ARG API_URL=http://api:4000
ENV API_URL=$API_URL
COPY . .
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN groupadd --system app && useradd --system --gid app app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER app
EXPOSE 3000
CMD ["node", "server.js"]
