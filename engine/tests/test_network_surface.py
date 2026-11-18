"""The app promises that the only network use is model downloads and the Hugging Face token check (Settings, Privacy lists each call).
This test makes that promise fail loudly: if code that can reach the network appears in a new place, or a new web address is written
into the app, the test fails until a person has looked at it, updated the allow-list below, and updated the Privacy page and docs.
It reads the source with plain text search; it cannot catch code that builds an address at run time, so it is a tripwire, not an audit."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ENGINE = ROOT / "engine" / "src" / "engine"
APP = ROOT / "app"

# Python files that may use the network, and why. Anything else mentioning these names fails the test.
ENGINE_NETWORK_FILES = {
    "models.py": "downloads models and checks the Hugging Face token (snapshot_download, HfApi)",
    "asr_moonshine.py": "Moonshine models come from download.moonshine.ai",
    "asr.py": "snapshot_download(..., local_files_only=True): reads the local cache only",
    "llm.py": "snapshot_download(..., local_files_only=True): reads the local cache only",
}
NETWORK_NAMES = re.compile(r"\b(snapshot_download|hf_hub_download|HfApi|requests\.|urllib|httpx|aiohttp|socket\.|http\.client|urlopen|download_model)\b")
# Hosts that may appear as a web address in the app's own source (not in translations or licence texts)
ALLOWED_HOSTS = {"huggingface.co", "download.moonshine.ai", "github.com", "www.w3.org"}  # w3.org is only the SVG/XML namespace string
BROWSER_CALLS = re.compile(r"\b(fetch\(|XMLHttpRequest|WebSocket\(|net\.request|net\.fetch|https\.get|http\.get|navigator\.sendBeacon|EventSource\()")


def _files(base: Path, suffixes: tuple[str, ...]):
    for p in base.rglob("*"):
        if p.is_file() and p.suffix in suffixes and "node_modules" not in p.parts and "dist" not in p.parts and "dist-electron" not in p.parts and "i18n" not in p.parts:
            yield p


def test_engine_network_code_is_only_where_the_privacy_page_says():
    offenders = []
    for p in _files(ENGINE, (".py",)):
        if NETWORK_NAMES.search(p.read_text(encoding="utf-8")) and p.name not in ENGINE_NETWORK_FILES:
            offenders.append(p.name)
    assert not offenders, f"New network-capable code in {offenders}. Check it, then update ENGINE_NETWORK_FILES, Settings > Privacy and docs/privacy-and-offline.md."


def test_local_only_files_never_download():
    for name in ("asr.py", "llm.py"):
        text = (ENGINE / name).read_text(encoding="utf-8")
        calls = [ln for ln in text.splitlines() if "snapshot_download(" in ln and "import" not in ln]  # one call per line in these files
        assert calls, name
        assert all("local_files_only=True" in c for c in calls), f"{name} has a snapshot_download that can reach the network"


def test_app_source_writes_only_known_web_addresses():
    found = {}
    for p in _files(APP, (".ts", ".tsx", ".css", ".html", ".mjs", ".js")):
        if "scripts" in p.parts or "assets" in p.parts or p.name == "dev-mock.ts":
            continue
        for host in re.findall(r"https?://([A-Za-z0-9.-]+)", p.read_text(encoding="utf-8")):
            found.setdefault(host, set()).add(p.name)
    unknown = {h: sorted(f) for h, f in found.items() if h not in ALLOWED_HOSTS}
    assert not unknown, f"New web address in the app: {unknown}. Check it, then update ALLOWED_HOSTS, Settings > Privacy and docs/privacy-and-offline.md."


def test_app_does_not_make_its_own_requests():
    offenders = []
    for p in _files(APP, (".ts", ".tsx")):
        if "scripts" in p.parts or p.name == "dev-mock.ts":
            continue
        if BROWSER_CALLS.search(p.read_text(encoding="utf-8")):
            offenders.append(p.name)
    assert not offenders, f"The app now makes network requests itself in {offenders}. That needs a Privacy page row and docs."


def test_only_huggingface_pages_can_be_opened_from_the_app():
    main = (APP / "electron" / "main.ts").read_text(encoding="utf-8")
    assert 'startsWith("https://huggingface.co/")' in main


def test_only_the_new_issue_page_on_github_can_be_opened_from_the_app():
    main = (APP / "electron" / "main.ts").read_text(encoding="utf-8")
    assert 'feedback = "https://github.com/ingridstevens/cassette/issues/new"' in main
    assert main.count("github.com") == 1


def test_readme_and_security_name_every_host_the_app_uses():
    network_hosts = ALLOWED_HOSTS - {"www.w3.org"}  # the XML namespace string is not a network host
    for doc in ("README.md", "SECURITY.md", "docs/privacy-and-offline.md"):
        text = (ROOT / doc).read_text(encoding="utf-8")
        missing = sorted(h for h in network_hosts if h not in text)
        assert not missing, f"{doc} does not name {missing}. Update it to match ALLOWED_HOSTS."
