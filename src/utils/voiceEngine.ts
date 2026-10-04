import { prepareTextForSpeech } from './voiceNormalizer';
import { SpeechState } from '../types';

export type VoiceState = SpeechState;

export interface VoiceEngineEvents {
  onStateChange?: (state: VoiceState) => void;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onAudioLevel?: (level: number) => void; // 0.0 to 1.0
  onError?: (error: string) => void;
  onBargeIn?: () => void;
}

export class SpeechRecognitionAdapter {
  private recognition: any = null;
  private isListening = false;
  private isSupported = false;
  private language = 'hi-IN'; // Multi-lingual default: recognizes Hindi, Hinglish, and English
  private onTranscriptCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private onStateCallback: ((state: VoiceState) => void) | null = null;
  private onErrorCallback: ((err: string) => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.isSupported = true;
        try {
          this.recognition = new SpeechRecognition();
          this.recognition.continuous = true;
          this.recognition.interimResults = true;
          this.recognition.lang = this.language;
          this.setupListeners();
        } catch (e) {
          console.warn('SpeechRecognition initialization error:', e);
          this.isSupported = false;
        }
      }
    }
  }

  public checkAvailability(): boolean {
    return this.isSupported && this.recognition !== null;
  }

  public setLanguage(lang: string) {
    this.language = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  public setCallbacks(
    onTranscript: (text: string, isFinal: boolean) => void,
    onState: (state: VoiceState) => void,
    onError: (err: string) => void
  ) {
    this.onTranscriptCallback = onTranscript;
    this.onStateCallback = onState;
    this.onErrorCallback = onError;
  }

  private setupListeners() {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.onStateCallback?.('listening');
    };

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript.trim()) {
        this.onStateCallback?.('transcribing');
        this.onTranscriptCallback?.(finalTranscript.trim(), true);
      } else if (interimTranscript.trim()) {
        this.onTranscriptCallback?.(interimTranscript.trim(), false);
      }
    };

    this.recognition.onerror = (event: any) => {
      // Ignore routine 'no-speech' or 'aborted' events
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      console.warn('Speech recognition error event:', event.error);
      this.onErrorCallback?.(event.error);
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        // Automatically restart if continuous listening is active
        try {
          this.recognition.start();
        } catch (e) {
          this.isListening = false;
          this.onStateCallback?.('idle');
        }
      } else {
        this.onStateCallback?.('idle');
      }
    };
  }

  public start() {
    if (!this.checkAvailability()) {
      this.onErrorCallback?.('Speech recognition is not supported in this browser.');
      return;
    }
    try {
      this.isListening = true;
      this.recognition.start();
    } catch (e: any) {
      if (e.name !== 'InvalidStateError') {
        console.warn('Error starting speech recognition:', e);
      }
    }
  }

  public stop() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        // ignore
      }
    }
  }
}

export class SpeechSynthesisAdapter {
  private isSupported = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isCurrentlySpeaking = false;
  private onSpeakingChange: ((speaking: boolean) => void) | null = null;
  private voiceName: string = '';
  private rate: number = 1.05;
  private pitch: number = 1.0;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.isSupported = true;
    }
  }

  public checkAvailability(): boolean {
    return this.isSupported;
  }

  public setVoiceSettings(voiceName: string, rate: number, pitch = 1.0) {
    this.voiceName = voiceName;
    this.rate = rate;
    this.pitch = pitch;
  }

  public setOnSpeakingChange(cb: (speaking: boolean) => void) {
    this.onSpeakingChange = cb;
  }

  public speak(
    text: string,
    onStart?: () => void,
    onEnd?: () => void
  ): boolean {
    if (!this.checkAvailability()) return false;

    this.cancel(); // Stop any ongoing speech

    const cleanText = prepareTextForSpeech(text);
    if (!cleanText) return false;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;

    // Pick chosen or natural fallback voice
    const voices = window.speechSynthesis.getVoices();
    let selectedVoice = this.voiceName ? voices.find((v) => v.name === this.voiceName) : null;

    if (!selectedVoice) {
      selectedVoice = voices.find(
        (v) =>
          v.lang.startsWith('en') ||
          v.lang.startsWith('hi') ||
          v.name.includes('Natural') ||
          v.name.includes('Google')
      ) || voices[0];
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onstart = () => {
      this.isCurrentlySpeaking = true;
      this.onSpeakingChange?.(true);
      onStart?.();
    };

    utterance.onend = () => {
      this.isCurrentlySpeaking = false;
      this.currentUtterance = null;
      this.onSpeakingChange?.(false);
      onEnd?.();
    };

    utterance.onerror = (e) => {
      this.isCurrentlySpeaking = false;
      this.currentUtterance = null;
      this.onSpeakingChange?.(false);
      onEnd?.();
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    return true;
  }

  public cancel() {
    if (!this.checkAvailability()) return;
    window.speechSynthesis.cancel();
    this.isCurrentlySpeaking = false;
    this.currentUtterance = null;
    this.onSpeakingChange?.(false);
  }

  public isSpeaking(): boolean {
    return this.isCurrentlySpeaking;
  }
}

/**
 * Microphone Web Audio Analyser
 * Captures real-time RMS sound levels from the user's mic for audio-reactive avatars
 */
export class MicrophoneAudioAnalyser {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private animFrameId: number | null = null;
  private onLevelCallback: ((level: number) => void) | null = null;
  private isAnalyzing = false;

  public setOnLevel(callback: (level: number) => void) {
    this.onLevelCallback = callback;
  }

  public async start(): Promise<boolean> {
    if (typeof window === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
      return false;
    }

    try {
      if (!this.mediaStream) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      }

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioContext) {
        this.audioContext = new AudioCtx();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      if (!this.analyser) {
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.65;
        this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.source.connect(this.analyser);
      }

      this.isAnalyzing = true;
      this.loop();
      return true;
    } catch (e) {
      console.warn('Microphone audio analyser error:', e);
      return false;
    }
  }

  private loop = () => {
    if (!this.isAnalyzing || !this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const avg = sum / dataArray.length;
    const normalized = Math.min(1.0, Math.max(0, avg / 128));

    this.onLevelCallback?.(normalized);
    this.animFrameId = requestAnimationFrame(this.loop);
  };

  public stop() {
    this.isAnalyzing = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.source) {
      try {
        this.source.disconnect();
      } catch (e) {}
      this.source = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch (e) {}
      this.audioContext = null;
    }
    this.analyser = null;
    this.onLevelCallback?.(0);
  }
}

