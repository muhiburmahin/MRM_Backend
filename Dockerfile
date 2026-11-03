# ==========================================
# MRM InfoTech Backend - Production Dockerfile
# Multi-stage build with minimal attack surface
# ==========================================

# Stage 1: Build & compile
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Install dependencies required by Prisma / native modules on Alpine
RUN apk add --no-cache openssl libc6-compat

# Install package definitions
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts tsconfig*.json nest-cli.json ./

# Install all dependencies (including dev for building)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and build
COPY src ./src
RUN npm run build

# Prune devDependencies to keep image lean
RUN npm prune --omit=dev

# Stage 2: Production runner
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

# Install runtime dependencies for Prisma
RUN apk add --no-cache openssl libc6-compat curl

ENV NODE_ENV=production
ENV PORT=5000

# Create uploads directory with appropriate permissions
RUN mkdir -p /usr/src/app/uploads && chown -R node:node /usr/src/app

# Copy production artifacts from builder
COPY --chown=node:node --from=builder /usr/src/app/package*.json ./
COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=builder /usr/src/app/prisma ./prisma
COPY --chown=node:node --from=builder /usr/src/app/dist ./dist

# Use non-root user for security
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5000/api/v1/health || exit 1

CMD ["node", "dist/main.js"]

