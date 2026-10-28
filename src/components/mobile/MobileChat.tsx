import {ResponseActions} from '../ResponseActions';
import React, { useState, useRef, useEffect } from 'react';
import { useAxionStore } from '../../store/useAxionStore';
import { AxionHologramRing } from '../AxionHologramRing';
import { MarkdownRenderer } from '../MarkdownRenderer';
import {
  ArrowUp,
  Mic,
  Bot,
  Plus,
  Copy,
  Check,
  FolderOpen,
  Sparkles,
  AlertTriangle
} from 'lucide-react';

export const MobileChat: React.FC = () => {
  const {
    messages,
    executeUserPrompt,
    isWorking,
    speechState,
    setSpeechMode,
    setCurrentTab,
    createNewChat,
    activeWorkspace
  } = useAxionStore();

  const [inputVal, setInputVal] = useState('');
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isWorking]);

  const handleSend = () => {
    if (!inputVal.trim() || isWorking) return;
    executeUserPrompt(inputVal, false);
    setInputVal('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputVal(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 110)}px`;
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 1800);
  };

  const hasMessages = messages.length > 0;
  const visualizerState = isWorking
    ? 'thinking'
    : speechState === 'listening'
    ? 'listening'
    : speechState === 'speaking'
    ? 'speaking'
    : 'idle';

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050508] cyber-grid-bg overflow-hidden relative pb-14 text-cyan-100">
      {/* 1. Mobile Top Bar */}
      <header className="h-12 bg-[#080d1a]/95 border-b border-cyan-500/20 px-3.5 flex items-center justify-between shrink-0 z-20 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <AxionHologramRing
            size="header"
            state={visualizerState}
            interactive={false}
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-xs text-white font-mono tracking-wide">
                AXION-X100
              </span>
              <span className="text-[10px] text-cyan-500 font-mono">·</span>
              <span className="text-[10px] text-[#00f0ff] font-mono">QUANTUM HUD</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => createNewChat()}
          className="p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-cyan-400 hover:text-white"
          title="New Chat"
          aria-label="New Conversation"
        >
          <Plus className="w-4 h-4" />
        </button>
      </header>

      {/* 2. Messages List / Empty State */}
      {hasMessages ? (
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4 max-w-full">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const isSystem = msg.sender === 'system';
            const isCopied = copiedMsgId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-xs mt-1 ${
                      isSystem
                        ? 'bg-amber-950/40 text-amber-400 border border-amber-500/30'
                        : 'bg-cyan-950/60 text-[#00f0ff] border border-cyan-500/40 shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                    }`}
                  >
                    {isSystem ? <AlertTriangle className="w-3.5 h-3.5" /> : <span aria-label="Supreme Core" role="img">👑</span>}
                  </div>
                )}

                <div
                  className={`flex flex-col space-y-1 max-w-[88%] ${
                    isUser ? 'items-end' : 'items-start flex-1 min-w-0'
                  }`}
                >
                  <div className="flex items-center gap-2 text-[10px] text-cyan-400/60 font-mono px-1">
                    <span className="text-cyan-200 font-medium">
                      {isUser ? 'Operator' : isSystem?'System':'AXION'}
                    </span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed overflow-hidden break-words ${
                      isUser
                        ? 'bg-cyan-950/60 text-white border border-cyan-500/40 rounded-br-sm shadow-[0_0_12px_rgba(0,240,255,0.12)]'
                        : 'bg-[#080d1a]/85 backdrop-blur-md text-cyan-100 border border-cyan-500/25 rounded-bl-sm w-full'
                    }`}
                  >
                    {isUser ? (
                      <div className="whitespace-pre-wrap font-sans">{msg.text}</div>
                    ) : (
                      <div className="prose prose-invert prose-xs max-w-none overflow-x-auto">
                        <MarkdownRenderer content={msg.text} />
                      </div>
                    )}
                  </div>

                  {!isUser&&!isSystem&&<ResponseActions text={msg.text} ecc={msg.ecc}/>}

                </div>
              </div>
            );
          })}

          {isWorking && (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#080d1a]/80 border border-cyan-500/30 w-fit shadow-[0_0_15px_rgba(0,240,255,0.15)]">
              <span className="w-2 h-2 rounded-full bg-[#00f0ff] animate-ping" />
              <span className="text-xs font-mono text-[#00f0ff]">AXION is computing...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      ) : (
        /* Empty Conversation State with Prominent Hologram Ring */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 overflow-y-auto my-auto">
          <AxionHologramRing state={visualizerState} size="lg" />

          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white font-mono tracking-tight drop-shadow-[0_0_10px_rgba(0,240,255,0.6)]">
              AXION // QUANTUM HUD
            </h2>
            <p className="text-xs text-cyan-200/60 max-w-xs leading-relaxed font-mono">
              Local intelligence. High-end holographic environment.
            </p>
          </div>

          {/* Action Cards */}
          <div className="w-full max-w-xs space-y-2 pt-1">
            <button
              onClick={() => setCurrentTab('local_workspace')}
              className="w-full min-h-[44px] p-2.5 rounded-xl bg-[#080d1a]/80 border border-cyan-500/30 hover:border-cyan-400 flex items-center justify-between text-xs text-cyan-100 transition shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <FolderOpen className="w-4 h-4 text-[#00f0ff]" />
                <span className="font-mono">Open Workspace</span>
              </div>
              <span className="text-[10px] text-cyan-400 font-mono">
                {activeWorkspace ? activeWorkspace.name : 'Select'}
              </span>
            </button>

            <button
              onClick={() => setSpeechMode('speech')}
              className="w-full min-h-[44px] p-2.5 rounded-xl bg-[#080d1a]/80 border border-cyan-500/30 hover:border-cyan-400 flex items-center justify-between text-xs text-cyan-100 transition shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <Mic className="w-4 h-4 text-[#00f0ff]" />
                <span className="font-mono">Voice Mode</span>
              </div>
              <span className="text-[10px] text-[#00f0ff] font-mono">Live HUD</span>
            </button>

            <button
              onClick={() => {
                setInputVal('Explain the architecture of this project.');
                textareaRef.current?.focus();
              }}
              className="w-full min-h-[44px] p-2.5 rounded-xl bg-[#080d1a]/80 border border-cyan-500/30 hover:border-cyan-400 flex items-center justify-between text-xs text-cyan-100 transition shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-[#00f0ff]" />
                <span className="font-mono">Ask AXION</span>
              </div>
              <span className="text-[10px] text-cyan-400 font-mono">Prompt</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Sticky Bottom Composer */}
      <div className="p-2.5 bg-gradient-to-t from-[#050508] via-[#050508] to-transparent shrink-0">
        <div className="bg-[#080d1a]/90 backdrop-blur-md border border-cyan-500/30 rounded-2xl p-2 shadow-[0_0_20px_rgba(0,240,255,0.1)] flex items-end gap-2 focus-within:border-cyan-400 focus-within:shadow-[0_0_15px_rgba(0,240,255,0.25)]">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputVal}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask AXION anything, in any language..."
            className="flex-1 bg-transparent border-0 resize-none text-xs text-cyan-100 placeholder-cyan-500/40 focus:outline-none p-1.5 max-h-28 font-mono"
          />

          <button
            onClick={() => setSpeechMode('speech')}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-cyan-400 hover:text-[#00f0ff] transition"
            title="Switch to Voice Mode"
            aria-label="Voice input"
          >
            <Mic className="w-4 h-4" />
          </button>

          <button
            onClick={handleSend}
            disabled={!inputVal.trim() || isWorking}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-[#00f0ff] text-[#050508] hover:bg-[#38bdf8] disabled:opacity-30 disabled:hover:bg-[#00f0ff] transition shadow-[0_0_12px_rgba(0,240,255,0.3)] font-bold"
            aria-label="Send message"
          >
            <ArrowUp className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
