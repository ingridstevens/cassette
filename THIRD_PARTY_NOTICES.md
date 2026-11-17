# Third-party notices

Cassette's own code is released under [The Unlicense](LICENSE). **That dedication cannot
relicense anything written by others.** Every component below keeps its own licence, and anyone who
redistributes a build of this app (installer, bundle, container) must honour those licences.

Licence data below was read from installed package metadata (`importlib.metadata` in `engine/.venv`,
and the `package.json` of each package in `app/node_modules`) on the versions listed. Metadata can be
imprecise; the upstream repositories are authoritative. Transitive dependencies are **not** listed here
(regenerate with a tool such as `pip-licenses` / `license-checker` before a release).

## Python engine (direct dependencies, plus ctranslate2)

| Name | Version | Licence (per metadata) | Homepage |
|---|---|---|---|
| faster-whisper | 1.2.1 | MIT | https://github.com/SYSTRAN/faster-whisper |
| ctranslate2 | 4.8.3 | MIT | https://opennmt.net |
| pyannote.audio | 3.4.0 | MIT | https://github.com/pyannote/pyannote-audio |
| huggingface_hub | 0.36.2 | Apache-2.0 (metadata says "Apache") | https://github.com/huggingface/huggingface_hub |
| imageio-ffmpeg | 0.6.0 | BSD-2-Clause (wrapper only; see FFmpeg note) | https://github.com/imageio/imageio-ffmpeg |
| torch | 2.8.0 | BSD-3-Clause | https://pytorch.org/ |
| torchaudio | 2.8.0 | BSD (classifier only; no licence string) | https://github.com/pytorch/audio |
| python-docx | 1.2.0 | MIT | https://github.com/python-openxml/python-docx |
| mlx, mlx-metal (Apple Silicon Macs only) | 0.32.4 | MIT | https://github.com/ml-explore/mlx |
| mlx-whisper (Apple Silicon Macs only) | 0.4.3 | MIT | https://github.com/ml-explore/mlx-examples |
| mlx-lm (Apple Silicon Macs only) | 0.29.1 | MIT | https://github.com/ml-explore/mlx-lm |
| moonshine-voice (Apple Silicon Macs only) | 0.1.5 | MIT | https://github.com/moonshine-ai/moonshine |
| parakeet-mlx (Apple Silicon Macs only) | 0.5.3 | Apache-2.0 (per upstream README; PyPI metadata has no licence field) | https://github.com/senstella/parakeet-mlx |
| transformers (pulled in by mlx-lm) | 4.57.6 | Apache-2.0 | https://github.com/huggingface/transformers |
| llama-cpp-python (Windows and Linux; Intel Macs; not installed or tested on this Mac) | >=0.3 | MIT (per upstream; not read from installed metadata) | https://github.com/abetlen/llama-cpp-python |
| numba (pulled in by mlx-whisper) | 0.68.0 | BSD | https://github.com/numba/numba |
| llvmlite (pulled in by numba) | 0.50.0 | BSD-2-Clause AND Apache-2.0 WITH LLVM-exception (per package metadata) | https://github.com/numba/llvmlite |

