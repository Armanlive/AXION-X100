"""Optional Episode 1 service. Importing this module does not access the network."""
from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile

DEFAULT_MODEL = "llama-3.3-70b-versatile"
DEFAULT_LANGUAGE = "en"
LANGUAGES = ("en", "hi")
VOICE_MAP = {
    "en": "en-IN-PrabhatNeural",
    "hi": "hi-IN-MadhurNeural",
}
# Project persona based on the requested description, not a third-party official prompt.
AXION_SYSTEM_PROMPT = (
    "You are AXION, an elite AI assistant. Be witty, concise, composed and helpful. "
    "Address the user as Sir naturally, without repeating it in every sentence. "
    "Respond to the actual question. Be honest about uncertainty and capabilities. "
    "You provide conversation only: never claim to have accessed the workspace, "
    "executed commands, controlled a computer or changed files. "
    "Prefer short, natural sentences suitable for speech."
)
GENERATION_TIMEOUT = 60
GENERATION_ATTEMPTS = 2


class AxionVoiceError(RuntimeError):
    """A safe, user-facing error; never includes provider payloads or credentials."""


# --- speech text preparation ------------------------------------------------

FENCED_CODE_RE = re.compile(r"```.*?(?:```|\Z)|~~~.*?(?:~~~|\Z)", re.DOTALL)
INLINE_CODE_RE = re.compile(r"`+")  # strip backticks; inline tokens stay speakable
TAG_RE = re.compile(r"</?[a-zA-Z][a-zA-Z0-9]*(?:\s[^<>]*)?/?>")
IMAGE_RE = re.compile(r"!\[[^\]]*\]\([^)]*\)")
URL_RE = re.compile(r"\b(?:https?://|www\.)\S+")
LINK_RE = re.compile(r"\[([^\]]+)\]\([^)]*\)")
EMPHASIS_RE = re.compile(r"\*\*?([^*\n]+)\*\*?|__?([^_\n]+)__?|~~([^~\n]+)~~")
LIST_MARK_RE = re.compile(r"^(?:\s*[-*+]\s+|\s*\d+[.)]\s+)", re.MULTILINE)
QUOTE_RE = re.compile(r"^\s*>\s?", re.MULTILINE)
HEADING_RE = re.compile(r"^#{1,6}\s*", re.MULTILINE)
TABLE_ROW_RE = re.compile(r"^\s*\|.*\|?\s*$", re.MULTILINE)


def clean_text_for_speech(text: str) -> str:
    """Strip code, markup, URLs and formatting so the voice reads plain prose.

    Fenced and inline code is dropped entirely (it is not speakable); ordinary
    sentences keep their meaning with decorations removed.
    """
    if not isinstance(text, str):
        return ""
    speech = FENCED_CODE_RE.sub(" ", text)
    speech = INLINE_CODE_RE.sub(" ", speech)
    speech = TAG_RE.sub(" ", speech)
    speech = IMAGE_RE.sub(" ", speech)
    speech = LINK_RE.sub(r"\1", speech)
    speech = URL_RE.sub(" ", speech)
    speech = TABLE_ROW_RE.sub(" ", speech)
    speech = EMPHASIS_RE.sub(lambda match: next(g for g in match.groups() if g), speech)
    speech = LIST_MARK_RE.sub(" ", speech)
    speech = QUOTE_RE.sub(" ", speech)
    speech = HEADING_RE.sub("", speech)
    sentences = []
    for line in speech.splitlines():
        line = re.sub(r"[ \t]{2,}", " ", line).strip()
        if line:
            sentences.append(line if line[-1] in "!?.,;:" else line + ".")
    return " ".join(sentences).strip()


def detect_language(text: str) -> str:
    """Return "hi" when Devanagari letters dominate, otherwise "en".

    Hinglish (Latin script with Hindi words) stays on the English voice, which
    is trained for Indian-accent English pronouncing such words.
    """
    if not isinstance(text, str):
        return DEFAULT_LANGUAGE
    letters = [char for char in text if char.isalpha()]
    if not letters:
        return DEFAULT_LANGUAGE
    devanagari = sum(1 for char in letters if "\u0900" <= char <= "\u097f")
    return "hi" if devanagari * 2 > len(letters) else "en"


