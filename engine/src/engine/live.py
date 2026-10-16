"""Live transcription of a stream of audio (the microphone), with a model that only knows whole recordings.

The recent audio is transcribed again every couple of seconds. A word is "confirmed" once two runs in a row agree on it
(the idea behind whisper-streaming's local agreement); the words after the last confirmed one are "tentative" and may still
change. Once more than `max_buffer` seconds are waiting, the audio up to the last confirmed word is dropped, so each run stays short.
"""
import re
import sys

SAMPLE_RATE = 16000


def _norm(word: str) -> str:
    return re.sub(r"[^\w]+", "", word.lower())


class LiveTranscriber:
    """`transcribe(audio, language)` returns word dicts {start, end, word, prob} with times relative to `audio`."""

    def __init__(self, transcribe, language: str | None = None, max_buffer: float = 25.0, sr: int = SAMPLE_RATE):
        import numpy as np

        self._np, self.sr, self.transcribe, self.language, self.max_buffer = np, sr, transcribe, language, max_buffer
        self.audio = np.zeros(0, dtype=np.float32)
        self.base = 0.0           # recording time of audio[0]
        self.confirmed_end = 0.0  # recording time up to which words are final
        self.previous: list[dict] = []
        self.pending = 0          # samples fed since the last step

    @property
    def seconds(self) -> float:
        return self.base + len(self.audio) / self.sr

    def feed(self, samples) -> None:
        self.audio = self._np.concatenate([self.audio, samples.astype(self._np.float32)])
        self.pending += len(samples)

    def step(self, final: bool = False) -> tuple[list[dict], list[dict]]:
        """Transcribe what is waiting. Returns (newly confirmed words, tentative words), times in recording time."""
        self.pending = 0
        if len(self.audio) < self.sr // 2:
            return [], []
        words = [{**w, "start": w["start"] + self.base, "end": w["end"] + self.base} for w in self.transcribe(self.audio, self.language)]
        words = [w for w in words if w["start"] >= self.confirmed_end - 0.05]  # what is already final stays final
        if final:
            agreed = len(words)
        else:
            agreed = 0
            for old, new in zip(self.previous, words):
                if _norm(old["word"]) != _norm(new["word"]):
                    break
                agreed += 1
        confirmed, tentative = words[:agreed], words[agreed:]
        self.previous = tentative
        if confirmed:
            self.confirmed_end = confirmed[-1]["end"]
        if len(self.audio) / self.sr > self.max_buffer and self.confirmed_end > self.base:
            cut = int((self.confirmed_end - self.base) * self.sr)
            self.audio, self.base = self.audio[cut:], self.confirmed_end
        return confirmed, tentative


def run(model, sr_in: int, language: str | None, step_seconds: float, stream, emit_live, on_first_audio=None) -> None:
    """Read raw 16 kHz mono int16 little-endian audio from `stream` until it ends, calling `emit_live(confirmed, tentative, seconds)` after each step."""
    import numpy as np

    def transcribe(audio, lang):
        segments, _info = model.transcribe(audio, language=lang, word_timestamps=True, vad_filter=False, condition_on_previous_text=False)
        return [{"start": w.start, "end": w.end, "word": w.word, "prob": round(w.probability, 3)} for s in segments for w in s.words or []]

    live = LiveTranscriber(transcribe, language)
    size = int(step_seconds * sr_in)
    first = True
    while True:
        data = stream.read(size * 2)  # int16: two bytes a sample; blocks until a step's worth of audio arrives or the stream ends
        if data:
            usable = len(data) // 2 * 2
            live.feed(np.frombuffer(data[:usable], dtype="<i2").astype(np.float32) / 32768.0)
        if first and on_first_audio and live.seconds >= 5.0:
            on_first_audio(model, live.audio)
            first = False
        if not data:
            emit_live(*live.step(final=True), live.seconds)
            return
        if live.pending >= size // 2:
            emit_live(*live.step(), live.seconds)


if __name__ == "__main__":  # pragma: no cover
    sys.exit("run through `python -m engine live`")
