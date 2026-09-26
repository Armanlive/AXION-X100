// VoiceEngine Abstraction for AXION-X100
// Provides SpeechRecognitionAdapter, SpeechSynthesisAdapter, and NativeVoiceAdapter hook
// Supports barge-in (interruption), Hinglish/Hindi/English speech detection, and graceful fallback

export type VoiceState = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking';

export interface VoiceEngineEvents {
  onStateChange?: (state: VoiceState) => void;
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onBargeIn?: () => void;
}

export class SpeechRecognitionAdapter {
  private recognition: any = null;
  private isListening = false;
  private isSupported = false;
  private language = 'hi-IN'; // Multi-lingual: recognizes Hindi, Hinglish, and English
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
        // Automatically restart if continuous listening is desired
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
      // If already started, ignore error
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

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.isSupported = true;
    }
  }

  public checkAvailability(): boolean {
    return this.isSupported;
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

    // Clean markdown and code symbols for natural voice read-out
    const cleanText = text
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*#_~\[\]]/g, '')
      .replace(/https?:\/\/\S+/g, 'link')
      .trim();

    if (!cleanText) return false;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    // Pick a natural voice if available
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(
      (v) =>
        v.lang.startsWith('en') ||
        v.lang.startsWith('hi') ||
        v.name.includes('Natural') ||
        v.name.includes('Google')
    );
    if (naturalVoice) {
      utterance.voice = naturalVoice;
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

// Master VoiceEngine coordinating recognition, synthesis, and barge-in
export class VoiceEngine {
  public recognitionAdapter: SpeechRecognitionAdapter;
  public synthesisAdapter: SpeechSynthesisAdapter;
  private state: VoiceState = 'idle';
  private events: VoiceEngineEvents = {};
  private active = false;

  constructor(events?: VoiceEngineEvents) {
    if (events) this.events = events;
    this.recognitionAdapter = new SpeechRecognitionAdapter();
    this.synthesisAdapter = new SpeechSynthesisAdapter();

    this.synthesisAdapter.setOnSpeakingChange((speaking) => {
      if (speaking) {
        this.setState('speaking');
      } else if (this.active) {
        // Resume listening after speaking
        this.setState('listening');
        this.recognitionAdapter.start();
      } else {
        this.setState('idle');
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
  }

  public stopListening() {
    this.active = false;
    this.recognitionAdapter.stop();
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
    if (this.active) {
      this.setState('listening');
      this.recognitionAdapter.start();
    } else {
      this.setState('idle');
    }
  }

  public destroy() {
    this.active = false;
    this.recognitionAdapter.stop();
    this.synthesisAdapter.cancel();
  }
}