Development/packaging only (not part of the app's source):

| Name | Version | Licence | Homepage |
|---|---|---|---|
| pytest | 9.1.1 | MIT | https://docs.pytest.org |
| pyinstaller | 6.22.3 | GPL-2.0-or-later with a special exception for building programs | https://pyinstaller.org |

PyInstaller's exception lets you distribute the programs it builds under your own terms, but its
bootloader is covered by that exception only as stated upstream; read it before shipping packaged builds.

## Desktop app (npm, direct dependencies)

| Name | Version | Licence | Homepage |
|---|---|---|---|
| react | 19.3.1 | MIT | https://react.dev/ |
| react-dom | 19.3.1 | MIT | https://react.dev/ |
| wavesurfer.js | 8.0.2 | BSD-3-Clause | https://wavesurfer.xyz |
| electron | 44.7.2 | MIT | https://github.com/electron/electron |
| electron-builder | 26.15.3 | MIT | https://github.com/electron-userland/electron-builder |
| vite | 8.3.4 | MIT | https://vite.dev |
| @vitejs/plugin-react | 6.1.2 | MIT | https://github.com/vitejs/vite-plugin-react |
| esbuild | 0.28.2 | MIT | https://github.com/evanw/esbuild |
| typescript | 7.0.2 | Apache-2.0 | https://www.typescriptlang.org/ |
| concurrently | 10.0.6 | MIT | https://github.com/open-cli-tools/concurrently |
| cross-env | 10.1.0 | MIT | https://github.com/kentcdodds/cross-env |
| wait-on | 9.5.1 | MIT | https://github.com/jeffbski/wait-on |

(`@types/*` packages are type definitions used at build time only.)

### Electron and Chromium

Electron bundles Chromium, Node.js and many other components under their own licences. Packaged
Electron apps include `LICENSE.electron.txt` and `LICENSES.chromium.html` (listing Chromium's
third-party licences). **Keep those files in any distributed build.**

## FFmpeg (important)

The engine uses an FFmpeg binary obtained through `imageio-ffmpeg` to decode audio/video and cut clips.
The imageio-ffmpeg Python wrapper is BSD-2-Clause, but **the FFmpeg binary is a separate work whose
licence is LGPL or GPL depending on how it was built.**

Verified on the binary in this repository's venv (`ffmpeg-macos-aarch64-v7.1`, FFmpeg 7.1):
`ffmpeg -version` prints a configuration containing `--enable-gpl` (with libx264, libx265 and others).
That build is therefore **GPL-licensed**. Binaries for other platforms or versions were not inspected.

To check any binary yourself: run `ffmpeg -version` and look at the `configuration:` line
(`--enable-gpl` / `--enable-version3` / `--enable-nonfree` indicate GPL, GPLv3 or non-redistributable
builds; without them it is LGPL). Source code: <https://ffmpeg.org/> (licence details:
<https://ffmpeg.org/legal.html>).

If you package and redistribute the app with this binary, you must comply with its licence: ship its
licence text, offer the corresponding source, and consider whether the GPL affects how you distribute the
bundle. Alternatives: use an LGPL-only FFmpeg build, or require users to install their own FFmpeg.
This project does not bundle FFmpeg in the repository; it is fetched into the Python environment.

## Models (downloaded by the user, not redistributed by this project)

The app downloads model weights from huggingface.co on demand into the user's data folder. This repository
does not contain or redistribute them.

| Model (Hugging Face repo) | Used for | Licence |
|---|---|---|
| Systran/faster-whisper-{tiny,base,small,medium,large-v3} | Transcription | Conversions of OpenAI Whisper weights, which OpenAI released under MIT. Repo licence tags not checked: check before redistributing. |
| mlx-community/whisper-{tiny,base,small,medium,large-v3-turbo}-mlx, whisper-large-v3-mlx | Transcription (Apple GPU engine) | Conversions of OpenAI Whisper weights for MLX, not gated. Only whisper-large-v3-mlx carries a licence tag (MIT); the others carry none. They are conversions of OpenAI's MIT-licensed weights, but that was **not verified from the model cards**: check before redistributing. |
| mobiuslabsgmbh/faster-whisper-large-v3-turbo | Transcription | Conversion of Whisper large-v3-turbo (MIT upstream). Repo licence tag not checked: check before redistributing. |
| mlx-community/Qwen2.5-{1.5B,7B}-Instruct-4bit; Qwen/Qwen2.5-1.5B-Instruct-GGUF; bartowski/Qwen2.5-7B-Instruct-GGUF | Suggesting highlights and writing summaries (language model) | Apache-2.0 for all four repos, per the licence tag on each repo's Hugging Face page when the code was written (the 3B size of Qwen2.5 is under a different, non-commercial licence and is not used). Check the model cards before redistributing. |
| mlx-community/Qwen3-1.7B-4bit; unsloth/Qwen3-1.7B-GGUF; mlx-community/Qwen3-4B-Instruct-2507-4bit; unsloth/Qwen3-4B-Instruct-2507-GGUF | Same (language model, chosen by the user) | Apache-2.0, per each repo's licence tag on Hugging Face (checked October 2026). Downloaded only when the user picks them. |
| mlx-community/gemma-3-text-4b-it-4bit; unsloth/gemma-3-4b-it-GGUF | Same (language model, chosen by the user) | Google's Gemma Terms of Use (licence tag "gemma"), not an open-source licence; the Settings list shows this next to the model. Downloaded only when the user picks it. |
| pyannote/speaker-diarization-3.1 | Speaker detection pipeline | MIT code. **Gated** on Hugging Face: each user must accept the terms with their own account. Check before redistributing. |
| pyannote/segmentation-3.0 | Speaker segmentation | MIT code. **Gated**, as above. Check before redistributing. |
| pyannote/wespeaker-voxceleb-resnet34-LM | Speaker embeddings | Check before redistributing; weights derive from WeSpeaker trained on VoxCeleb data, whose terms may restrict some uses. |

The repository names come from `engine/src/engine/models.py`. The licence and gating statements above
come from the upstream model cards as known to the authors and were **not** re-verified offline: read
each model card on huggingface.co before redistributing weights or using them commercially.
Users download pyannote models with their own free Hugging Face token; the token is never sent anywhere
except huggingface.co.

## Models downloaded on request (not shipped with the app)

| Model | Licence (per its Hugging Face card) | Source |
|---|---|---|
| Parakeet TDT 0.6B v3 (MLX conversion) | CC-BY-4.0: credit NVIDIA when you redistribute or publish results that depend on it | https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3, https://huggingface.co/mlx-community/parakeet-tdt-0.6b-v3 |
| Hy-MT2 1.8B (MLX 4-bit and GGUF) | Apache-2.0 | https://huggingface.co/tencent/Hy-MT2-1.8B-GGUF, https://huggingface.co/mlx-community/Hy-MT2-1.8B-4bit |
| Moonshine streaming models (one per language) | MIT (the legacy non-streaming non-English models are non-commercial and not offered) | https://github.com/moonshine-ai/moonshine/blob/main/LICENSE |

## Fonts bundled with the app

| Name | Version | Licence | Source |
|---|---|---|---|
| Inter (Regular, Medium, SemiBold, Bold) | 4.1 | SIL Open Font Licence 1.1 | https://github.com/rsms/inter |
| Vazirmatn (variable) | 33.003 | SIL Open Font Licence 1.1 | https://github.com/rastikerdar/vazirmatn |

Copyright (c) 2016-2018 The Inter Project Authors. Copyright 2015 The Vazirmatn Project Authors. Used unmodified. The full licence texts are shipped beside the font files in `app/src/assets/fonts/` (`OFL-Inter.txt`, `OFL-Vazirmatn.txt`). Vetting record: `docs/dependency-vetting.md`.
