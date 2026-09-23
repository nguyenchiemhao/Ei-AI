FROM node@sha256:83fdfa2a4de32d7f8d79829ea259bd6a4821f8b2d123204ac467fbe3966450fc AS base
RUN npm install -g corepack@latest && corepack enable
WORKDIR /workspace

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/eslint-config/package.json packages/eslint-config/
COPY packages/shared-types/package.json packages/shared-types/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

FROM deps AS dev
COPY tsconfig.base.json ./
COPY packages/ packages/
COPY apps/web/ apps/web/
EXPOSE 5173
CMD ["sh", "-c", "pnpm --filter @ei-ai/shared-types build && pnpm --filter @ei-ai/web dev"]

# The E2E runner, on the same Node as everything else: the Playwright image ships Node 24 and the
# workspace pins >=22.13 <23 with engine-strict, so using it would mean running the tests on a
# runtime the product does not. Browsers are downloaded here because an image build reaches the
# network and a container on the internal network does not.
FROM deps AS e2e
RUN pnpm --filter @ei-ai/web exec playwright install --with-deps chromium
COPY tsconfig.base.json ./
COPY packages/ packages/
COPY apps/web/ apps/web/
CMD ["pnpm", "--filter", "@ei-ai/web", "test:e2e"]
