import React from 'react';
import { VoiceState } from '../../utils/voiceEngine';

interface VoiceTranscriptProps {
  state: VoiceState;
  liveTranscript: string;
  interimTranscript: string;
  lastAssistantText?: string;
  isWorking?: boolean;
}

export const VoiceTranscript: React.FC<VoiceTranscriptProps> = ({
  state,
  liveTranscript,
  interimTranscript,
  lastAssistantText,
  isWorking = false
}) => {
  const displayUserText = interimTranscript || liveTranscript;

  return (
    <div className="w-full max-w-xl mx-auto min-h-[90px] flex flex-col items-center justify-center text-center px-4 my-2">
      {/* 1. Live User Speech (Interim vs Final) */}
      {(displayUserText || state === 'listening' || state === 'transcribing') && !lastAssistantText && (
        <div className="animate-in fade-in duration-200 flex flex-col items-center">
          {displayUserText ? (
            <p className="text-base md:text-lg font-medium tracking-tight text-zinc-100 max-w-lg leading-relaxed">
              <span className="text-cyan-400 font-mono text-xs uppercase mr-2 tracking-wider">YOU:</span>
              <span className={interimTranscript ? 'opacity-65 text-zinc-300' : 'text-white'}>
                "{displayUserText}"
              </span>
            </p>
          ) : (
            <p className="text-xs md:text-sm font-mono text-zinc-500 flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Listening... Speak in Hindi, Hinglish, or English
            </p>
          )}
        </div>
      )}

      {/* 2. Thinking State Indicator */}
      {(state === 'thinking' || isWorking) && (
        <div className="animate-in fade-in duration-200 flex items-center gap-2 py-1">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
          <p className="text-xs md:text-sm font-mono text-indigo-300">
            AXION is thinking & processing with Boss Agent...
          </p>
        </div>
      )}

      {/* 3. AXION Spoken Response Text */}
      {state === 'speaking' && lastAssistantText && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-lg bg-zinc-900/60 border border-cyan-500/20 rounded-2xl p-3.5 shadow-lg shadow-cyan-500/5">
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-semibold">
              AXION
            </span>
          </div>
          <p className="text-xs md:text-sm text-zinc-200 font-normal leading-relaxed line-clamp-3">
            "{lastAssistantText}"
          </p>
        </div>
      )}

      {/* 4. Idle Helper Tip if nothing is active */}
      {state === 'idle' && !displayUserText && (
        <p className="text-xs font-mono text-zinc-600">
          Click the microphone or say "Hello AXION" to begin speaking.
        </p>
      )}
    </div>
  );
};
