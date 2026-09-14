FROM node@sha256:83fdfa2a4de32d7f8d79829ea259bd6a4821f8b2d123204ac467fbe3966450fc AS base
RUN npm install -g corepack@latest && corepack enable
WORKDIR /workspace

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

FROM deps AS dev
COPY tsconfig.base.json ./
COPY packages/ packages/
COPY apps/web/ apps/web/
EXPOSE 5173
CMD ["pnpm", "--filter", "@ei-ai/web", "dev"]
