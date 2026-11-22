# Stage 1: Build stage (installs native tools and compiles argon2)
FROM node:24-alpine AS builder

WORKDIR /app

# Install native compilation dependencies in build stage only
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

# Stage 2: Minimal runtime image
FROM node:24-alpine AS runner

WORKDIR /app

# Copy dependencies built from stage 1
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY drizzle.config.ts ./
COPY docker-entrypoint.sh ./
COPY docs ./docs

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

ENTRYPOINT ["/bin/sh", "./docker-entrypoint.sh"]
