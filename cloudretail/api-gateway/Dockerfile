# Multi-stage build for api-gateway
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY shared/models/package.json ./shared/models/
COPY shared/middleware/package.json ./shared/middleware/
COPY api-gateway/package.json ./api-gateway/

# Install dependencies
RUN npm install --workspaces

# Copy source code
COPY shared/models ./shared/models
COPY shared/middleware ./shared/middleware
COPY api-gateway ./api-gateway

# Build shared packages
WORKDIR /app/shared/models
RUN npm run build

WORKDIR /app/shared/middleware
RUN npm run build

# Build gateway
WORKDIR /app/api-gateway
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY shared/models/package.json ./shared/models/
COPY shared/middleware/package.json ./shared/middleware/
COPY api-gateway/package.json ./api-gateway/

# Install production dependencies only
RUN npm install --workspaces --production

# Copy built files from builder
COPY --from=builder /app/shared/models/dist ./shared/models/dist
COPY --from=builder /app/shared/middleware/dist ./shared/middleware/dist
COPY --from=builder /app/api-gateway/dist ./api-gateway/dist

# Set working directory to gateway
WORKDIR /app/api-gateway

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start gateway
CMD ["node", "dist/index.js"]
