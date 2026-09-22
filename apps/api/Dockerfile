FROM node:22-alpine AS build
WORKDIR /app
RUN npm install --global pnpm@10.33.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY packages/shared-types packages/shared-types
RUN pnpm --filter @bilty/shared-types build && pnpm --filter @bilty/api build
FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/assets ./apps/api/assets
COPY --from=build --chown=node:node /app/packages/shared-types ./packages/shared-types
USER node
CMD ["node", "apps/api/dist/database/migrate.js"]
