FROM node:24-slim
WORKDIR /app
RUN corepack enable pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY server ./server
COPY shared ./shared
EXPOSE 8787
CMD ["pnpm", "exec", "tsx", "server/index.ts"]
