# Фронт карьерного трекера (Next.js). Сборка из корня:
#   docker compose -f infra/docker-compose.yml build web
# Стадия сборки: статика генерируется в .next; стадия рантайма — только
# prod-зависимости и код, без исходников и без ключей (ключей у фронта нет).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json next.config.js package.json ./
COPY pages ./pages
COPY lib ./lib
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/next.config.js ./next.config.js
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next

EXPOSE 3000

CMD ["sh", "-c", "./node_modules/.bin/next start -H 0.0.0.0 -p ${PORT}"]
