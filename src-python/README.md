# AXION Episode 1 — optional AXION voice-brain

Standalone Python 3.10+ foundation. This does not replace the existing AXION voice UI, add microphone capture, or install a Tauri sidecar/IPC command. The Python API and terminal entry point are ready for explicit invocation. No workspace files are read or sent automatically.

## Setup (PowerShell, from repository root)

```powershell
py -3 -m venv src-python/.venv
./src-python/.venv/Scripts/python.exe -m pip install -r src-python/requirements.txt
```

Provide `GROQ_API_KEY` to this process through your secret manager or session environment. Do not put a key into source code, frontend `VITE_*` variables, or commit it. The helper does not load `.env` files or log keys. Optional variables: `GROQ_MODEL` (default `llama-3.3-70b-versatile`), `AXION_LANGUAGE` (`en`, `hi`, or `auto` — default detect per reply), and `AXION_VOICE` (pin one Edge-TTS voice, overriding everything except `--voice`). Model/voice availability depends on the providers.

## Multilingual voices (English + Hindi/Hinglish)

Each reply is spoken with the neural voice matching its language:

| Language | Voice |
|----------|-------|
| English  | `en-IN-PrabhatNeural` |
| Hindi    | `hi-IN-MadhurNeural` |

Selection order per reply: explicit `--voice` → `--language`/`AXION_LANGUAGE` → automatic detection (Hindi Devanagari replies use the Hindi voice; Latin-script Hinglish stays on the Indian-English voice). Before synthesis, replies are cleaned for speech: fenced/inline code fences and URLs are dropped, markdown headings, emphasis, links, lists, quotes and tables are unwrapped, so the voice reads plain natural sentences.

```powershell
./src-python/.venv/Scripts/python.exe src-python/axion_voice_core.py "Hello AXION"
./src-python/.venv/Scripts/python.exe src-python/axion_voice_core.py "नमस्ते AXION" --language hi
./src-python/.venv/Scripts/python.exe src-python/axion_voice_core.py "Explain recursion briefly" --text-only
./src-python/.venv/Scripts/python.exe src-python/axion_voice_core.py --speak-only "At your service, Sir."
```

Omit the prompt to enter it through stdin instead of shell history. `--voice`, `--language` and `--model` override environment defaults. Successful calls exit 0; failures exit 1; interruption exits 130. Provider errors are sanitized. Text prints before speech so a playback failure does not hide the answer.

## Optional backend use

From Python with `src-python` on its module search path:

```python
from axion_voice_core import run_turn, aspeak_reply
reply = run_turn("Hello AXION", speak=True)          # blocking, sync call
reply = run_turn("नमस्ते", speak=False)                # text only, voice picked per reply
await aspeak_reply(reply)                             # async: loop stays free during TTS/playback
```

This API blocks until playback finishes; `aspeak_reply` runs synthesis and playback on a worker thread so the event loop stays responsive. Thread cancellation does not interrupt playback; dedicated process lifecycle/IPC integration remains future work. When spawning the CLI, pass an argument list with `shell=False`, use stdin for the prompt, and inherit credentials through the service environment. Never interpolate prompts into shell commands. No native policy changes are included.

## Data and audio lifecycle

Groq receives the supplied prompt and persona. Edge-TTS sends reply text to Microsoft's online speech service; it is not an installed/offline device voice. Existing device-only AXION mode remains unchanged. Provider usage terms, connectivity and Groq account quota apply. No payment or service account is configured by this module.

Each call uses a unique temporary directory containing `reply.mp3`. Generation retries once on connection trouble, then playback waits for completion, stops/releases its player before cleanup (avoiding Windows file locks), and the directory is removed with a best-effort sweep, covering ordinary failure and Ctrl+C paths. Audio-device failures surface as a sanitized playback error rather than a crash. Abrupt process termination or power loss can leave an OS temporary file. There is no background listening or automatic startup.

The persona implements the requested AXION engineering assistant description.

## Verification

```powershell
py -3 -m unittest discover -s src-python/tests -v
```

Tests use fake provider/audio modules: they verify environment binding, response handling, cleanup and failure behavior without spending quota or playing sound. Live Groq, Edge-TTS and speaker output require a separate real run.

API references: [Groq chat](https://console.groq.com/docs/text-chat), [Edge-TTS](https://github.com/rany2/edge-tts), [playsound3](https://pypi.org/project/playsound3/).
