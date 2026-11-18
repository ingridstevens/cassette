"""Free-text option values that start with "-" must parse (the app passes them as --opt=value)."""
from engine import main as m


def test_prompt_starting_with_dash_parses_in_equals_form():
    a = m.build_parser().parse_args(["transcribe", "x.wav", "--prompt=-Kubernetes, Anna"])
    assert a.prompt == "-Kubernetes, Anna"
