FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm install --omit=dev

# Copy source
COPY src ./src
COPY migrations ./migrations
COPY seed-data ./seed-data
COPY scripts ./scripts

# Uploads-Verzeichnis (wird von Volume gemountet)
RUN mkdir -p /app/uploads

# Run as non-root for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S junker -u 1001 -G nodejs && \
    chown -R junker:nodejs /app
USER junker

EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "src/index.js"]
