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
      {(displayUserText || state === 'listening' || state === 'transcribing') && (
        <div className="animate-in fade-in duration-200 flex flex-col items-center">
          {displayUserText ? (
            <p className="text-base md:text-lg font-medium tracking-tight text-white max-w-lg leading-relaxed">
              <span className="text-[#00f0ff] font-mono text-xs uppercase mr-2 tracking-wider font-bold">YOU:</span>
              <span className={interimTranscript ? 'opacity-70 text-cyan-200' : 'text-white'}>
                "{displayUserText}"
              </span>
            </p>
          ) : (
            <p className="text-xs md:text-sm font-mono text-cyan-400/70 flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-ping" />
              Listening... Speak in Hindi, Hinglish, or English
            </p>
          )}
        </div>
      )}

      {/* 2. Thinking State Indicator */}
      {(state === 'thinking' || isWorking) && (
        <div className="animate-in fade-in duration-200 flex items-center gap-2 py-1">
          <span className="w-2 h-2 rounded-full bg-[#00f0ff] animate-ping shadow-[0_0_8px_#00f0ff]" />
          <p className="text-xs md:text-sm font-mono text-[#00f0ff] font-bold tracking-wider uppercase">
            Thinking…
          </p>
        </div>
      )}

      {/* 3. AXION Spoken Response Text */}
      {!isWorking && lastAssistantText && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-lg bg-[#070c18]/90 border border-cyan-500/35 rounded-2xl p-4 shadow-[0_0_30px_rgba(0,240,255,0.18)] backdrop-blur-md">
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#00f0ff] font-bold">
              QUANTUM CORE // AXION
            </span>
          </div>
          <p className="text-xs md:text-sm text-cyan-50 font-normal leading-relaxed line-clamp-3">
            "{lastAssistantText}"
          </p>
        </div>
      )}

      {/* 4. Idle Helper Tip if nothing is active */}
      {state === 'idle' && !displayUserText && !lastAssistantText && (
        <p className="text-xs font-mono text-cyan-400/50">
          Choose a talk mode, then enable the microphone.
        </p>
      )}
    </div>
  );
};
