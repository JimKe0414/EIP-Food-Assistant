# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable \
  && corepack prepare pnpm@11.6.0 --activate

WORKDIR /app

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile

FROM dependencies AS build

COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS web-runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV NITRO_HOST=0.0.0.0
ENV PORT=3000
ENV NITRO_PORT=3000

WORKDIR /app

COPY --from=build --chown=node:node /app/.output ./.output

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", ".output/server/index.mjs"]

FROM node:22-bookworm-slim AS worker-runtime

ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/dist/worker ./dist/worker
COPY --from=build --chown=node:node /app/scripts/check-gpu.mjs ./scripts/check-gpu.mjs
USER node
CMD ["node", "dist/worker/index.js"]

FROM build AS migrator
CMD ["pnpm", "db:migrate"]
