# Dockerfile for the Aegis API service (part of docker-compose).
FROM node:20-alpine
WORKDIR /api
COPY api/package.json ./
RUN npm install --omit=dev
COPY api/ ./
COPY packages/ ../packages/
COPY intelligence/ ../intelligence/
COPY orchestration/ ../orchestration/
ENV PORT=4000
EXPOSE 4000
CMD ["node", "index.js"]
