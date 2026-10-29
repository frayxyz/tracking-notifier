FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
COPY scripts ./scripts
COPY tests ./tests
RUN npx tsc -p tsconfig.json

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY src/infrastructure/persistence/migrations ./dist/infrastructure/persistence/migrations
EXPOSE 3000
ENTRYPOINT ["node", "dist/src/main.js"]
