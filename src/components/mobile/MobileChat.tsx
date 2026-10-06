import React, { useState, useRef, useEffect } from 'react';
import { useAxionStore } from '../../store/useAxionStore';
import { AxionLivingCore } from '../voice/AxionLivingCore';
import { MarkdownRenderer } from '../MarkdownRenderer';
import {
  ArrowUp,
  Mic,
  Bot,
  User,
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

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0b0c] overflow-hidden relative pb-14">
      {/* 1. Mobile Top Bar */}
      <header className="h-12 bg-[#09090b]/95 border-b border-zinc-800/80 px-3.5 flex items-center justify-between shrink-0 z-20 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-zinc-900 border border-cyan-500/30 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-xs text-white font-mono tracking-wide">
                AXION-X100
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">·</span>
              <span className="text-[10px] text-cyan-400 font-mono">Boss Agent AUTO</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => createNewChat()}
          className="p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-white"
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
                        ? 'bg-amber-950/40 text-amber-400 border border-amber-800/50'
                        : 'bg-zinc-800 text-cyan-400 border border-zinc-700/60'
                    }`}
                  >
                    {isSystem ? <AlertTriangle className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>
                )}

                <div
                  className={`flex flex-col space-y-1 max-w-[88%] ${
                    isUser ? 'items-end' : 'items-start flex-1 min-w-0'
                  }`}
                >
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono px-1">
                    <span className="text-zinc-400 font-medium">
                      {isUser ? 'You' : msg.agentName || 'Boss Agent'}
                    </span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed overflow-hidden break-words ${
                      isUser
                        ? 'bg-zinc-800 text-white border border-zinc-700/80 rounded-br-sm'
                        : 'bg-[#121215] text-zinc-200 border border-zinc-800 rounded-bl-sm w-full'
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

                  {!isUser && (
                    <button
                      onClick={() => handleCopyMessage(msg.id, msg.text)}
                      className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 px-1.5 py-0.5 rounded transition"
                      aria-label="Copy message"
                    >
                      {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{isCopied ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {isWorking && (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800 w-fit">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-xs font-mono text-zinc-400">AXION is thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      ) : (
        /* Empty Conversation State with Prominent AxionLivingCore */
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 overflow-y-auto my-auto">
          <AxionLivingCore state="idle" size="lg" />

          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white font-mono tracking-tight">AXION</h2>
            <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
              Local intelligence. Your workspace.
            </p>
          </div>

          {/* Action Cards */}
          <div className="w-full max-w-xs space-y-2 pt-1">
            <button
              onClick={() => setCurrentTab('local_workspace')}
              className="w-full min-h-[44px] p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between text-xs text-zinc-200 transition"
            >
              <div className="flex items-center gap-2.5">
                <FolderOpen className="w-4 h-4 text-cyan-400" />
                <span>Open Workspace</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">
                {activeWorkspace ? activeWorkspace.name : 'Select'}
              </span>
            </button>

            <button
              onClick={() => setSpeechMode('speech')}
              className="w-full min-h-[44px] p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between text-xs text-zinc-200 transition"
            >
              <div className="flex items-center gap-2.5">
                <Mic className="w-4 h-4 text-cyan-400" />
                <span>Voice Mode</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">Live</span>
            </button>

            <button
              onClick={() => {
                setInputVal('Explain the architecture of this project.');
                textareaRef.current?.focus();
              }}
              className="w-full min-h-[44px] p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between text-xs text-zinc-200 transition"
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Ask AXION</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">Prompt</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Sticky Bottom Composer */}
      <div className="p-2.5 bg-gradient-to-t from-[#0b0b0c] via-[#0b0b0c] to-transparent shrink-0">
        <div className="bg-[#131316] border border-zinc-800 rounded-2xl p-2 shadow-lg flex items-end gap-2 focus-within:border-zinc-600">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputVal}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask AXION or speak in Hindi/English..."
            className="flex-1 bg-transparent border-0 resize-none text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none p-1.5 max-h-28 font-sans"
          />

          <button
            onClick={() => setSpeechMode('speech')}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-cyan-400 transition"
            title="Switch to Voice Mode"
            aria-label="Voice input"
          >
            <Mic className="w-4 h-4" />
          </button>

          <button
            onClick={handleSend}
            disabled={!inputVal.trim() || isWorking}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-30 disabled:hover:bg-cyan-500 transition shadow-sm"
            aria-label="Send message"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
