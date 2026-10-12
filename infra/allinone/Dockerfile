# syntax=docker/dockerfile:1
# Humora all-in-one image: PostgreSQL, Redis, MinIO, the API server and the web app in one container.
# Built from the repository root:
#   docker build -f infra/allinone/Dockerfile -t humora .
# Run:
#   docker run -d --name humora -p 8080:8080 -v humora-data:/data -v /mnt/backup-disk/humora:/backups \
#     -e HUMORA_URL=http://<host>:8080 humora

ARG GO_VERSION=1.27.2
# Built from source without LLVM JIT, ICU, Perl or readline: the distro packages pull in ~340 MB
# (libLLVM alone is 117 MB) that Humora never uses.
ARG PG_VERSION=17.11
ARG ORT_VERSION=1.30.0
# MinIO stopped publishing community binaries and images, so it is compiled from the AGPLv3 source tag.
ARG MINIO_RELEASE=RELEASE.2025-09-07T16-13-09Z

# ── API server (cgo: face recognition loads ONNX Runtime) ─────────────────────
FROM golang:${GO_VERSION}-bookworm AS server
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY cmd ./cmd
COPY configs ./configs
COPY internal ./internal
COPY pkg ./pkg
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=1 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# ── Web app ───────────────────────────────────────────────────────────────────
# The bundle is plain JS/CSS, so build it on the native platform (Bun crashes under QEMU emulation).
FROM --platform=$BUILDPLATFORM oven/bun:1 AS web
WORKDIR /web
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile
COPY web/ ./
RUN bun run build

# ── MinIO (unmodified upstream source) ────────────────────────────────────────
# Pure Go: cross-compiled natively for the target architecture instead of running under emulation.
FROM --platform=$BUILDPLATFORM golang:${GO_VERSION}-bookworm AS minio
ARG MINIO_RELEASE
ARG TARGETOS
ARG TARGETARCH
RUN git clone --depth 1 --branch "${MINIO_RELEASE}" https://github.com/minio/minio.git /src
WORKDIR /src
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -tags kqueue -ldflags="-s -w" -o /out/minio .

# ── PostgreSQL (server, client tools and pgcrypto only) ───────────────────────
FROM debian:bookworm-slim AS postgres
ARG PG_VERSION
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl build-essential pkg-config bison flex libssl-dev zlib1g-dev liblz4-dev \
    && rm -rf /var/lib/apt/lists/*
RUN set -eux; \
    curl -fsSL "https://ftp.postgresql.org/pub/source/v${PG_VERSION}/postgresql-${PG_VERSION}.tar.bz2" | tar -xj -C /tmp; \
    cd /tmp/postgresql-${PG_VERSION}; \
    ./configure --prefix=/usr/local/pgsql --with-openssl --with-lz4 \
      --without-icu --without-llvm --without-readline --without-perl --without-python --without-tcl; \
    make -j"$(nproc)"; \
    make install; \
    make -C contrib/pgcrypto install; \
    rm -rf /usr/local/pgsql/include /usr/local/pgsql/lib/pgxs /usr/local/pgsql/lib/*.a; \
    find /usr/local/pgsql -type f \( -perm -u+x -o -name '*.so*' \) -exec strip --strip-unneeded {} + 2>/dev/null || true

# ── ONNX Runtime ──────────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS vendor
ARG ORT_VERSION
ARG TARGETARCH
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
RUN set -eux; \
    case "$TARGETARCH" in amd64) ort=x64 ;; arm64) ort=aarch64 ;; *) echo "unsupported arch $TARGETARCH"; exit 1 ;; esac; \
    mkdir -p /out /tmp/ort; \
    curl -fsSL "https://github.com/microsoft/onnxruntime/releases/download/v${ORT_VERSION}/onnxruntime-linux-${ort}-${ORT_VERSION}.tgz" \
      | tar -xz --strip-components=1 -C /tmp/ort; \
    cp -L /tmp/ort/lib/libonnxruntime.so.${ORT_VERSION} /out/libonnxruntime.so

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends redis-server nginx-light tini ca-certificates libssl3 rsync \
    && rm -rf /var/lib/apt/lists/* /var/cache/debconf/*-old /usr/share/doc/* /usr/share/man/* \
              /usr/share/locale/* /etc/nginx/sites-enabled/* \
    && useradd --system --uid 999 --user-group --home-dir /var/lib/postgresql postgres \
    && install -d -o postgres -g postgres -m 2775 /var/run/postgresql \
    && useradd --system --uid 10001 --home-dir /app humora

COPY --from=postgres /usr/local/pgsql /usr/local/pgsql

COPY --from=vendor /out/libonnxruntime.so /usr/lib/libonnxruntime.so
COPY --from=minio /out/minio /usr/local/bin/minio
COPY --from=server /out/server /app/server
COPY configs/models/*.onnx /app/configs/models/
COPY database/migrations /app/migrations
COPY --from=web /web/dist /app/web
COPY infra/allinone/nginx.conf /etc/nginx/nginx.conf
COPY infra/allinone/lib.sh /usr/local/lib/humora/lib.sh
COPY infra/allinone/entrypoint.sh /usr/local/bin/humora-entrypoint
COPY infra/allinone/migrate.sh /usr/local/bin/humora-migrate
COPY infra/allinone/backup.sh /usr/local/bin/humora-backup
COPY infra/allinone/archive-wal.sh /usr/local/bin/humora-archive-wal
RUN chmod +x /usr/local/bin/humora-*

ARG HUMORA_VERSION=dev
LABEL org.opencontainers.image.title="Humora" \
      org.opencontainers.image.description="Humora HRMS: API, web app, PostgreSQL, Redis and MinIO in one image" \
      org.opencontainers.image.version="${HUMORA_VERSION}"

# PGHOST: the source build defaults to a /tmp socket; point psql/pg_dump at the server's socket dir.
ENV PATH=/usr/local/pgsql/bin:$PATH \
    PGHOST=/var/run/postgresql \
    HUMORA_URL=http://localhost:8080 \
    HUMORA_VERSION=${HUMORA_VERSION} \
    ONNXRUNTIME_LIB_PATH=/usr/lib/libonnxruntime.so

# No VOLUME instruction on purpose: it would silently create an anonymous volume that is lost on
# upgrade. The entrypoint refuses to start unless /data is an explicit volume or bind mount.
EXPOSE 8080
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=20s --timeout=5s --start-period=90s --retries=3 \
  CMD ["humora-entrypoint", "healthcheck"]
ENTRYPOINT ["tini", "--", "humora-entrypoint"]