// Master VoiceEngine coordinating recognition, synthesis, analyser, and barge-in
export class VoiceEngine {
  public recognitionAdapter: SpeechRecognitionAdapter;
  public synthesisAdapter: SpeechSynthesisAdapter;
  public audioAnalyser: MicrophoneAudioAnalyser;
  private state: VoiceState = 'idle';
  private events: VoiceEngineEvents = {};
  private active = false;

  constructor(events?: VoiceEngineEvents) {
    if (events) this.events = events;
    this.recognitionAdapter = new SpeechRecognitionAdapter();
    this.synthesisAdapter = new SpeechSynthesisAdapter();
    this.audioAnalyser = new MicrophoneAudioAnalyser();

    // Wire genuine microphone sound level to event callback
    this.audioAnalyser.setOnLevel((level) => {
      if (this.state === 'listening' || this.state === 'transcribing') {
        this.events.onAudioLevel?.(level);
      }
    });

    this.synthesisAdapter.setOnSpeakingChange((speaking) => {
      if (speaking) {
        this.setState('speaking');
        // Do not emit synthetic audio levels. Living Core uses its designed CSS speaking rhythm.
        this.events.onAudioLevel?.(0);
      } else {
        this.events.onAudioLevel?.(0);
        if (this.active) {
          // Resume listening after speaking
          this.setState('listening');
          this.recognitionAdapter.start();
        } else {
          this.setState('idle');
        }
      }
    });

    this.recognitionAdapter.setCallbacks(
      (transcript, isFinal) => {
        // Barge-in: if AI is speaking and user speaks, stop AI speech immediately
        if (this.synthesisAdapter.isSpeaking()) {
          this.synthesisAdapter.cancel();
          this.events.onBargeIn?.();
        }

        this.events.onTranscript?.(transcript, isFinal);

        if (isFinal) {
          this.setState('thinking');
        }
      },
      (recState) => {
        if (this.state !== 'speaking' && this.state !== 'thinking') {
          this.setState(recState);
        }
      },
      (err) => {
        this.events.onError?.(err);
      }
    );
  }

  public isSupported(): boolean {
    return this.recognitionAdapter.checkAvailability() || this.synthesisAdapter.checkAvailability();
  }

  public isRecognitionSupported(): boolean {
    return this.recognitionAdapter.checkAvailability();
  }

  public isSynthesisSupported(): boolean {
    return this.synthesisAdapter.checkAvailability();
  }

  public setEvents(events: VoiceEngineEvents) {
    this.events = events;
  }

  public setState(newState: VoiceState) {
    this.state = newState;
    this.events.onStateChange?.(newState);
  }

  public getState(): VoiceState {
    return this.state;
  }

  public startListening() {
    this.active = true;
    if (this.synthesisAdapter.isSpeaking()) {
      this.synthesisAdapter.cancel();
    }
    this.recognitionAdapter.start();
    this.audioAnalyser.start();
  }

  public stopListening() {
    this.active = false;
    this.recognitionAdapter.stop();
    this.audioAnalyser.stop();
    this.setState('idle');
  }

  public speak(text: string, onDone?: () => void) {
    this.recognitionAdapter.stop(); // Stop listening while speaking to avoid feedback
    this.synthesisAdapter.speak(
      text,
      () => this.setState('speaking'),
      () => {
        if (this.active) {
          this.setState('listening');
          this.recognitionAdapter.start();
        } else {
          this.setState('idle');
        }
        onDone?.();
      }
    );
  }

  public interrupt() {
    this.synthesisAdapter.cancel();
    this.events.onAudioLevel?.(0);
    if (this.active) {
      this.setState('listening');
      this.recognitionAdapter.start();
    } else {
      this.setState('idle');
    }
  }

  public destroy() {
    this.active = false;
    this.events.onAudioLevel?.(0);
    this.recognitionAdapter.stop();
    this.synthesisAdapter.cancel();
    this.audioAnalyser.stop();
  }
}

export const globalVoiceEngine = new VoiceEngine();
