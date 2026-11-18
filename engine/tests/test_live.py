"""Live transcription: words are confirmed when two runs agree, and old audio is dropped."""
import io

import numpy as np

from engine.live import LiveTranscriber, run


def fake(script):
    """A 'model' that, on its n-th call, returns script[n] (word lists with times relative to the audio it was given)."""
    calls = []

    def transcribe(audio, language):
        calls.append(len(audio))
        return script[min(len(calls) - 1, len(script) - 1)]

    transcribe.calls = calls
    return transcribe


def w(start, end, word):
    return {"start": start, "end": end, "word": word, "prob": 0.9}


def secs(n):
    return np.full(int(16000 * n), 0.05, dtype=np.float32)  # not silence: silence is skipped


def silence(n):
    return np.zeros(int(16000 * n), dtype=np.float32)


def test_a_word_is_confirmed_only_when_two_runs_agree():
    t = LiveTranscriber(fake([[w(0, 0.5, " Hello"), w(0.5, 1, " wor")], [w(0, 0.5, " Hello,"), w(0.5, 1, " world"), w(1, 1.5, " again")], [w(0, 0.5, " Hello"), w(0.5, 1, " world"), w(1, 1.5, " again")]]))
    t.feed(secs(2))
    assert t.step() == ([], [w(0, 0.5, " Hello"), w(0.5, 1, " wor")])      # first run: nothing to compare with
    t.feed(secs(2))
    confirmed, tentative = t.step()
    assert [x["word"] for x in confirmed] == [" Hello,"] and [x["word"] for x in tentative] == [" world", " again"]  # punctuation does not break agreement
    t.feed(secs(2))
    confirmed, tentative = t.step()
    assert [x["word"] for x in confirmed] == [" world", " again"] and tentative == []


def test_the_end_flushes_everything_and_confirmed_words_never_come_back():
    t = LiveTranscriber(fake([[w(0, 1, " one")], [w(0, 1, " one"), w(1, 2, " two")]]))
    t.feed(secs(2))
    t.step()
    t.feed(secs(1))
    confirmed, _ = t.step(final=True)
    assert [x["word"] for x in confirmed] == [" one", " two"]


def test_old_audio_is_dropped_after_it_is_confirmed():
    words = [w(0, 10, " long"), w(10, 20, " talk"), w(20, 30, " here")]
    t = LiveTranscriber(fake([words, words]), max_buffer=25)
    t.feed(secs(30))
    t.step()
    t.feed(secs(1))
    t.step()
    assert t.base > 0 and len(t.audio) < 16000 * 30


def test_run_reads_a_stream_and_ends_with_a_final_step():
    pcm = (np.full(16000 * 6, 1500, dtype="<i2")).tobytes()
    seen = []

    class Model:
        def transcribe(self, audio, **k):
            import types
            word = types.SimpleNamespace(start=0.0, end=1.0, word=" hi", probability=0.9)
            return [types.SimpleNamespace(words=[word])], None

    run(Model(), 16000, "en", 2.0, io.BytesIO(pcm), lambda c, t, s: seen.append((c, t, s)))
    assert seen[-1][2] == 6.0 and any(c for c, _t, _s in seen)  # the last step flushes, so "hi" is confirmed


def test_silence_is_not_transcribed_and_is_not_kept():
    t = LiveTranscriber(fake([[w(0, 1, " Copyright")]]))
    t.feed(silence(5))
    assert t.step() == ([], []) and t.transcribe.calls == [] and len(t.audio) == 0 and t.base == 5.0
    t.feed(0.1 * np.random.default_rng(1).normal(size=16000 * 2).astype(np.float32))
    t.step()
    assert t.transcribe.calls  # sound is transcribed again
