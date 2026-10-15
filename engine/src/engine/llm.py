"""A small language model that runs on this computer, for finding highlights and writing summaries.

Apple Silicon Macs use MLX (mlx-lm); every other computer uses llama.cpp (GGUF files). Nothing here touches the network:
the model files are downloaded once by `models download llm-<name>` and loaded from the models folder.
"""
import json
import platform
import re
import sys
from pathlib import Path

# The models people can choose, smallest first. Each one was tried on the sample interviews in docs/samples (English and German):
# a model is listed when it found sensible highlights and wrote a usable summary in both (Qwen2.5 7B, "best", was shipped before
# that test and has not been through it yet). SmolLM3 3B and Phi-4 mini were tried and left out: too few usable highlights. Every entry has an MLX build (Apple Silicon)
# and one GGUF file (everything else). "bytes" is the download size, shown before the user agrees to it. "thinks" marks models that
# reason in a <think> block before answering unless told not to. "retired" models are offered only to people who already have them,
# so they can keep using or delete them. "small" and "best" keep their old ids so existing downloads and choices still work.
# Text in "like" is English; the app translates it.
LLM_MODELS = {
    "small": {
        "label": "Qwen2.5 1.5B", "like": "The first small model. Weak in German: use a newer one",
        "languages": ["en", "de", "fr", "es"], "license": "Apache-2.0", "retired": True,
        "mlx": "mlx-community/Qwen2.5-1.5B-Instruct-4bit", "gguf": ("Qwen/Qwen2.5-1.5B-Instruct-GGUF", "qwen2.5-1.5b-instruct-q4_k_m.gguf"),
        "bytes": {"mlx": 868_628_559, "gguf": 1_117_320_736},
    },
    "qwen3-1.7b": {
        "label": "Qwen3 1.7B", "like": "Small and quick. Fine for short recordings and clear speech",
        "languages": ["en", "de", "fr", "es"], "license": "Apache-2.0", "thinks": True,
        "mlx": "mlx-community/Qwen3-1.7B-4bit", "gguf": ("unsloth/Qwen3-1.7B-GGUF", "Qwen3-1.7B-Q4_K_M.gguf"),
        "bytes": {"mlx": 984_015_687, "gguf": 1_107_409_472},
    },
    "qwen3-4b": {
        "label": "Qwen3 4B", "like": "Good balance of quality and speed",
        "languages": ["en", "de", "fr", "es"], "license": "Apache-2.0",
        "mlx": "mlx-community/Qwen3-4B-Instruct-2507-4bit", "gguf": ("unsloth/Qwen3-4B-Instruct-2507-GGUF", "Qwen3-4B-Instruct-2507-Q4_K_M.gguf"),
        "bytes": {"mlx": 2_278_972_236, "gguf": 2_497_281_120},
    },
    "gemma3-4b": {
        "label": "Gemma 3 4B", "like": "Mid-sized. Very good across languages",
        "languages": ["en", "de", "fr", "es"], "license": "Gemma",
        "mlx": "mlx-community/gemma-3-text-4b-it-4bit", "gguf": ("unsloth/gemma-3-4b-it-GGUF", "gemma-3-4b-it-Q4_K_M.gguf"),
        "bytes": {"mlx": 2_600_191_231, "gguf": 2_489_894_016},
    },
    "best": {
        "label": "Qwen2.5 7B", "like": "Large and slower. Finds better highlights and writes better summaries",
        "languages": ["en", "de", "fr", "es"], "license": "Apache-2.0",
        "mlx": "mlx-community/Qwen2.5-7B-Instruct-4bit", "gguf": ("bartowski/Qwen2.5-7B-Instruct-GGUF", "Qwen2.5-7B-Instruct-Q4_K_M.gguf"),
        "bytes": {"mlx": 4_284_346_255, "gguf": 4_683_074_240},
    },
}
DEFAULT_LLM = "qwen3-4b"
LANGUAGE_NAMES = {"en": "English", "de": "German", "fr": "French", "es": "Spanish"}


