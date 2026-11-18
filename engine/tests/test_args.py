"""Free-text option values that start with "-" must parse (the app passes them as --opt=value)."""
from engine import main as m


def test_prompt_starting_with_dash_parses_in_equals_form():
    a = m.build_parser().parse_args(["transcribe", "x.wav", "--prompt=-Kubernetes, Anna"])
    assert a.prompt == "-Kubernetes, Anna"


def test_transcribe_model_must_be_a_known_speech_model():
    import pytest
    for ok in ("small", "large-v3-turbo", "parakeet-v3", "moonshine-en"):
        assert m.build_parser().parse_args(["transcribe", "x.wav", "--model", ok]).model == ok
    for bad in ("x; rm", "../../etc", "gpt", ""):
        with pytest.raises(SystemExit):
            m.build_parser().parse_args(["transcribe", "x.wav", "--model", bad])
