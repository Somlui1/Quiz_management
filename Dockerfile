# Base stage for building
FROM node:20-bullseye-slim AS builder

WORKDIR /app

# Install build tools in case better-sqlite3 requires compilation
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

# Copy the rest of the project files and build
COPY . .
RUN npm run build

# Production stage
FROM node:20-bullseye-slim

WORKDIR /app

# Copy built code and dependencies from builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Create data directory for SQLite database storage
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "run", "start"]
