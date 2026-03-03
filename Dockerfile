FROM node:22-slim

WORKDIR /app

# Copy package.json first for better caching
COPY package.json ./

# Install ALL dependencies (including devDependencies for vite build)
RUN npm install

# Copy everything else
COPY . .

# Build frontend
RUN npm run build

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "--experimental-strip-types", "server/index.ts"]
