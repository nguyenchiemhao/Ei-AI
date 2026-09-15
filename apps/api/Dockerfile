# Node and pnpm are pinned by digest so the image, not a reminder, guarantees the version (C-2).
FROM node@sha256:83fdfa2a4de32d7f8d79829ea259bd6a4821f8b2d123204ac467fbe3966450fc AS base
# Node 22.13.1 ships a corepack whose npm signing keys predate the current ones,
# so pnpm activation fails signature verification unless corepack is updated first.
RUN npm install -g corepack@latest && corepack enable
WORKDIR /workspace

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

FROM deps AS dev
# iproute2 so the C-1 check reads a real routing table: without `ip`, the proof
# `ip route | grep -c default` prints 0 on empty input, a false green on the invariant.
# procps because nest --watch reaps its child through `ps` and dies without it.
USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends iproute2 procps \
 && rm -rf /var/lib/apt/lists/*
COPY tsconfig.base.json ./
COPY packages/ packages/
COPY apps/api/ apps/api/
EXPOSE 3000 9229
CMD ["pnpm", "--filter", "@ei-ai/api", "start:debug"]

FROM dev AS build
# confirmModulesPurge: switching to prod-only dependencies removes the existing
# node_modules, and pnpm refuses to do that unprompted without a TTY.
RUN pnpm --filter @ei-ai/api build \
 && pnpm install --prod --frozen-lockfile --config.confirmModulesPurge=false

FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /workspace/node_modules node_modules/
COPY --from=build /workspace/apps/api/node_modules apps/api/node_modules/
COPY --from=build /workspace/apps/api/dist apps/api/dist/
COPY --from=build /workspace/apps/api/package.json apps/api/
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
