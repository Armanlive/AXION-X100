import React, { useState, useRef, useEffect } from 'react';
import { useAxionStore } from '../store/useAxionStore';
import { DiffViewer } from './DiffViewer';
import { VoiceAudioWaveform } from './VoiceAudioWaveform';
import {
  Send,
  Mic,
  MicOff,
  Sparkles,
  Bot,
  User,
  Wrench,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Terminal,
  Volume2
} from 'lucide-react';

export const WorkspaceChat: React.FC = () => {
  const {
    messages,
    executeUserPrompt,
    isWorking,
    voiceState,
    setVoiceState,
    triggerBuildErrorDemo,
    healBuildError,
    setCurrentTab
  } = useAxionStore();

  const [inputVal, setInputVal] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isWorking]);

  const handleSend = () => {
    if (!inputVal.trim() || isWorking) return;
    executeUserPrompt(inputVal, false);
    setInputVal('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Voice recording simulation / Web Speech API integration
  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      setVoiceState('ready');
      return;
    }

    setIsRecording(true);
    setVoiceState('listening');

    // Check if web speech is supported
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'hi-IN'; // Indian context / Hinglish / English
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setIsRecording(false);
          setVoiceState('parsing');
          executeUserPrompt(transcript, true);
        };

        recognition.onerror = () => {
          fallbackVoiceTrigger();
        };

        recognition.start();
      } catch {
        fallbackVoiceTrigger();
      }
    } else {
      fallbackVoiceTrigger();
    }
  };

  const fallbackVoiceTrigger = () => {
    // Simulated realistic Hinglish pilot prompt from README / PILOT_LOG
    setTimeout(() => {
      setVoiceState('parsing');
      setTimeout(() => {
        setIsRecording(false);
        setVoiceState('working');
        executeUserPrompt('Bhai dashboard ka header thoda chhota kar de aur date right side mein daal de', true);
      }, 700);
    }, 1200);
  };

  const quickPrompts = [
    {
      label: '🎤 Hinglish Voice Refactor',
      prompt: 'Bhai dashboard ka header thoda chhota kar de aur date right side mein daal de',
      isVoice: true
    },
    {
      label: 'Explain App Component',
      prompt: 'Mere project ka main App component explain karo aur dependencies batao'
    },
    {
      label: 'Create StatsCard Component',
      prompt: 'Ek naya StatsCard component banao'
    },
    {
      label: 'Simulate Build Error Fix',
      action: triggerBuildErrorDemo
    }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0f1d] overflow-hidden">
      {/* Top Quick Pilot Bar */}
      <div className="px-4 py-2 bg-[#0d1424] border-b border-[#1b263b] flex items-center justify-between gap-2 overflow-x-auto select-none shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>Quick Pilots:</span>
        </div>
        <div className="flex items-center gap-2">
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => {
                if (qp.action) qp.action();
                else if (qp.prompt) executeUserPrompt(qp.prompt, qp.isVoice);
              }}
              className="text-[11px] px-2.5 py-1 rounded-md bg-[#141e33] hover:bg-[#1a2845] border border-[#233554] text-slate-300 hover:text-white transition whitespace-nowrap"
            >
              {qp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const isSystem = msg.sender === 'system';

          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-4xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm shadow-md ${
                  isUser
                    ? 'bg-blue-600 text-white'
                    : isSystem
                    ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40'
                    : 'bg-gradient-to-br from-indigo-700 to-purple-800 text-white border border-indigo-500/40'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : isSystem ? <AlertTriangle className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble Content */}
              <div className={`space-y-2 flex-1 max-w-[85%] ${isUser ? 'items-end' : ''}`}>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                  <span className="font-semibold text-slate-200">
                    {isUser ? 'You' : msg.agentName || 'AXION Core'}
                  </span>
                  <span>{msg.timestamp}</span>
                  {msg.voiceTranscript && (
                    <span className="px-1.5 py-0.2 bg-red-500/20 text-red-300 rounded border border-red-500/30 flex items-center gap-1">
                      <Mic className="w-2.5 h-2.5" />
                      Voice Input ({msg.voiceTranscript.language})
                    </span>
                  )}
                </div>

                <div
                  className={`p-4 rounded-2xl text-xs leading-relaxed border ${
                    isUser
                      ? 'bg-blue-600 text-white border-blue-500 rounded-tr-none'
                      : isSystem
                      ? 'bg-amber-950/20 border-amber-800/40 text-amber-200 rounded-tl-none'
                      : 'bg-[#10182b] border-[#202f4c] text-slate-200 rounded-tl-none shadow-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* Multi-Agent Reasoning Steps */}
                  {msg.reasoningSteps && (
                    <div className="mt-3 pt-3 border-t border-[#1e2a42] space-y-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold block">
                        Agent Orchestration Steps:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {msg.reasoningSteps.map((step, sIdx) => (
                          <div
                            key={sIdx}
                            className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#0b111e] border border-[#1b263b] text-[11px]"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span className="font-semibold text-blue-300">{step.agent}:</span>
                            <span className="text-slate-300 truncate">{step.action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Proposed Diff Card Gate */}
                  {msg.proposedDiff && (
                    <div className="mt-3">
                      <DiffViewer diff={msg.proposedDiff} />
                    </div>
                  )}

                  {/* Build Status Card */}
                  {msg.buildStatus && (
                    <div className="mt-3 p-3 rounded-xl bg-[#0b111f] border border-[#1c2940] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {msg.buildStatus === 'passed' ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                        ) : msg.buildStatus === 'building' ? (
                          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                        )}
                        <span className="text-xs font-mono">
                          Native Build Validation:
                          <strong
                            className={`ml-1.5 ${
                              msg.buildStatus === 'passed'
                                ? 'text-emerald-400'
                                : msg.buildStatus === 'building'
                                ? 'text-blue-400'
                                : 'text-red-400'
                            }`}
                          >
                            {msg.buildStatus.toUpperCase()}
                          </strong>
                        </span>
                      </div>

                      {msg.buildStatus === 'failed' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={healBuildError}
                            className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-semibold transition"
                          >
                            <Wrench className="w-3 h-3" />
                            Ask Boss Agent to Fix
                          </button>
                          <button
                            onClick={() => setCurrentTab('terminal')}
                            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition"
                          >
                            <Terminal className="w-3 h-3" />
                            View Terminal
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Working Indicator */}
        {isWorking && (
          <div className="flex items-center gap-3 text-xs text-blue-400 font-mono animate-pulse">
            <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <span>Boss Agent triaging & generating AST diff...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Tray & Voice Control */}
      <div className="p-4 bg-[#0c1220] border-t border-[#1b273e] space-y-2 select-none">
        <div className="flex items-center gap-2">
          {/* Voice Microphone Toggle */}
          <button
            onClick={toggleRecording}
            className={`p-3 rounded-xl border transition flex items-center gap-2 ${
              isRecording
                ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/40 animate-pulse'
                : 'bg-[#141f33] border-[#223352] text-slate-300 hover:text-white hover:bg-[#1a2842]'
            }`}
            title="Toggle Hinglish / Voice Coding Engine"
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-sky-400" />}
            {isRecording && <span className="text-xs font-mono font-bold">Listening...</span>}
          </button>

          {/* Real-time Waveform */}
          <VoiceAudioWaveform isActive={isRecording} state={voiceState} />

          {/* Text Input Field */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Talk to your project in English or Hinglish (e.g. 'Bhai dashboard ka header thoda chhota kar de...')"
              className="w-full px-4 py-2.5 rounded-xl bg-[#11192b] border border-[#233554] text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition font-sans"
            />
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={!inputVal.trim() || isWorking}
            className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white transition shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono px-1">
          <span>Zero-Cost Route: Gemini 2.0 Flash ($0.00)</span>
          <span className="text-emerald-400">Diff Safety Gate: ACTIVE</span>
        </div>
      </div>
    </div>
  );
};
