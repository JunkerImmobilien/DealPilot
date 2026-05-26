# V288-libreoffice-applied
FROM node:20-bookworm-slim

WORKDIR /app

# Install system dependencies: LibreOffice (headless) for BMF-Sandwich-Service
# + Schriften damit XLSX-Recalc keine Rendering-Probleme hat.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-calc \
    libreoffice-core \
    fonts-dejavu-core \
    fonts-liberation \
    default-jre-headless \
    wget \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Verify LibreOffice is installed (build-time check, fails build if missing)
RUN libreoffice --version

# Install Node dependencies first (better layer caching)
COPY package*.json ./
RUN npm install --omit=dev

# Copy source
COPY src ./src
COPY templates ./templates
COPY migrations ./migrations
COPY seed-data ./seed-data
COPY scripts ./scripts

# Uploads-Verzeichnis (wird von Volume gemountet)
RUN mkdir -p /app/uploads

# Run as non-root for security
# WICHTIG: LibreOffice braucht ein beschreibbares /tmp-Verzeichnis + ein
# HOME-Verzeichnis (für ~/.config/libreoffice). Beides bekommt der junker-User.
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -m -s /bin/false junker && \
    chown -R junker:nodejs /app && \
    mkdir -p /home/junker/.config && \
    chown -R junker:nodejs /home/junker
USER junker
ENV HOME=/home/junker
ENV BMF_RECALC_TIMEOUT_MS=60000

EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "src/index.js"]
