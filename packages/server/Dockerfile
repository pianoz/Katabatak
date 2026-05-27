FROM node:22-alpine
WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace manifests so we can install only the server's deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/server/package.json ./packages/server/
COPY database.types.ts ./

RUN pnpm install --frozen-lockfile --filter server

# Copy server source
COPY packages/server/ ./packages/server/

WORKDIR /app/packages/server
EXPOSE 8080

CMD ["node", "node_modules/.bin/tsx", "index.ts"]
