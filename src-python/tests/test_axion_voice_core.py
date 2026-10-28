import asyncio
import os
from pathlib import Path
import sys
import time
import types
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import axion_voice_core as core


class AxionVoiceTests(unittest.TestCase):
    def test_missing_key_fails_before_provider_import(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(core.AxionVoiceError, "GROQ_API_KEY"):
                core.ask_brain("Hello")

    def test_environment_key_and_model_used_without_workspace_context(self):
        client = MagicMock()
        client.chat.completions.create.return_value = types.SimpleNamespace(
            choices=[types.SimpleNamespace(message=types.SimpleNamespace(content="At your service, Sir."))])
        factory = MagicMock()
        factory.return_value.__enter__.return_value = client
        with patch.dict(sys.modules, {"groq": types.SimpleNamespace(Groq=factory)}), patch.dict(
            os.environ, {"GROQ_API_KEY": "fixture-secret", "GROQ_MODEL": "fixture-model"}):
            self.assertEqual(core.ask_brain("Hello"), "At your service, Sir.")
        self.assertEqual(factory.call_args.kwargs["api_key"], "fixture-secret")
        args = client.chat.completions.create.call_args.kwargs
        self.assertEqual(args["model"], "fixture-model")
        self.assertEqual(args["messages"][1], {"role": "user", "content": "Hello"})
        self.assertEqual(len(args["messages"]), 2)
        client_context = factory.return_value
        client_context.__exit__.assert_called_once()

    def test_provider_error_never_exposes_secret(self):
        factory = MagicMock(side_effect=RuntimeError("fixture-secret"))
        with patch.dict(sys.modules, {"groq": types.SimpleNamespace(Groq=factory)}), patch.dict(os.environ, {"GROQ_API_KEY": "fixture-secret"}):
            with self.assertRaises(core.AxionVoiceError) as caught:
                core.ask_brain("Hello")
        self.assertNotIn("fixture-secret", str(caught.exception))

    def test_audio_cleanup_success_failure_and_interrupt(self):
        for failure in [None, RuntimeError("player failure"), KeyboardInterrupt()]:
            with self.subTest(failure=type(failure).__name__):
                paths = []
                class Communicate:
                    def __init__(self, text, voice):
                        self.voice = voice
                    async def save(self, filename):
                        paths.append(Path(filename))
                        Path(filename).write_bytes(b"fixture audio")
                player = MagicMock()
                player.wait.side_effect = failure
                def play(filename, block):
                    self.assertTrue(Path(filename).is_file())
                    self.assertFalse(block)
                    return player
                with patch.dict(sys.modules, {"edge_tts": types.SimpleNamespace(Communicate=Communicate), "playsound3": types.SimpleNamespace(playsound=play)}):
                    if failure is None:
                        core.speak_reply("Hello Sir")
                    else:
                        with self.assertRaises(KeyboardInterrupt if isinstance(failure, KeyboardInterrupt) else core.AxionVoiceError):
                            core.speak_reply("Hello Sir")
                player.stop.assert_called_once()
                self.assertEqual(paths[0].name, "reply.mp3")
                self.assertFalse(paths[0].parent.exists())

    def test_partial_audio_removed_on_generation_failure(self):
        paths = []
        class Communicate:
            def __init__(self, *args): pass
            async def save(self, filename):
                paths.append(Path(filename))
                Path(filename).write_bytes(b"partial")
                raise RuntimeError("connection failed")
        player = MagicMock()
        with patch.dict(sys.modules, {"edge_tts": types.SimpleNamespace(Communicate=Communicate), "playsound3": types.SimpleNamespace(playsound=player)}):
            with self.assertRaises(core.AxionVoiceError): core.speak_reply("Hello")
        player.assert_not_called()
        self.assertFalse(paths[0].parent.exists())

    def test_text_only_and_speak_only_cli_paths(self):
        with patch.object(core, "ask_brain", return_value="Hello Sir") as brain, patch.object(core, "speak_reply") as speak:
            self.assertEqual(core.main(["Hello", "--text-only"]), 0)
            speak.assert_not_called()
            brain.reset_mock()
            self.assertEqual(core.main(["Hello", "--speak-only"]), 0)
            brain.assert_not_called()
            speak.assert_called_once_with("Hello", voice=None, language=None)

    def test_empty_prompt_rejected(self):
        with self.assertRaises(core.AxionVoiceError): core.ask_brain("  ")
        with self.assertRaises(core.AxionVoiceError): core.speak_reply("  ")

    def test_voice_fallback_uses_standard_neural_voice_when_selected_fails(self):
        attempts = []
        paths = []
        class Communicate:
            def __init__(self, text, voice):
                attempts.append(voice)
            async def save(self, filename):
                paths.append(Path(filename))
                if attempts[-1] == 'hi-IN-MadhurNeural':
                    raise RuntimeError("voice not available")
                Path(filename).write_bytes(b"fallback audio")
        player = MagicMock()
        with patch.dict(sys.modules, {"edge_tts": types.SimpleNamespace(Communicate=Communicate), "playsound3": types.SimpleNamespace(playsound=player)}):
            with patch.dict(os.environ, {"AXION_LANGUAGE": "hi"}):
                core.speak_reply("नमस्ते Sir")
        # 2 retries on the selected voice, then 1 attempt with the fallback voice
        self.assertEqual(attempts, ['hi-IN-MadhurNeural', 'hi-IN-MadhurNeural', 'hi-IN-SwaraNeural'])
        player.assert_called_once()
        self.assertFalse(paths[-1].parent.exists())


class SpeechPreparationTests(unittest.TestCase):
    def test_markdown_code_and_urls_stripped_for_natural_speech(self):
        raw = (
            "## Summary\n"
            "- Uses **edge-tts** for speech\n"
            "- Docs at https://example.com/doc\n"
            "```python\n"
            "print('do not read this aloud')\n"
            "```\n"
            "Run `pip install x` first. Visit [our guide](https://example.com).\n"
        )
        speech = core.clean_text_for_speech(raw)
        self.assertNotIn("#", speech)
        self.assertNotIn("*", speech)
        self.assertNotIn("`", speech)
        self.assertNotIn("http", speech)
        self.assertNotIn("do not read this aloud", speech)
        self.assertIn("Uses edge-tts for speech.", speech)
        self.assertIn("Run pip install x first.", speech)
        self.assertIn("Visit our guide.", speech)

    def test_plain_text_survives_with_terminal_punctuation(self):
        self.assertEqual(core.clean_text_for_speech("Hello Sir"), "Hello Sir.")
        self.assertEqual(core.clean_text_for_speech("Done."), "Done.")
        self.assertEqual(core.clean_text_for_speech(""), "")

    def test_language_detection_and_hinglish_defaults_to_english(self):
        self.assertEqual(core.detect_language("नमस्ते Sir, कैसे हैं आप"), "hi")
        self.assertEqual(core.detect_language("Kya haal hai Sir?"), "en")
        self.assertEqual(core.detect_language("At your service."), "en")
        self.assertEqual(core.detect_language(""), "en")

    def test_voice_resolution_levels(self):
        self.assertEqual(core.resolve_voice("नमस्ते"), "hi-IN-MadhurNeural")
        self.assertEqual(core.resolve_voice("Hello Sir"), "en-IN-PrabhatNeural")
        self.assertEqual(core.resolve_voice(language="hi"), "hi-IN-MadhurNeural")
        self.assertEqual(core.resolve_voice(voice="custom-voice"), "custom-voice")
        with patch.dict(os.environ, {"AXION_LANGUAGE": "hi"}):
            self.assertEqual(core.resolve_voice("Hello"), "hi-IN-MadhurNeural")
        with patch.dict(os.environ, {"AXION_LANGUAGE": "auto"}):
            self.assertEqual(core.resolve_voice("नमस्ते"), "hi-IN-MadhurNeural")
        with self.assertRaisesRegex(core.AxionVoiceError, "Language is invalid"):
            core.resume_language("fr")
        with patch.dict(os.environ, {"AXION_VOICE": "en-IN-NeerjaNeural"}):
            self.assertEqual(core.resolve_voice("नमस्ते"), "en-IN-NeerjaNeural")
        self.assertEqual(core.resolve_voice(voice="cli-voice", language="hi"), "cli-voice")


class AsyncSpeechTests(unittest.TestCase):
    def test_generation_retries_then_sanitized_failure(self):
        paths = []
        attempts = []
        class Communicate:
            def __init__(self, *args): pass
            async def save(self, filename):
                paths.append(Path(filename))
                attempts.append(1)
                if len(attempts) == 1:
                    raise RuntimeError("network dropped")
                Path(filename).write_bytes(b"good audio")
        player = MagicMock()
        with patch.dict(sys.modules, {"edge_tts": types.SimpleNamespace(Communicate=Communicate), "playsound3": types.SimpleNamespace(playsound=player)}):
            core.speak_reply("Hello Sir")
        self.assertEqual(len(attempts), 2)
        player.assert_called_once()
        self.assertFalse(paths[0].parent.exists())

    def test_async_speak_keeps_loop_alive_and_cleans_up(self):
        paths = []
        class Communicate:
            def __init__(self, *args): pass
            async def save(self, filename):
                paths.append(Path(filename))
                Path(filename).write_bytes(b"fixture audio")
        ticks = []
        player = MagicMock()
        def blocking_wait():
            for _ in range(3):
                ticks.append(1)
                time.sleep(0.01)
        player.wait.side_effect = blocking_wait
        with patch.dict(sys.modules, {"edge_tts": types.SimpleNamespace(Communicate=Communicate), "playsound3": types.SimpleNamespace(playsound=lambda *a, **k: player)}):
            async def runner():
                task = asyncio.create_task(core.aspeak_reply("Hello Sir"))
                while not task.done():
                    ticks.append(0)
                    await asyncio.sleep(0.005)
                await task
            asyncio.run(runner())
        player.stop.assert_called_once()
        self.assertFalse(paths[0].parent.exists())
        self.assertIn(0, ticks)  # event loop stayed responsive during playback


class CliLanguageTests(unittest.TestCase):
    def test_language_flag_passed_to_speak(self):
        with patch.object(core, "ask_brain", return_value="नमस्ते Sir") as brain, patch.object(core, "speak_reply") as speak:
            self.assertEqual(core.main(["Hello", "--language", "hi", "--text-only"]), 0)
            speak.assert_not_called()
        with patch.object(core, "ask_brain", return_value="नमस्ते Sir"), patch.object(core, "speak_reply") as speak:
            self.assertEqual(core.main(["Hello", "--language", "hi"]), 0)
            speak.assert_called_once_with("नमस्ते Sir", voice=None, language="hi")


if __name__ == "__main__":
    unittest.main()
