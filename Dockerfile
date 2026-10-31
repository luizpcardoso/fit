FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/api-client/package.json ./packages/api-client/package.json
RUN npm ci --workspace=@fit/api --workspace=@fit/contracts --workspace=@fit/web --no-audit --no-fund
COPY . .
RUN npm run build --workspace=@fit/web \
    && npm prune --omit=dev --workspace=@fit/api --workspace=@fit/contracts --ignore-scripts --no-audit --no-fund \
    && mkdir -p /app/apps/api/node_modules

FROM node:22-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3333 MEDIA_DIR=/var/lib/fit/media
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/src ./apps/api/src
COPY --from=build --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /app/apps/mobile/certs ./apps/mobile/certs
COPY --from=build --chown=node:node /app/apps/web ./apps/web
COPY --from=build --chown=node:node /app/packages/contracts ./packages/contracts
RUN mkdir -p /var/lib/fit/media && chown -R node:node /var/lib/fit
USER node
EXPOSE 3333
CMD ["node", "--import", "tsx", "apps/api/src/server.ts"]
