FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies first (better caching)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# Copy source code
COPY *.ts ./
COPY tsconfig.json ./

# Build TypeScript
RUN pnpm run build

EXPOSE 3000

CMD ["node", "dist/server.js"]
