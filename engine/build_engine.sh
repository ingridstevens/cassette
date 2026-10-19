#!/usr/bin/env bash
# Bundle the engine into engine/dist/engine/ (one-folder) with PyInstaller. Run on each target OS.
# Windows: run from Git Bash (the GitHub runner's default bash). Highlights and summaries (llama.cpp) are left out there
# unless you set ENGINE_LLM=1, because llama-cpp-python is compiled from source and needs Visual Studio Build Tools.
# On macOS and Linux they are included unless you set ENGINE_LLM=0.
set -euo pipefail
cd "$(dirname "$0")"

case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) default_llm=0 ;; *) default_llm=1 ;; esac
LLM_ARGS=()
if [ "${ENGINE_LLM:-$default_llm}" = "1" ]; then LLM_ARGS=(--extra llm); fi

# Apple Silicon Macs also bundle the Apple GPU engine (MLX). Untested: not yet built with PyInstaller.
EXTRA=()
if uv run python -c "import mlx_whisper" 2>/dev/null; then
  EXTRA=(--collect-all mlx --collect-all mlx_whisper --collect-all numba --collect-all llvmlite)
fi
uv run ${LLM_ARGS[@]+"${LLM_ARGS[@]}"} pyinstaller --noconfirm --clean --onedir --name engine \
  --collect-all pyannote.audio --collect-all pyannote.core --collect-all pyannote.pipeline \
  --collect-all lightning_fabric --collect-all pytorch_lightning --collect-all speechbrain \
  --collect-all faster_whisper --collect-all imageio_ffmpeg --collect-data lightning_fabric \
  ${EXTRA[@]+"${EXTRA[@]}"} \
  --copy-metadata torch --copy-metadata tqdm --copy-metadata huggingface_hub \
  src/engine/__main__.py

# Fail loudly if the program does not start: a broken bundle is much cheaper to find here than on a user's computer.
exe=dist/engine/engine
[ -f "$exe.exe" ] && exe="$exe.exe"
"$exe" models status >/dev/null
echo "Engine bundle OK: $exe"