def backend() -> str | None:
    """"mlx" on Apple Silicon when mlx-lm is installed, "gguf" when llama.cpp is, otherwise None (the feature is unavailable).

    Looks the packages up without importing them: importing mlx-lm takes several seconds, and every models command calls this."""
    from importlib.util import find_spec

    if sys.platform == "darwin" and platform.machine() == "arm64" and find_spec("mlx_lm") is not None:
        return "mlx"
    return "gguf" if find_spec("llama_cpp") is not None else None


def repo_for(name: str, be: str | None = None) -> tuple[str, str | None]:
    """(Hugging Face repo, file name or None) of a model for this computer's backend."""
    be = be or backend() or "gguf"
    spec = LLM_MODELS[name]
    return (spec["mlx"], None) if be == "mlx" else spec["gguf"]


def patterns_for(name: str, be: str | None = None) -> list[str] | None:
    """Which files of the repo to download. A GGUF repo holds many sizes of the same model, and only one is needed."""
    _repo, fname = repo_for(name, be)
    return [fname] if fname else None


class LocalLLM:
    """One loaded model. `chat` returns the model's answer to a system + user message."""

    def __init__(self, name: str):
        from huggingface_hub import snapshot_download

        from .models import models_dir

        if name not in LLM_MODELS:
            raise RuntimeError(f"Unknown language model: {name}")
        self.backend = backend()
        if self.backend is None:
            raise RuntimeError("The local language model is not installed on this computer.")
        repo, fname = repo_for(name, self.backend)
        self.thinks = bool(LLM_MODELS[name].get("thinks"))
        try:
            path = Path(snapshot_download(repo, cache_dir=models_dir(), allow_patterns=[fname] if fname else None, local_files_only=True))
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError("The language model is not downloaded yet. Download it first.") from exc
        if self.backend == "mlx":
            from mlx_lm import load

            self._model, self._tok = load(str(path))
        else:
            from llama_cpp import Llama

            self._llama = Llama(model_path=str(path / fname), n_ctx=8192, n_gpu_layers=-1, verbose=False)

    def chat(self, system: str, user: str, max_tokens: int = 700, temperature: float = 0.2) -> str:
        if self.thinks:  # the soft switch Qwen3 and SmolLM3 understand; the MLX template is also told directly below
            system += " /no_think"
        messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
        if self.backend == "mlx":
            from mlx_lm import generate
            from mlx_lm.sample_utils import make_sampler

            prompt = self._tok.apply_chat_template(messages, add_generation_prompt=True, tokenize=False, enable_thinking=False)
            return strip_thinking(generate(self._model, self._tok, prompt=prompt, max_tokens=max_tokens, sampler=make_sampler(temp=temperature), verbose=False))
        out = self._llama.create_chat_completion(messages=messages, max_tokens=max_tokens, temperature=temperature)
        return strip_thinking(out["choices"][0]["message"]["content"] or "")


def strip_thinking(text: str) -> str:
    """The answer without a reasoning block (<think>…</think>), which some models write first even when asked not to.
    An unfinished block (the model ran out of tokens while thinking) leaves nothing."""
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S)
    return re.sub(r"<think>.*", "", text, flags=re.S).strip()


def extract_json(text: str):
    """The first JSON array or object in a model answer (models like to wrap it in prose or a code fence). None if there is none."""
    text = re.sub(r"```(?:json)?", "", text)
    decoder = json.JSONDecoder()
    for i, ch in enumerate(text):
        if ch in "[{":
            try:
                return decoder.raw_decode(text[i:])[0]
            except ValueError:
                continue
    return None


def chunk_lines(lines: list[str], budget: int = 6000, overlap: int = 2) -> list[tuple[int, list[str]]]:
    """Groups consecutive lines into chunks of about `budget` characters, repeating the last `overlap` lines at the start of the next
    chunk so a thought that straddles the boundary is seen whole. Returns (index of the first line, lines) per chunk."""
    out: list[tuple[int, list[str]]] = []
    i = 0
    while i < len(lines):
        j, size = i, 0
        while j < len(lines) and (size + len(lines[j]) <= budget or j == i):
            size += len(lines[j]) + 1
            j += 1
        out.append((i, lines[i:j]))
        if j >= len(lines):
            break
        i = max(j - overlap, i + 1)
    return out