def resume_language(value: str | None) -> str | None:
    """Validate a stored language setting; None, blank or "auto" means detect."""
    if value is None:
        return None
    text = str(value).strip().lower()
    if not text or text == "auto":
        return None
    if text not in LANGUAGES:
        raise AxionVoiceError("Language is invalid. Choose from " + ", ".join(LANGUAGES) + ".")
    return text


def resolve_voice(text: str | None = None, *, language: str | None = None,
                  voice: str | None = None) -> str:
    """Pick the Edge-TTS voice for this reply.

    Order: explicit voice argument, then AXION_VOICE, then a forced language
    (argument or AXION_LANGUAGE), then automatic detection.
    """
    if voice:
        return voice
    stored = os.environ.get("AXION_VOICE", "").strip()
    if stored:
        return stored
    forced = language if language is not None else resume_language(os.environ.get("AXION_LANGUAGE"))
    if forced:
        return VOICE_MAP[forced]
    return VOICE_MAP[detect_language(text) if text else DEFAULT_LANGUAGE]


# --- provider call -----------------------------------------------------------

def ask_brain(prompt: str, *, model: str | None = None) -> str:
    """Send only the supplied prompt and persona to Groq; return one text reply."""
    if not prompt.strip():
        raise AxionVoiceError("Please provide a non-empty prompt.")
    key = os.environ.get("GROQ_API_KEY", "").strip()
    if not key:
        raise AxionVoiceError("Set GROQ_API_KEY in the service environment first.")
    try:
        from groq import Groq
    except ImportError:
        raise AxionVoiceError("Install src-python/requirements.txt first.") from None
    try:
        with Groq(api_key=key, timeout=30.0, max_retries=1) as client:
            result = client.chat.completions.create(
                model=model or os.environ.get("GROQ_MODEL") or DEFAULT_MODEL,
                messages=[
                    {"role": "system", "content": AXION_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt.strip()},
                ],
                temperature=0.7,
                max_completion_tokens=512,
            )
            reply = result.choices[0].message.content
            if not isinstance(reply, str) or not reply.strip():
                raise AxionVoiceError("Groq returned an empty reply.")
            return reply.strip()
    except AxionVoiceError:
        raise
    except Exception:
        raise AxionVoiceError("Groq request failed. Check the key, model, network and quota.") from None


# --- audio generation and playback -------------------------------------------

def _render_audio(edge_tts, speech: str, voice: str, audio: Path) -> None:
    """Generate MP3 audio at the path, retrying once on connection trouble."""

    async def generate() -> None:
        communicator = edge_tts.Communicate(speech, voice)
        await asyncio.wait_for(communicator.save(str(audio)), timeout=GENERATION_TIMEOUT)

    last_error: Exception | None = None
    for attempt in range(1, GENERATION_ATTEMPTS + 1):
        try:
            asyncio.run(generate())
            if audio.is_file() and audio.stat().st_size > 0:
                return
            last_error = None
        except RuntimeError as error:
            audio.unlink(missing_ok=True)
            last_error = error
    raise AxionVoiceError(
        "Speech generation failed twice. Check network and voice."
        if last_error else "Speech service returned no audio."
    )


FALLBACK_VOICES = {
    "en": "en-US-AriaNeural",   # standard ensemble edge voice, widely available
    "hi": "hi-IN-SwaraNeural",
}


def _speak_with_fallback(edge_tts, speech: str, voice: str, audio: Path) -> str:
    """Try the selected voice, then a standard neural fallback per language.

    A mismatched/unavailable voice name becomes at worst a different neural
    voice — never a crash or error banner.
    """
    try:
        _render_audio(edge_tts, speech, voice, audio)
        return voice
    except AxionVoiceError:
        language = "hi" if voice.startswith("hi-") else "en"
        fallback = FALLBACK_VOICES[language]
        if fallback == voice:
            raise
        audio.unlink(missing_ok=True)
        _render_audio(edge_tts, speech, fallback, audio)
        return fallback


