# syntax=docker/dockerfile:1

FROM node:24-alpine AS workspace

RUN corepack enable pnpm \
  && mkdir /workspace \
  && chown node:node /workspace

USER node
WORKDIR /workspace

COPY --chown=node:node . .

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store,uid=1000,gid=1000 \
  pnpm install --frozen-lockfile --filter "api..." --store-dir /pnpm/store

RUN pnpm --filter "api^..." run build

FROM workspace AS development

EXPOSE 3001

CMD ["pnpm", "--filter", "api", "dev"]
