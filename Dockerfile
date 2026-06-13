# Storm's Calling Studio — production image (single port serves client + API).
# Multi-stage: build with the full toolchain, run on a slim image.

# ---- build stage ---------------------------------------------------------
FROM node:20-bookworm AS build
WORKDIR /app

# Install deps first (better layer caching). Lockfile is authoritative.
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci

# Build client (Vite -> client/dist) and server (tsc -> server/dist).
COPY . .
RUN npm run build

# Drop dev dependencies — the runtime only needs compiled output + prod deps.
RUN npm prune --omit=dev

# ---- run stage -----------------------------------------------------------
FROM node:20-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Workspace layout + pruned production dependencies (incl. better-sqlite3 native).
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/client/package.json ./client/package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

# User data (SQLite db + images) lives here; mount a persistent volume on it.
VOLUME ["/app/data"]

EXPOSE 8080
CMD ["npm", "start"]
