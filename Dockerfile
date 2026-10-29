FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY node_modules ./node_modules
COPY src ./src
COPY scripts ./scripts
COPY tests ./tests
RUN npx tsc -p tsconfig.json

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY src/infrastructure/persistence/migrations ./dist/src/infrastructure/persistence/migrations
EXPOSE 3000
ENTRYPOINT ["node", "dist/src/main.js"]
