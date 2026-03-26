# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma

EXPOSE 3001

# prisma db push : applique le schéma sans fichiers de migration (dev local + première mise en prod)
# Pour la prod avec historique de migrations : remplacer par `npx prisma migrate deploy`
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/index.js"]
