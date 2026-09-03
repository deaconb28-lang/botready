# The Playwright image rather than a bare node image, because installing
# Chromium's system libraries with apt is a fight you lose slowly.
# Keep this tag in step with the playwright version in package.json.
FROM mcr.microsoft.com/playwright:v1.56.0-jammy

ENV NODE_ENV=production \
    PNPM_HOME=/usr/local/bin \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Workspace manifests first, so a dependency-free code change reuses the layer.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY packages/core/package.json ./packages/core/
COPY apps/scanner/package.json ./apps/scanner/

RUN pnpm install --frozen-lockfile --filter @botready/scanner...

COPY packages/core ./packages/core
COPY apps/scanner ./apps/scanner

# The image already carries a matching Chromium; PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD
# above stops the install step from fetching a second copy.

EXPOSE 8080
ENV PORT=8080

# The worker holds one long-lived Postgres connection, so it must not be
# restarted per request. Railway runs this as a service, not a function.
CMD ["pnpm", "--filter", "@botready/scanner", "start"]
