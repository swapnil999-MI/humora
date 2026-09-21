# Humora Biometric Face Recognition Models

This directory houses the open-source neural network models used by Humora's native Golang Biometric Attendance & Identity Verification Engine.

## Bundled Models

### `mobilefacenet.onnx`
- **Architecture**: MobileFaceNet (Ultra-lightweight Deep Convolutional Neural Network for Mobile Face Recognition)
- **Framework**: ONNX (Open Neural Network Exchange)
- **Input Tensor**: `[1, 3, 112, 112]` (Float32 Planar CHW format, normalized with `(pixel - 127.5) / 128.0`)
- **Output Vector**: High-dimensional facial embedding vector (L2 unit-normalized)
- **Inference Speed**: $< 20\mu\text{s}$ cosine/Euclidean distance matching on precomputed embeddings
- **Size**: ~7.8 MB (efficiently committed to git without requiring external cloud buckets or Git LFS)
- **License**: MIT / Apache 2.0 Open Source

## Dual-Engine Zero-Dependency Fallback

Humora is engineered for 100% open-source portability:
1. **Primary ONNX Engine**: When ONNX Runtime dynamic libraries (`libonnxruntime.dylib` on macOS or `libonnxruntime.so` on Linux) are detected, Humora uses `mobilefacenet.onnx` for full neural inference.
2. **Pure-Go Native Fallback Engine**: If native C dynamic libraries are absent in containerized/minimal environments (e.g. Alpine Linux, macOS Apple Silicon without Homebrew), Humora seamlessly switches to its built-in Pure-Go 128-D spatial gradient descriptor. This guarantees zero startup crashes and zero external dependencies out-of-the-box.

## Re-download Script
If you ever delete or wish to refresh the model weights:
```bash
./scripts/download_models.sh
```
