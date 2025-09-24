# syntax=docker.io/docker/dockerfile:1

FROM node:22 AS base

ARG NPM_REGISTRY
ARG BINARY_MIRROR_URL

# 启用 corepack 并启用 pnpm
RUN corepack enable && export COREPACK_NPM_REGISTRY=$NPM_REGISTRY && corepack prepare pnpm --activate
RUN pnpm config set registry $NPM_REGISTRY

WORKDIR /app
COPY . .

# 安装依赖
RUN pnpm install --frozen-lockfile

RUN pnpm run build

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.

EXPOSE 3000

ENV PORT=3000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
ENV HOSTNAME="0.0.0.0"
# CMD ["node", "server.js"]
CMD ["pnpm", "start"]