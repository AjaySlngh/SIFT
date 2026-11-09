# Single shared image for every Node piece of the app (web, worker, and the
# one-off migrate/seed jobs). It's a pnpm workspace, so all of them need the
# same installed node_modules + workspace source; which process actually runs
# is decided by the `command:` override in docker-compose.yml.
FROM node:20-alpine

# Next.js on Alpine needs this for some native deps (recommended by the
# official Next.js Docker example); sharp/pdfjs-dist ship musl prebuilds so
# no extra build toolchain is required.
RUN apk add --no-cache libc6-compat

ENV COREPACK_HOME=/opt/corepack
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Install deps first so this layer is cached unless lockfile/package.json
# files change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
RUN pnpm install --frozen-lockfile

# Now bring in the rest of the source (templates/, scripts/, src/ dirs, etc.)
# and build the Next.js app. @sift/core and @sift/db ship raw TypeScript, so
# the worker/migrate/seed processes run them straight through tsx — no build
# step needed for those.
COPY . .
RUN pnpm --filter @sift/web build \
 && chgrp -R 0 /app /opt/corepack \
 && chmod -R g=u /app /opt/corepack

ENV NODE_ENV=production HOME=/tmp
EXPOSE 3000

CMD ["pnpm", "--filter", "@sift/web", "start"]
