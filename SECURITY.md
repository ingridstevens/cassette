# Security policy

## Reporting a vulnerability

Please do not open a public issue for security problems. Open a **private security advisory** on this
repository (GitHub: Security tab, "Report a vulnerability").
Include steps to reproduce, the affected version and your OS. We will acknowledge reports as soon as we can.

## Supported versions

Only the latest release (and the current main branch) receives security fixes.

## Privacy and security model

- No account, no sign-in, no analytics, no telemetry, no auto-update check.
- Audio and transcripts never leave your computer. Transcription and speaker detection run locally.
- The only network hosts are `huggingface.co`, and `download.moonshine.ai` for Moonshine models: models are
  downloaded from them, and your token is checked against Hugging Face when you download the speaker models. During transcription the engine runs with
  `HF_HUB_OFFLINE=1`.
- Your Hugging Face token is encrypted with Electron `safeStorage` (OS keychain-backed) and stored as
  `hf-token.bin` in the app's user-data folder. It is only passed to the engine when downloading speaker models.
  Exception: on Linux without a keyring (GNOME Keyring or KWallet), `safeStorage` falls back to its
  `basic_text` backend, which is effectively plain text. Settings shows a warning in that case; install and
  unlock a keyring, or paste the token each time instead of saving it.
- Projects, transcripts and models are stored unencrypted in the user-data folder; protect it with disk encryption.
- The Electron window is hardened: context isolation, renderer sandbox, no Node integration, navigation
  and new windows blocked, all web permission requests denied, and a strict Content-Security-Policy in
  production builds. Only `https://huggingface.co/` links can be opened in your default browser.
- Model repositories are pulled via `huggingface_hub`; some pyannote checkpoints are loaded with
  `TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD=1` because they predate safe loading. Only official repositories are used.
