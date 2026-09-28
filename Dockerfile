# Use official Playwright environment containing all browser dependencies & Chromium
FROM mcr.microsoft.com/playwright:v1.50.0-jammy

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install npm dependencies
RUN npm ci --only=production || npm install --production

# Copy all application files
COPY . .

# Environment configuration
ENV NODE_ENV=production
ENV PORT=3000

# Expose server port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