def _play_and_release(playsound, audio: Path) -> None:
    """Play the file to completion, then always release the player handle.

    Releasing before cleanup avoids Windows file locks on the temporary MP3;
    a broken audio device surfaces as a generic playback failure, not a crash.
    """
    try:
        sound = playsound(str(audio), block=False)
        try:
            sound.wait()
        finally:
            sound.stop()
    except (KeyboardInterrupt, SystemExit):
        raise
    except Exception:
        raise AxionVoiceError("Playback failed. Check the audio device and output permissions.") from None


def _clear_temp(directory: Path) -> None:
    """Remove the temporary directory without failing on a lingering handle."""
    shutil.rmtree(directory, ignore_errors=True)


def speak_reply(text: str, *, voice: str | None = None, language: str | None = None) -> None:
    """Speak the reply with a neural voice, then release and delete the MP3.

    Synchronous API. Markdown is stripped first; the voice is explicit when
    given, else AXION_LANGUAGE, else detected from the text. Ctrl+C during
    playback stops the player before deleting its file.
    """
    if not text.strip():
        raise AxionVoiceError("Cannot speak an empty reply.")
    try:
        import edge_tts
        from playsound3 import playsound
    except ImportError:
        raise AxionVoiceError("Install src-python/requirements.txt first.") from None
    speech = clean_text_for_speech(text)
    if not speech:
        raise AxionVoiceError("Nothing speakable remains after removing code and markup.")
    directory = Path(tempfile.mkdtemp(prefix="axion-voice-"))
    try:
        audio = directory / "reply.mp3"
        selected = resolve_voice(speech, language=language, voice=voice)
        _speak_with_fallback(edge_tts, speech, selected, audio)
        _play_and_release(playsound, audio)
    finally:
        _clear_temp(directory)


async def aspeak_reply(text: str, *, voice: str | None = None,
                       language: str | None = None) -> None:
    """Awaitable variant that keeps the event loop free during generation.

    Blocking speech synthesis and playback run on a worker thread, so an async
    backend can narrate replies without stalling timers, sockets or the UI.
    """
    await asyncio.to_thread(speak_reply, text, voice=voice, language=language)


def run_turn(prompt: str, *, model: str | None = None,
             voice: str | None = None, language: str | None = None,
             speak: bool = True) -> str:
    """Optional Python backend entry point; does not grant any native authority."""
    reply = ask_brain(prompt, model=model)
    if speak:
        speak_reply(reply, voice=voice, language=language)
    return reply


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="AXION Episode 1: optional Groq + online Edge-TTS")
    parser.add_argument("prompt", nargs="?", help="Question; omit to read a line from stdin")
    parser.add_argument("--model", help="Override GROQ_MODEL")
    parser.add_argument("--voice", help="Override AXION_VOICE and language selection")
    parser.add_argument("--language", choices=LANGUAGES, help="Force a reply language; unset means detect")
    parser.add_argument("--text-only", action="store_true", help="Skip audio generation and playback")
    parser.add_argument("--speak-only", action="store_true", help="Speak supplied text without calling Groq")
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(errors="replace")  # Hindi text on cp1252 consoles
    except Exception:
        pass
    args = parser.parse_args(argv)
    if args.text_only and args.speak_only:
        parser.error("--text-only and --speak-only cannot be combined")
    try:
        prompt = args.prompt if args.prompt is not None else input("You: ")
        reply = prompt if args.speak_only else ask_brain(prompt, model=args.model)
        print(reply, flush=True)
        if not args.text_only:
            speak_reply(reply, voice=args.voice, language=args.language)
        return 0
    except (KeyboardInterrupt, EOFError):
        print("Stopped.", file=sys.stderr)
        return 130
    except AxionVoiceError as error:
        print(f"AXION: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
