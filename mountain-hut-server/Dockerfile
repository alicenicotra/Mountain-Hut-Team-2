FROM node:24-alpine

WORKDIR /app

# Install dependencies required for building native packages (like argon2)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

ENTRYPOINT ["/bin/sh", "./docker-entrypoint.sh"]
