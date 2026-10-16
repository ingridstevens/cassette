#!/usr/bin/env bash
# Bundle the engine into engine/dist/engine/ (one-folder) with PyInstaller. Run on each target OS.
set -euo pipefail
cd "$(dirname "$0")"
# --extra llm adds llama.cpp (compiled from source) on Windows and Linux so the packaged app can write highlights and summaries.
# Apple Silicon Macs also bundle the Apple GPU engine (MLX). Untested: not yet built with PyInstaller.
EXTRA=()
if uv run --extra llm python -c "import mlx_whisper" 2>/dev/null; then
  EXTRA=(--collect-all mlx --collect-all mlx_whisper --collect-all numba --collect-all llvmlite)
fi
uv run --extra llm pyinstaller --noconfirm --clean --onedir --name engine \
  --collect-all pyannote.audio --collect-all pyannote.core --collect-all pyannote.pipeline \
  --collect-all lightning_fabric --collect-all pytorch_lightning --collect-all speechbrain \
  --collect-all faster_whisper --collect-all imageio_ffmpeg --collect-data lightning_fabric \
  ${EXTRA[@]+"${EXTRA[@]}"} \
  --copy-metadata torch --copy-metadata tqdm --copy-metadata huggingface_hub \
  src/engine/__main__.py
