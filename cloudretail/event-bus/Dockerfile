# Multi-stage build for event-bus
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY shared/models/package.json ./shared/models/
COPY shared/middleware/package.json ./shared/middleware/
COPY event-bus/package.json ./event-bus/

# Install dependencies
RUN npm install --workspaces

# Copy source code
COPY shared/models ./shared/models
COPY shared/middleware ./shared/middleware
COPY event-bus ./event-bus

# Build shared packages
WORKDIR /app/shared/models
RUN npm run build

WORKDIR /app/shared/middleware
RUN npm run build

# Build event bus
WORKDIR /app/event-bus
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY shared/models/package.json ./shared/models/
COPY shared/middleware/package.json ./shared/middleware/
COPY event-bus/package.json ./event-bus/

# Install production dependencies only
RUN npm install --workspaces --production

# Copy built files from builder
COPY --from=builder /app/shared/models/dist ./shared/models/dist
COPY --from=builder /app/shared/middleware/dist ./shared/middleware/dist
COPY --from=builder /app/event-bus/dist ./event-bus/dist

# Set working directory to event bus
WORKDIR /app/event-bus

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start event bus
CMD ["node", "dist/index.js"]
