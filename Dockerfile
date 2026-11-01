FROM node:24-slim AS web
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY vite.config.js ./
COPY web web
RUN npm run build

FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=docker:cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker:cli /usr/local/libexec/docker/cli-plugins/docker-buildx /usr/local/libexec/docker/cli-plugins/docker-buildx
WORKDIR /app
COPY server server
COPY --from=web /app/dist dist
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.js"]
