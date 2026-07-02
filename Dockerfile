FROM node:24-slim
WORKDIR /app
RUN corepack enable pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY server ./server
COPY shared ./shared
RUN pnpm exec esbuild server/index.ts --bundle --platform=node --format=cjs --outfile=dist/index.cjs
EXPOSE 8787
CMD ["node", "dist/index.cjs"]
