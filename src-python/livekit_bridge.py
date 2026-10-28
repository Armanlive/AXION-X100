"""Scoped LiveKit microphone -> Groq STT bridge. No LLM or tool execution here."""
from __future__ import annotations
import argparse
import asyncio
import array
from collections import deque
from datetime import timedelta
import io
import json
import math
import os
import re
import wave

RATE = 16000
MAX_BYTES = RATE * 2 * 20


def scoped_token(room: str, identity: str, worker: bool = False) -> str:
    from livekit import api
    if not all(re.fullmatch(r"[A-Za-z0-9_-]{1,64}", value) for value in (room, identity)):
        raise ValueError("Room and identity must be 1-64 letters, numbers, underscores or hyphens.")
    key, secret = os.environ.get("LIVEKIT_API_KEY"), os.environ.get("LIVEKIT_API_SECRET")
    if not key or not secret:
        raise ValueError("Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET in the backend environment.")
    grants = api.VideoGrants(room_join=True, room=room, can_publish=not worker,
                            can_subscribe=worker, can_publish_data=True)
    if not worker:
        grants.can_publish_sources = ["microphone"]
    return api.AccessToken(key, secret).with_identity(identity).with_ttl(timedelta(minutes=5)).with_grants(grants).to_jwt()


def wav_bytes(pcm: bytes) -> bytes:
    output = io.BytesIO()
    with wave.open(output, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(RATE)
        audio.writeframes(pcm)
    return output.getvalue()


async def worker(room_name: str, client_identity: str, identity: str) -> None:
    from livekit import rtc
    from groq import AsyncGroq
    if client_identity == identity:
        raise ValueError("Worker and participant identities must differ.")
    if not os.environ.get("GROQ_API_KEY"):
        raise ValueError("Set GROQ_API_KEY in the worker environment.")
    url = os.environ.get("LIVEKIT_URL", "ws://127.0.0.1:7880")
    from urllib.parse import urlsplit
    parsed = urlsplit(url)
    if parsed.scheme != "wss" and not (parsed.scheme == "ws" and parsed.hostname in ("localhost", "127.0.0.1", "::1")):
        raise ValueError("Use WSS, or WS only for a local server.")
    room = rtc.Room()
    groq = AsyncGroq(timeout=12, max_retries=0)
    state = {"turn": None, "mode": "continuous", "buffer": bytearray(), "speech": False, "silence": 0.0, "busy": False, "pcm": False}
    tasks: set[asyncio.Task] = set()
    def spawn(coro):
        task = asyncio.create_task(coro)
        tasks.add(task)
        task.add_done_callback(tasks.discard)
        return task

    async def publish(turn, **result):
        if state["turn"] == turn:
            await room.local_participant.publish_data(json.dumps({"turnId": turn, **result}), reliable=True,
                                                      topic="axion.stt", destination_identities=[client_identity])

    async def commit(turn):
        if state["turn"] != turn or state["busy"]:
            return
        state["busy"] = True
        pcm = bytes(state["buffer"])
        state["buffer"].clear()
        try:
            if not state["speech"] or len(pcm) < RATE // 2:
                await publish(turn, error="No speech detected")
                return
            result = await groq.audio.transcriptions.create(
                model=os.environ.get("GROQ_STT_MODEL", "whisper-large-v3-turbo"),
                file=("utterance.wav", wav_bytes(pcm), "audio/wav"), response_format="json")
            if result.text.strip():
                await publish(turn, text=result.text[:3000])
            else:
                await publish(turn, error="Empty transcript")
        except asyncio.CancelledError:
            raise
        except Exception:
            await publish(turn, error="Transcription failed")
        finally:
            if state["turn"] == turn:
                state["turn"] = None
                state["busy"] = False

    async def append_pcm(pcm: bytes, turn: str):
        """Accept bounded mono s16le at 16 kHz from one scoped active turn."""
        if state["turn"] != turn or state["busy"] or not pcm or len(pcm) > 4096 or len(pcm) % 2:
            return
        samples = array.array("h", pcm)
        rms = math.sqrt(sum(int(v) ** 2 for v in samples) / max(1, len(samples))) / 32768
        if not state["speech"]:
            if rms < 0.012:
                return
            state["speech"] = True
        state["buffer"].extend(pcm)
        state["silence"] = state["silence"] + len(samples) / RATE if rms < 0.012 else 0
        if len(state["buffer"]) >= MAX_BYTES or (state["mode"] != "push-to-talk" and state["silence"] >= 0.7):
            await commit(turn)

    async def consume(track):
        stream = rtc.AudioStream(track, sample_rate=RATE, num_channels=1)
        preroll = deque(maxlen=10)
        try:
            async for event in stream:
                if not state["turn"] or state["busy"] or state["pcm"]:
                    continue
                pcm = event.frame.data.tobytes()
                samples = array.array("h", pcm)
                rms = math.sqrt(sum(int(v) ** 2 for v in samples) / max(1, len(samples))) / 32768
                if not state["speech"]:
                    preroll.append(pcm)
                    if rms < 0.012:
                        continue
                    state["speech"] = True
                    state["buffer"].extend(b"".join(preroll))
                    preroll.clear()
                else:
                    state["buffer"].extend(pcm)
                state["silence"] = state["silence"] + len(samples) / RATE if rms < 0.012 else 0
                if len(state["buffer"]) >= MAX_BYTES or (state["mode"] != "push-to-talk" and state["silence"] >= 0.7):
                    await commit(state["turn"])
        finally:
            await stream.aclose()

    @room.on("track_subscribed")
    def track_subscribed(track, publication, participant):
        if participant.identity == client_identity and track.kind == rtc.TrackKind.KIND_AUDIO:
            spawn(consume(track))

    @room.on("data_received")
    def data_received(packet):
        if not packet.participant or packet.participant.identity != client_identity:
            return
        if packet.topic == "axion.audio.pcm":
            if state["pcm"] and state["turn"]:
                spawn(append_pcm(bytes(packet.data), state["turn"]))
            return
        if packet.topic != "axion.control" or len(packet.data) > 2048:
            return
        try:
            data = json.loads(packet.data)
            turn = data.get("turnId")
            if not isinstance(turn, str) or not re.fullmatch(r"[a-f0-9-]{36}", turn):
                return
            if data.get("command") == "start":
                fmt = data.get("audioFormat") or {}
                pcm = isinstance(fmt, dict) and fmt == {"codec": "pcm_s16le", "sampleRate": RATE, "channels": 1, "frameSamples": 320, "topic": "axion.audio.pcm"}
                state.update(turn=turn, mode=data.get("mode", "continuous"), buffer=bytearray(), speech=False, silence=0.0, busy=False, pcm=pcm)
            elif data.get("command") == "commit" and turn == state["turn"]:
                async def drain():
                    await asyncio.sleep(0.25)  # allow in-flight RTP frames to arrive
                    await commit(turn)
                spawn(drain())
        except (ValueError, TypeError, AttributeError):
            pass

    @room.on("participant_disconnected")
    def disconnected(participant):
        if participant.identity == client_identity:
            state.update(turn=None, buffer=bytearray(), busy=False, speech=False, pcm=False)
            for task in list(tasks):
                task.cancel()

    try:
        await room.connect(url, scoped_token(room_name, identity, worker=True))
        print("STT worker connected. Only the explicitly scoped participant is accepted.", flush=True)
        await asyncio.sleep(1800)  # bounded worker session; restart explicitly after 30 minutes
    finally:
        for task in list(tasks):
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await room.disconnect()
        await groq.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["token", "worker"])
    parser.add_argument("--room", required=True)
    parser.add_argument("--participant", required=True)
    parser.add_argument("--worker-identity", default="axion-stt")
    args = parser.parse_args()
    try:
        if args.action == "token":
            if args.participant == args.worker_identity:
                raise ValueError("Use distinct worker and participant identities.")
            print(scoped_token(args.room, args.participant))
        else:
            asyncio.run(worker(args.room, args.participant, args.worker_identity))
    except KeyboardInterrupt:
        print("Worker stopped.")
    except Exception:
        print("LiveKit setup failed. Check installed dependencies and backend environment; secrets were not logged.")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
