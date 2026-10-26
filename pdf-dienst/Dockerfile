# pdf-dienst — v2961
# Headless-Chromium aus Debian, gesteuert ueber puppeteer-core (kein
# mitgeladener Chrome). Baut KEIN PDF selbst: es oeffnet die echte App und
# ruft deren PDF-Funktion. Siehe server.js.
FROM node:22-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-dejavu-core ca-certificates dumb-init \
 && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=1 \
    CHROMIUM_PFAD=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server.js ./

# Kein root: Chromium laeuft als node-Nutzer (mit --no-sandbox, weil der
# Container selbst die Grenze ist und keine Namespaces fuer die Sandbox hat).
USER node
EXPOSE 4100
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
