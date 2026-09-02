# syntax=docker/dockerfile:1

FROM node:24-alpine AS workspace

RUN corepack enable pnpm \
  && mkdir /workspace \
  && chown node:node /workspace

USER node
WORKDIR /workspace

COPY --chown=node:node . .

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store,uid=1000,gid=1000 \
  pnpm install --frozen-lockfile --filter "web..." --store-dir /pnpm/store

RUN pnpm --filter "web^..." run build

FROM workspace AS development

ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

CMD ["pnpm", "--filter", "web", "dev"]
