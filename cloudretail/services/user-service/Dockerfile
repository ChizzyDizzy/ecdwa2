# Multi-stage build for user-service
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY shared/models/package.json ./shared/models/
COPY shared/middleware/package.json ./shared/middleware/
COPY services/user-service/package.json ./services/user-service/

# Install dependencies
RUN npm install --workspaces

# Copy source code
COPY shared/models ./shared/models
COPY shared/middleware ./shared/middleware
COPY services/user-service ./services/user-service

# Build shared packages
WORKDIR /app/shared/models
RUN npm run build

WORKDIR /app/shared/middleware
RUN npm run build

# Build service
WORKDIR /app/services/user-service
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY shared/models/package.json ./shared/models/
COPY shared/middleware/package.json ./shared/middleware/
COPY services/user-service/package.json ./services/user-service/

# Install production dependencies only
RUN npm install --workspaces --production

# Copy built files from builder
COPY --from=builder /app/shared/models/dist ./shared/models/dist
COPY --from=builder /app/shared/middleware/dist ./shared/middleware/dist
COPY --from=builder /app/services/user-service/dist ./services/user-service/dist

# Create logs directory
RUN mkdir -p /app/services/user-service/logs

# Set working directory to service
WORKDIR /app/services/user-service

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start service
CMD ["node", "dist/index.js"]
