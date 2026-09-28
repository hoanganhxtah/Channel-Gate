FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build \
    && npm prune --omit=dev \
    && mkdir -p logs \
    && chown -R node:node /app

ENV NODE_ENV=production

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
