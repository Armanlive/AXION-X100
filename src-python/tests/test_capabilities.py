import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
import wave
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from browser import Audit, PolicyError, public_url, safe_target, BrowserTools
from livekit_bridge import wav_bytes, RATE, scoped_token


class CapabilityTests(unittest.TestCase):
    def test_url_policy(self):
        for url in ["http://example.com", "file:///a", "https://127.0.0.1", "https://10.1.2.3", "https://user:pass@example.com", "https://example.com:444", "https://evil.example.com"]:
            with self.assertRaises((PolicyError, ValueError)):
                public_url(url, {"example.com", "127.0.0.1", "10.1.2.3"}, resolve=False)
        self.assertEqual(public_url("https://example.com/a", {"example.com"}, resolve=False), "https://example.com/a")

    def test_dns_private_denied(self):
        with patch("browser.socket.getaddrinfo", return_value=[(0,0,0,"",("192.168.1.2",443))]):
            with self.assertRaises(PolicyError): public_url("https://example.com", {"example.com"})

    def test_audit_chain_tampering_and_redaction(self):
        with tempfile.TemporaryDirectory() as folder:
            with Audit(Path(folder), b"k"*32) as audit:
                audit.append("navigate", "https://example.com/private?token=SECRET#private", "approved")
                text = audit.path.read_text()
                self.assertNotIn("SECRET", text)
                self.assertNotIn("/private", text)
                audit.append("navigate", "https://example.com", "completed")
                audit.path.write_text(audit.path.read_text().replace('"completed"', '"forged"'))
                with self.assertRaises(PolicyError): audit.append("navigate", "https://example.com", "next")

    def test_audit_key_and_single_session(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(PolicyError): Audit(Path(folder), b"short")
            with Audit(Path(folder), b"k"*32):
                with self.assertRaises(FileExistsError):
                    with Audit(Path(folder), b"k"*32): pass

    def test_rejection_never_executes(self):
        class Log:
            def append(self,*args): self.result=args[-1]
        tools = object.__new__(BrowserTools)
        tools.domains={"example.com"};tools.approve=lambda *_:False;tools.audit=Log()
        with patch("browser.public_url", side_effect=lambda url,*_:url):
            result=tools._action("navigate", "https://example.com", lambda:self.fail("Executed without approval"))
        self.assertEqual(result,"Rejected.")
        self.assertEqual(tools.audit.result,"rejected")

    def test_failed_audit_prevents_action(self):
        class BrokenLog:
            def append(self,*_): raise PolicyError("corrupted")
        tools=object.__new__(BrowserTools);tools.domains={"example.com"};tools.approve=lambda *_:True;tools.audit=BrokenLog()
        with patch("browser.public_url",side_effect=lambda url,*_:url), self.assertRaises(PolicyError):
            tools._action("navigate","https://example.com",lambda:self.fail("Executed with broken audit"))

    def test_wav_encodes_real_pcm(self):
        pcm=b"\x01\x00"*1600
        with wave.open(io.BytesIO(wav_bytes(pcm)),"rb") as audio:
            self.assertEqual(audio.getframerate(),RATE);self.assertEqual(audio.getnchannels(),1)
            self.assertEqual(audio.readframes(1600),pcm)

    def test_scoped_token_grants(self):
        import jwt
        with patch.dict(os.environ, {"LIVEKIT_API_KEY":"test-key", "LIVEKIT_API_SECRET":"x"*32}):
            token=scoped_token("test-room","test-user")
            claims=jwt.decode(token,"x"*32,algorithms=["HS256"])
            self.assertEqual(claims["video"]["room"],"test-room")
            self.assertEqual(claims["video"]["canPublishSources"],["microphone"])
            self.assertFalse(claims["video"]["canSubscribe"])
            worker=jwt.decode(scoped_token("test-room","worker",True),"x"*32,algorithms=["HS256"])
            self.assertFalse(worker["video"]["canPublish"])
            with self.assertRaises(ValueError): scoped_token("../room","user")

if __name__ == "__main__": unittest.main()
