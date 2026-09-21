FROM node:22-alpine
WORKDIR /app
RUN npm install --global pnpm@10.33.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY packages/shared-types packages/shared-types
RUN pnpm build
USER node
CMD ["node", "apps/api/dist/database/migrate.js"]
