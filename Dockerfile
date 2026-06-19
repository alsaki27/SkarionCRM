# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
COPY packages/shared/package*.json ./packages/shared/

# Install all dependencies
RUN npm ci

# Copy source
COPY . .

# Build client
RUN cd client && npm run build

# Build server
RUN cd server && npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy server package files
COPY server/package*.json ./
RUN npm ci --omit=dev

# Copy server dist and client dist
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/client/dist ./public

# Copy server migrations
COPY --from=builder /app/server/migrations ./migrations

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["node", "dist/index.js"]
