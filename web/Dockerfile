# Dockerfile for the Aegis web portal.
FROM node:20-alpine
WORKDIR /app
COPY web/package*.json ./
RUN npm ci --omit=dev
COPY web/ ./
COPY packages/ ../packages/
COPY intelligence/ ../intelligence/
COPY orchestration/ ../orchestration/
ENV PORT=3100
EXPOSE 3100
CMD ["node", "server.js"]
