# syntax=docker/dockerfile:1
# Builds the SPA and serves it with nginx, proxying /api (incl. the Pulse WebSocket) to the backend.
# The app calls relative /api URLs, so serving both from one origin needs no CORS.

FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM nginx:1.29-alpine
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=755 15-humora-realip.sh /docker-entrypoint.d/15-humora-realip.sh
COPY --from=build /app/dist /usr/share/nginx/html
# Where nginx forwards /api; override per environment.
ENV BACKEND_UPSTREAM=http://backend:8090
EXPOSE 8080
