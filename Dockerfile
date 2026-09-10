# Quantum v1 — multi-stage: build once, run server + PWA.
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.33.3 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY . .
RUN pnpm --filter @quantum/shared build \
    && pnpm --filter @quantum/server build \
    && pnpm --filter @quantum/web build

FROM node:22-bookworm-slim AS server
WORKDIR /app
ENV NODE_ENV=production \
    QUANTUM_HOST=127.0.0.1 \
    QUANTUM_PORT=43128 \
    QUANTUM_DATA_DIR=/data
COPY --from=build /app /app
WORKDIR /app/packages/server
EXPOSE 43128
CMD ["node", "dist/index.js"]

FROM nginx:1.27-alpine AS web
# envsubst only QUANTUM_API_TOKEN so $host / $scheme stay nginx variables.
ENV NGINX_ENVSUBST_FILTER=^QUANTUM_API_TOKEN$
COPY deploy/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/packages/web/dist /usr/share/nginx/html
EXPOSE 80
