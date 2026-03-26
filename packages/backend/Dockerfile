# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps first (cache layer)
COPY package.json package-lock.json* ./
RUN npm ci

# Generate Prisma client
COPY prisma ./prisma
RUN npx prisma generate

# Compile TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Install production deps only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy Prisma client and compiled output
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma

EXPOSE 3001

# Run migrations then start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
