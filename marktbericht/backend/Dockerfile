FROM node:22-alpine
WORKDIR /app
# Build-Context ist das Projekt-Root (siehe docker-compose: context: .)
COPY backend/package.json ./
RUN npm install --omit=dev
COPY backend/ ./
COPY frontend/ ./frontend/
EXPOSE 4000
CMD ["node", "src/server.js"]
