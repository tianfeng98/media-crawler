# syntax=docker.io/docker/dockerfile:1

FROM node:22 AS base

ARG NPM_REGISTRY
ARG BINARY_MIRROR_URL

ENV PLAYWRIGHT_DOWNLOAD_HOST=$BINARY_MIRROR_URL/playwright

# 1. 替换Debian软件源为清华源
RUN if [ -f /etc/apt/sources.list ]; then \
        sed -i 's/deb.debian.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apt/sources.list && \
        sed -i 's/security.debian.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apt/sources.list; \
    fi && \
    if [ -d /etc/apt/sources.list.d ]; then \
        find /etc/apt/sources.list.d -name "*.list" -o -name "*.sources" | xargs sed -i 's/deb.debian.org/mirrors.tuna.tsinghua.edu.cn/g' && \
        find /etc/apt/sources.list.d -name "*.list" -o -name "*.sources" | xargs sed -i 's/security.debian.org/mirrors.tuna.tsinghua.edu.cn/g'; \
    fi

# 2. 更新软件包列表
RUN apt-get update

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

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

USER nextjs

EXPOSE 3000

ENV PORT=3000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]