# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm install
WORKDIR /app/backend
RUN npm install

# Copy source code
WORKDIR /app
COPY . .

# Build backend
WORKDIR /app/backend
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app/backend

# Copy built application from builder stage
COPY --from=builder /app/backend ./

EXPOSE 4000

CMD ["npm", "start"]