# Ledger: static SPA built with Vite, served by nginx.
# Build:  docker build -t ledger .
# Run:    docker run --rm -p 8080:8080 ledger   →  http://localhost:8080

# --- build: install, test, bundle ---------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app

# dependencies first, so that they are cached while only the sources change
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY tests ./tests
# a failing test fails the image build
RUN npm test && npm run build

# --- run: static files only, non-root nginx -----------------------------------
FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
