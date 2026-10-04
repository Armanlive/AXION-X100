import React, { useState, useRef, useEffect } from 'react';
import { useAxionStore } from '../store/useAxionStore';
import { DiffViewer } from './DiffViewer';
import { VoiceAudioWaveform } from './VoiceAudioWaveform';
import { MarkdownRenderer } from './MarkdownRenderer';
import { AxionLivingCore } from './voice/AxionLivingCore';
import {
  ArrowUp,
  Mic,
  MicOff,
  Sparkles,
  Bot,
  User,
  Wrench,
  CheckCircle,
  AlertTriangle,
  Terminal,
  Volume2,
  Copy,
  Check,
  GitCompare,
  Plus,
  ChevronDown,
  ChevronUp,
  Square,
  Search,
  Zap,
  Sliders,
  Folder,
  ShieldCheck,
  Code,
  Layers,
  Lock
} from 'lucide-react';

export const WorkspaceChat: React.FC = () => {
  const {
    messages,
    executeUserPrompt,
    isWorking,
    speechState,
    setSpeechState,
    setSpeechMode,
    triggerBuildErrorDemo,
    healBuildError,
    setCurrentTab,
    selectedAgentId,
    setSelectedAgentId,
    agents,
    isManualMode,
    setIsManualMode,
    isBossLocked,
    setIsBossLocked,
    models,
    activeModelId,
    setActiveModelId,
    speakingMessageId,
    setSpeakingMessageId,
    approveDiff,
    rejectDiff,
    activeWorkspace,
    workspaces,
    activeWorkspaceId
  } = useAxionStore();

  const [inputVal, setInputVal] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [expandedDiffMsgIds, setExpandedDiffMsgIds] = useState<Record<string, boolean>>({});
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [agentSearch, setAgentSearch] = useState('');
  const [agentCategoryFilter, setAgentCategoryFilter] = useState<string>('ALL');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const plusMenuRef = useRef<HTMLDivElement | null>(null);
  const agentMenuRef = useRef<HTMLDivElement | null>(null);
  const modelMenuRef = useRef<HTMLDivElement | null>(null);

  const activeSpecialist = agents.find((a) => a.id === selectedAgentId);
  const activeModel = models.find((m) => m.id === activeModelId) || models[0];

  // Auto scroll to bottom smoothly
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isWorking]);

  // Close menus on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setIsPlusMenuOpen(false);
      }
      if (agentMenuRef.current && !agentMenuRef.current.contains(e.target as Node)) {
        setIsAgentMenuOpen(false);
      }
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setIsModelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

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

  const handleInputResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputVal(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  const handleQuickPromptClick = (prompt: string, isVoice = false) => {
    executeUserPrompt(prompt, isVoice);
  };

  // Copy entire response
  const handleCopyMessage = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  // Text-To-Speech Play / Pause / Stop per message
  const handleToggleSpeak = (msgId: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (speakingMessageId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanSpeech = text
      .replace(/[#*`_>]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.rate = 1.05;
    utterance.onstart = () => setSpeakingMessageId(msgId);
    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    window.speechSynthesis.speak(utterance);
  };

  // Voice recording / Web Speech API integration
  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      setSpeechState('ready');
      return;
    }

    setIsRecording(true);
    setSpeechState('listening');

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'hi-IN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setIsRecording(false);
          setSpeechState('parsing');
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
    setTimeout(() => {
      setSpeechState('parsing');
      setTimeout(() => {
        setIsRecording(false);
        setSpeechState('working');
        executeUserPrompt('Bhai dashboard ka header thoda chhota kar de aur date right side mein daal de', true);
      }, 700);
    }, 1200);
  };

  const toggleDiffExpand = (msgId: string) => {
    setExpandedDiffMsgIds((prev) => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  const handleSelectBossAgent = () => {
    setIsManualMode(false);
    setSelectedAgentId('boss-agent');
    setIsAgentMenuOpen(false);
  };

  const handleSelectSpecialist = (agentId: string) => {
    setIsManualMode(true);
    setSelectedAgentId(agentId);
    setIsAgentMenuOpen(false);
  };

  const quickPrompts = [
    {
      label: '🎤 Hinglish Voice Refactor',
      prompt: 'Bhai dashboard ka header thoda chhota kar de aur date right side mein daal de',
      isVoice: true
    },
    {
      label: 'Explain Project Architecture',
      prompt: 'Mere project ka main App component explain karo aur dependencies batao'
    },
    {
      label: 'Create StatsCard Component',
      prompt: 'Ek naya StatsCard component banao with glowing trend metrics'
    },
    {
      label: 'Simulate Build Error Recovery',
      action: triggerBuildErrorDemo
    }
  ];

  // Filter specialists for popover
  const filteredAgents = agents.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(agentSearch.toLowerCase()) ||
      a.category.toLowerCase().includes(agentSearch.toLowerCase()) ||
      a.description.toLowerCase().includes(agentSearch.toLowerCase());
    const matchesCat =
      agentCategoryFilter === 'ALL' ||
      a.category.toUpperCase() === agentCategoryFilter.toUpperCase();
    return matchesSearch && matchesCat;
  });

  const categories = ['ALL', 'CODING', 'COMMAND', 'RESEARCH', 'WRITING', 'QUALITY', 'DATA'];

  // Empty state hero
  const hasMessages = messages.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0b0c] overflow-hidden relative">
      {/* Messages Scroll Area OR Empty Chat Landing Hero */}
      {hasMessages ? (
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8 space-y-7 max-w-3xl lg:max-w-4xl w-full mx-auto">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const isSystem = msg.sender === 'system';
            const isSpeaking = speakingMessageId === msg.id;
            const isCopied = copiedMsgId === msg.id;
            const isDiffExpanded = !!expandedDiffMsgIds[msg.id];

            return (
              <div
                key={msg.id}
                className={`flex gap-3.5 group ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {/* Left Avatar for Assistant & System */}
                {!isUser && (
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-xs mt-1 ${
                      isSystem
                        ? 'bg-amber-950/40 text-amber-400 border border-amber-800/50'
                        : 'bg-[#18181b] text-zinc-400 border border-zinc-800'
                    }`}
                  >
                    {isSystem ? <AlertTriangle className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5 text-zinc-300" />}
                  </div>
                )}

                {/* Message Content Container */}
                <div
                  className={`flex flex-col space-y-1.5 max-w-[88%] sm:max-w-[82%] ${
                    isUser ? 'items-end' : 'items-start flex-1'
                  }`}
                >
                  {/* Meta Header */}
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono px-0.5">
                    <span className="font-medium text-zinc-300">
                      {isUser ? 'You' : msg.agentName || 'Boss Agent'}
                    </span>
                    <span>{msg.timestamp}</span>
                    {msg.voiceTranscript && (
                      <span className="px-1.5 py-0.2 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/60 text-[10px] flex items-center gap-1 font-sans">
                        <Mic className="w-2.5 h-2.5 text-red-400" />
                        Voice Input ({msg.voiceTranscript.language})
                      </span>
                    )}
                  </div>

                  {/* Message Body */}
                  {isUser ? (
                    <div className="p-3.5 rounded-2xl bg-zinc-800/90 text-zinc-100 text-sm leading-relaxed border border-zinc-750/70 shadow-sm">
                      <div className="whitespace-pre-wrap font-sans">{msg.text}</div>
                    </div>
                  ) : (
                    <div className="w-full space-y-3">
                      {/* Formatted Markdown Body */}
                      <div className="p-4 rounded-2xl bg-[#121215] border border-zinc-800/90 shadow-sm">
                        <MarkdownRenderer content={msg.text} />
                      </div>

                      {/* Autonomous Reasoning Chain if available */}
                      {msg.reasoningSteps && msg.reasoningSteps.length > 0 && (
                        <div className="p-3 rounded-xl bg-[#0f0f12] border border-zinc-800/70 space-y-1.5 text-xs font-mono">
                          <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 text-zinc-400" />
                            <span>Boss Agent Delegation Chain</span>
                          </div>
                          <div className="space-y-1 pt-1">
                            {msg.reasoningSteps.map((step, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-zinc-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                                <span className="font-medium text-zinc-300">{step.agent}:</span>
                                <span>{step.action}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Proposed AST Diff Gate Card */}
                      {msg.proposedDiff && (
                        <div className="rounded-xl border border-zinc-750 bg-[#141418] overflow-hidden shadow-md">
                          <div className="p-3 bg-[#18181d] border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-md bg-zinc-800/80 text-zinc-300">
                                <GitCompare className="w-4 h-4 text-zinc-300" />
                              </div>
                              <div>
                                <div className="text-xs font-mono font-semibold text-zinc-200 flex items-center gap-2">
                                  <span>{msg.proposedDiff.filePath}</span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                                    {msg.proposedDiff.taskId}
                                  </span>
                                </div>
                                <div className="text-[11px] text-zinc-400 mt-0.5">
                                  {msg.proposedDiff.summary}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleDiffExpand(msg.id)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition"
                              >
                                <span>{isDiffExpanded ? 'Hide Diff' : 'Review Changes'}</span>
                                {isDiffExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>

                              {msg.proposedDiff.status === 'pending_approval' && (
                                <>
                                  <button
                                    onClick={() => rejectDiff(msg.proposedDiff!.id)}
                                    className="px-2.5 py-1 rounded-md border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium transition"
                                  >
                                    Reject
                                  </button>
                                  <button
                                    onClick={() => approveDiff(msg.proposedDiff!.id)}
                                    className="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition"
                                  >
                                    Approve
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Expandable full diff inline */}
                          {isDiffExpanded && (
                            <div className="p-2 border-t border-zinc-800 bg-[#0c0c0e]">
                              <DiffViewer diff={msg.proposedDiff} />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Native Build Status Card */}
                      {msg.buildStatus && (
                        <div className="p-2.5 rounded-lg bg-[#121215] border border-zinc-800 flex items-center justify-between my-1">
                          <div className="flex items-center gap-2">
                            {msg.buildStatus === 'passed' ? (
                              <CheckCircle className="w-4 h-4 text-emerald-400" />
                            ) : msg.buildStatus === 'building' ? (
                              <div className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-rose-400" />
                            )}
                            <span className="text-xs font-mono text-zinc-300">
                              Build Validation:{' '}
                              <strong
                                className={
                                  msg.buildStatus === 'passed'
                                    ? 'text-emerald-400'
                                    : msg.buildStatus === 'building'
                                    ? 'text-zinc-300'
                                    : 'text-rose-400'
                                }
                              >
                                {msg.buildStatus.toUpperCase()}
                              </strong>
                            </span>
                          </div>

                          {msg.buildStatus === 'failed' && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={healBuildError}
                                className="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded text-xs font-medium transition"
                              >
                                <Wrench className="w-3 h-3 text-amber-400" />
                                Auto-Heal Regression
                              </button>
                              <button
                                onClick={() => setCurrentTab('terminal')}
                                className="flex items-center gap-1 px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded text-xs transition"
                              >
                                <Terminal className="w-3 h-3" />
                                Logs
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Subtle Hover Action Toolbar for Assistant */}
                  {!isUser && (
                    <div className="flex items-center gap-1 pt-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleCopyMessage(msg.id, msg.text)}
                        className="p-1.5 rounded hover:bg-zinc-800/80 text-zinc-500 hover:text-zinc-200 transition"
                        title="Copy response"
                      >
                        {isCopied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        onClick={() => handleToggleSpeak(msg.id, msg.text)}
                        className={`p-1.5 rounded transition ${
                          isSpeaking
                            ? 'text-amber-400 hover:bg-amber-500/10'
                            : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80'
                        }`}
                        title={isSpeaking ? 'Stop speaking' : 'Listen to response'}
                      >
                        {isSpeaking ? (
                          <Square className="w-3.5 h-3.5 fill-current animate-pulse" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Avatar for User */}
                {isUser && (
                  <div className="w-6 h-6 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700 flex items-center justify-center shrink-0 text-xs mt-1">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Working Indicator */}
          {isWorking && (
            <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono animate-pulse pt-2">
              <div className="w-6 h-6 rounded-md bg-zinc-800/80 flex items-center justify-center text-zinc-400">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <span>
                {isManualMode && activeSpecialist
                  ? `${activeSpecialist.name} generating code patch...`
                  : 'Boss Agent triaging & generating AST diff...'}
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      ) : (
        /* ==================================================
           AXION LIVING CORE DESKTOP CHAT HERO
           ================================================== */
        <div className="flex-1 flex flex-col items-center justify-center px-4 overflow-y-auto max-w-2xl w-full mx-auto text-center space-y-6 animate-in fade-in duration-200 py-10">
          {/* Hero Abstract Living Core */}
          <AxionLivingCore state="idle" size="md" />

          {/* Clean Typography */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-mono font-semibold text-cyan-400/90 uppercase tracking-widest">
              AXION
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Local intelligence. Your workspace.
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
              One private local workspace. Real-time reasoning. 17 specialist agents.
            </p>
          </div>

          {/* Three Focused Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg text-left pt-1">
            <button
              onClick={() => setCurrentTab('local_workspace')}
              className="p-3.5 rounded-xl bg-[#121215] border border-zinc-800 hover:border-zinc-700 hover:bg-[#161619] transition group flex flex-col justify-between min-h-[84px]"
            >
              <div className="flex items-center justify-between w-full">
                <Folder className="w-4 h-4 text-cyan-400" />
                <ArrowUp className="w-3 h-3 text-zinc-600 group-hover:text-zinc-300 rotate-45 transition" />
              </div>
              <div>
                <div className="text-xs font-semibold text-zinc-200 group-hover:text-white">
                  Open Local Workspace
                </div>
                <div className="text-[11px] text-zinc-500 truncate mt-0.5 font-mono">
                  {activeWorkspace ? activeWorkspace.name : 'Mount directory'}
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setInputVal('Analyze this project architecture and check for build issues.');
                textareaRef.current?.focus();
              }}
              className="p-3.5 rounded-xl bg-[#121215] border border-zinc-800 hover:border-zinc-700 hover:bg-[#161619] transition group flex flex-col justify-between min-h-[84px]"
            >
              <div className="flex items-center justify-between w-full">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <ArrowUp className="w-3 h-3 text-zinc-600 group-hover:text-zinc-300 rotate-45 transition" />
              </div>
              <div>
                <div className="text-xs font-semibold text-zinc-200 group-hover:text-white">
                  Ask AXION
                </div>
                <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                  Engineering prompt
                </div>
              </div>
            </button>

            <button
              onClick={() => setSpeechMode('speech')}
              className="p-3.5 rounded-xl bg-[#121215] border border-zinc-800 hover:border-zinc-700 hover:bg-[#161619] transition group flex flex-col justify-between min-h-[84px]"
            >
              <div className="flex items-center justify-between w-full">
                <Mic className="w-4 h-4 text-cyan-400" />
                <ArrowUp className="w-3 h-3 text-zinc-600 group-hover:text-zinc-300 rotate-45 transition" />
              </div>
              <div>
                <div className="text-xs font-semibold text-zinc-200 group-hover:text-white">
                  Voice Mode
                </div>
                <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                  Live vocal coding
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ==================================================
         4. BOSS AGENT & CHAT COMPOSER (MATCH NEXTRON INTERACTION)
         ================================================== */}
      <div className="p-4 bg-gradient-to-t from-[#0b0b0c] via-[#0b0b0c]/90 to-transparent shrink-0">
        <div className="max-w-3xl lg:max-w-4xl mx-auto space-y-2">
          {/* Active Voice Waveform Pill (Only appears when voice is active!) */}
          <div className="flex justify-center">
            <VoiceAudioWaveform isActive={isRecording} state={speechState} />
          </div>

          {/* Composer Box */}
          <div className="bg-[#131316] border border-zinc-800/90 hover:border-zinc-700/80 rounded-2xl p-3 shadow-xl shadow-black/40 transition-all focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600/30">
            {/* Input Row */}
            <div className="flex items-start gap-2.5">
              {/* Plus Menu Button */}
              <div className="relative" ref={plusMenuRef}>
                <button
                  onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition mt-0.5"
                  title="Quick prompt presets"
                >
                  <Plus className="w-4 h-4" />
                </button>

                {isPlusMenuOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#18181b] border border-zinc-800 rounded-xl shadow-2xl p-1 z-50 animate-in fade-in duration-100">
                    <div className="px-2.5 py-1 text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-semibold">
                      Quick Pilots & Presets
                    </div>
                    {quickPrompts.map((qp, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setIsPlusMenuOpen(false);
                          if (qp.action) qp.action();
                          else if (qp.prompt) executeUserPrompt(qp.prompt, qp.isVoice);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition flex items-center justify-between"
                      >
                        <span className="truncate">{qp.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={inputVal}
                onChange={handleInputResize}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={
                  isRecording
                    ? 'Listening... Speak in Hindi, Hinglish, or English'
                    : 'Ask AXION anything in English or Hinglish (e.g. "Bhai header thoda chhota kar de")...'
                }
                className="flex-1 bg-transparent text-sm text-[#f4f4f5] placeholder-zinc-500 focus:outline-none resize-none max-h-36 leading-relaxed font-sans pt-0.5"
              />

              {/* Voice Microphone Toggle */}
              <button
                onClick={toggleRecording}
                className={`p-1.5 rounded-lg transition mt-0.5 ${
                  isRecording
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/40 animate-pulse'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
                title="Toggle Hinglish / Voice Coding Engine"
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Send Button */}
              <button
                onClick={handleSend}
                disabled={!inputVal.trim() || isWorking}
                className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-white text-zinc-950 disabled:opacity-20 disabled:hover:bg-zinc-100 flex items-center justify-center transition shadow-sm font-bold mt-0.5 shrink-0"
                title="Send Prompt (Enter)"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Composer Footer: Nextron-Style Boss Agent Interaction */}
            <div className="pt-2 mt-2 border-t border-zinc-800/50 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                {/* BOSS AGENT CONTROL BUTTON */}
                <div className="relative" ref={agentMenuRef}>
                  {isBossLocked ? (
                    /* LOCKED AUTONOMOUS MODE (DEFAULT) */
                    <button
                      onClick={() => setIsAgentMenuOpen(!isAgentMenuOpen)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-850 hover:bg-zinc-800 text-zinc-100 border border-zinc-700/80 text-[11px] font-medium transition shadow-sm"
                      title="Boss Agent Autonomous Orchestration is Active (Click to configure)"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      <span>Boss Agent</span>
                      <span className="text-[9px] font-mono font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1 py-0.2 rounded">AUTO</span>
                    </button>
                  ) : (
                    /* UNLOCKED MANUAL CONTROL */
                    <button
                      onClick={() => setIsAgentMenuOpen(!isAgentMenuOpen)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-950/40 hover:bg-amber-900/40 text-amber-300 border border-amber-600/40 text-[11px] font-medium transition shadow-sm"
                      title="Manual Mode Unlocked (Click to return to Boss Auto)"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span>Boss Agent</span>
                      <span className="text-[9px] font-mono font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1 py-0.2 rounded">MANUAL</span>
                    </button>
                  )}

                  {/* POPOVER FOR BOSS AGENT */}
                  {isAgentMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-72 bg-[#141417] border border-zinc-800 rounded-xl shadow-2xl p-3 z-50 animate-in fade-in duration-100">
                      {isBossLocked ? (
                        /* Popover when Locked */
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
                            <span className="text-base">👑</span>
                            <div>
                              <div className="text-xs font-bold text-white tracking-tight">BOSS AGENT (RULE-BASED PREVIEW)</div>
                              <div className="text-[10px] text-zinc-400">Rule-based specialist matching is active.</div>
                            </div>
                          </div>

                          <div className="space-y-1.5 py-1 text-[11px] text-zinc-300 font-sans">
                            <div className="flex items-center gap-2 text-emerald-400">
                              <Check className="w-3.5 h-3.5 shrink-0" />
                              <span>Rule-based specialist matching</span>
                            </div>
                            <div className="flex items-center gap-2 text-emerald-400">
                              <Check className="w-3.5 h-3.5 shrink-0" />
                              <span>Selects zero-cost model tier</span>
                            </div>
                            <div className="flex items-center gap-2 text-emerald-400">
                              <Check className="w-3.5 h-3.5 shrink-0" />
                              <span>Read-only workspace context</span>
                            </div>
                            <div className="flex items-center gap-2 text-zinc-500">
                              <span className="w-3.5 h-3.5 flex items-center justify-center text-[10px]">•</span>
                              <span className="italic">Native execution planned for Phase 2</span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-zinc-800">
                            <button
                              onClick={() => {
                                setIsBossLocked(false);
                                setIsAgentMenuOpen(false);
                              }}
                              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-xs font-medium border border-amber-500/30 transition shadow-sm"
                            >
                              <span>🔓</span>
                              <span>Unlock Manual Control</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Popover when Unlocked */
                        <div className="space-y-3">
                          <div className="pb-2 border-b border-zinc-800">
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span>🔓</span>
                              <span>MANUAL MODE ACTIVE</span>
                            </div>
                            <p className="text-[10px] text-zinc-400 mt-1">
                              Specialist agent and model router selections are unlocked for manual control.
                            </p>
                          </div>

                          <button
                            onClick={() => {
                              setIsBossLocked(true);
                              setIsAgentMenuOpen(false);
                            }}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-bold shadow-sm transition"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Return to Boss Auto</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* WHEN LOCKED: Subtle [ 🔒 Auto Route ] Badge with Tooltip */}
                {isBossLocked && (
                  <div
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono text-zinc-400 bg-zinc-900/60 border border-zinc-800/60"
                    title="AXION selects the best available model automatically."
                  >
                    <Lock className="w-2.5 h-2.5 text-zinc-500" />
                    <span>Auto Route</span>
                  </div>
                )}

                {/* WHEN UNLOCKED: Expose Manual Specialist and Model Selectors */}
                {!isBossLocked && (
                  <>
                    {/* MANUAL SPECIALIST SELECTOR */}
                    <div className="relative">
                      <button
                        onClick={() => setIsPlusMenuOpen(false)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-850 hover:bg-zinc-800 text-zinc-200 border border-zinc-750 text-[11px] transition shadow-sm"
                      >
                        <span>{activeSpecialist?.avatar || '🤖'}</span>
                        <span className="truncate max-w-[120px] font-medium">{activeSpecialist?.name}</span>
                        <ChevronDown className="w-3 h-3 text-zinc-500" />
                      </button>
                    </div>

                    {/* MANUAL MODEL SELECTOR */}
                    <div className="relative" ref={modelMenuRef}>
                      <button
                        onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-850 hover:bg-zinc-800 text-zinc-200 border border-zinc-750 text-[11px] font-mono transition shadow-sm"
                        title="Model Router (Manual Override)"
                      >
                        <Zap className="w-3 h-3 text-emerald-400" />
                        <span className="truncate max-w-[110px]">{activeModel?.name}</span>
                        <span className="text-[10px] text-emerald-400">Free</span>
                        <ChevronDown className="w-3 h-3 text-zinc-500" />
                      </button>

                      {/* Model Popover */}
                      {isModelMenuOpen && (
                        <div className="absolute bottom-full left-0 mb-2 w-72 bg-[#141417] border border-zinc-800 rounded-xl shadow-2xl p-2 z-50 animate-in fade-in duration-100">
                          <div className="px-2 py-1 border-b border-zinc-800 flex items-center justify-between text-[10px] font-mono text-zinc-500 uppercase">
                            <span>Zero-Cost Model Route</span>
                            <span className="text-emerald-400">Guaranteed $0.00</span>
                          </div>
                          <div className="py-1 space-y-0.5">
                            {models.map((m) => {
                              const isSelected = m.id === activeModelId;
                              return (
                                <button
                                  key={m.id}
                                  onClick={() => {
                                    setActiveModelId(m.id);
                                    setIsModelMenuOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition text-xs ${
                                    isSelected
                                      ? 'bg-zinc-800 text-white font-medium'
                                      : 'text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200'
                                  }`}
                                >
                                  <div>
                                    <div className="font-mono text-xs">{m.name}</div>
                                    <div className="text-[10px] text-zinc-500">{m.provider} • Free Tier</div>
                                  </div>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-2" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
                <span>Diff Safety Gate Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
