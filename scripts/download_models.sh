#!/usr/bin/env bash
set -euo pipefail

# Scripts directory resolution
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
MODELS_DIR="${ROOT_DIR}/configs/models"

mkdir -p "${MODELS_DIR}"

MODEL_PATH="${MODELS_DIR}/mobilefacenet.onnx"
SOURCE_URL="https://hailo-model-zoo.s3.eu-west-2.amazonaws.com/FaceRecognition/arcface/arcface_mobilefacenet/pretrained/2022-08-24/arcface_mobilefacenet.zip"

echo "=== Humora Biometrics Model Setup ==="
if [ -f "${MODEL_PATH}" ]; then
    echo "✓ MobileFaceNet ONNX model already exists at: ${MODEL_PATH} ($(ls -lh "${MODEL_PATH}" | awk '{print $5}'))"
    exit 0
fi

echo "Downloading open-source MobileFaceNet weights..."
TEMP_ZIP="${MODELS_DIR}/mbf_temp.zip"
curl -L -o "${TEMP_ZIP}" "${SOURCE_URL}"

echo "Extracting model..."
unzip -p "${TEMP_ZIP}" mbf.onnx > "${MODEL_PATH}"
rm -f "${TEMP_ZIP}"

echo "✓ Successfully installed MobileFaceNet ONNX model to ${MODEL_PATH} ($(ls -lh "${MODEL_PATH}" | awk '{print $5}'))"
