# ── Stage 1: Build Astro static site ────────────────────
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY astro.config.mjs tsconfig.json ./
# Root .env holds the PUBLIC_* client auth config, required at build time
COPY .env ./
COPY src/ src/
COPY public/ public/

RUN npm run build

# ── Stage 2: Production server ──────────────────────────
FROM node:22-alpine

RUN apk add --no-cache tini
WORKDIR /app

# Server dependencies (install before copying source for layer caching)
COPY server/package.json ./server/
COPY server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev

# Server source
COPY server/ ./server/

# Built static files from stage 1
COPY --from=builder /app/dist ./dist

# Data directory for SQLite + QR secret
RUN mkdir -p /app/server/data && chown -R node:node /app/server/data
VOLUME /app/server/data

ENV NODE_ENV=production
ENV DIST_PATH=../dist
ENV PORT=3000

EXPOSE 3000

USER node
WORKDIR /app/server

ENTRYPOINT ["tini", "--"]
CMD ["node", "index.js"]
