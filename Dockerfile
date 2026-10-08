# syntax=docker/dockerfile:1
# Production image for the Humora backend.
# cgo is required: face recognition loads ONNX Runtime through onnxruntime_go.

ARG GO_VERSION=1.27
ARG ORT_VERSION=1.30.0

FROM golang:${GO_VERSION}-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY cmd ./cmd
COPY configs ./configs
COPY internal ./internal
COPY pkg ./pkg
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=1 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM debian:bookworm-slim AS onnxruntime
ARG ORT_VERSION
ARG TARGETARCH
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
RUN set -eux; \
    case "$TARGETARCH" in amd64) arch=x64 ;; arm64) arch=aarch64 ;; *) echo "unsupported arch $TARGETARCH"; exit 1 ;; esac; \
    curl -fsSL "https://github.com/microsoft/onnxruntime/releases/download/v${ORT_VERSION}/onnxruntime-linux-${arch}-${ORT_VERSION}.tgz" \
      | tar -xz --strip-components=1 -C /opt; \
    cp -L /opt/lib/libonnxruntime.so.${ORT_VERSION} /opt/libonnxruntime.so

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates tzdata && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --home-dir /app humora
WORKDIR /app
COPY --from=onnxruntime /opt/libonnxruntime.so /usr/lib/libonnxruntime.so
COPY --from=build /out/server /app/server
COPY configs/models/*.onnx /app/configs/models/

ENV ENV=production \
    PORT=8090 \
    ONNXRUNTIME_LIB_PATH=/usr/lib/libonnxruntime.so \
    GOMEMLIMIT=460MiB

USER humora
EXPOSE 8090
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD ["/bin/sh", "-c", "exec 3<>/dev/tcp/127.0.0.1/${PORT} && printf 'GET /livez HTTP/1.0\\r\\n\\r\\n' >&3 && grep -q '200 OK' <&3"]
ENTRYPOINT ["/app/server"]
