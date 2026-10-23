# Dockerfile — deploy this EXACT image to Render and Cloud Run (and any VPS).
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
ENV PORT=3000
ENV CLOUD_NAME=docker
EXPOSE 3000
CMD ["node", "server.js"]
