import {ResponseActions} from './ResponseActions';
import { VoiceEngine } from '../utils/voiceEngine';
import React, { useState, useRef, useEffect } from 'react';
import { useAxionStore } from '../store/useAxionStore';
import { DiffViewer } from './DiffViewer';
import { VoiceAudioWaveform } from './VoiceAudioWaveform';
import { MarkdownRenderer } from './MarkdownRenderer';
import { AxionLivingCore } from './voice/AxionLivingCore';
import { CentralPanelHeader } from './CentralPanelHeader';
import { AxionHologramRing } from './AxionHologramRing';
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
  Lock,
  Paperclip
} from 'lucide-react';
import {AttachButton, AttachmentChips, useAttachments} from './chat/AttachmentTray';
import {NewSessionCard, useNewSessionPrompt} from './chat/NewSessionPrompt';
import {ChatCoreRail} from './chat/ChatCoreRail';

export const WorkspaceChat: React.FC = () => {
  const [voiceInputError,setVoiceInputError]=useState('');
  const {
    messages,
    executeUserPrompt,
    isWorking,
    speechState,
    setSpeechState,
    setSpeechMode,
    triggerBuildErrorDemo,
    requestCheckFix,
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
    activeWorkspaceId,
    bindActiveChatToWorkspace
  } = useAxionStore();

  const [inputVal, setInputVal] = useState('');
  /** Words being dictated right now, before the recognizer settles on them. */
  const [dictationPreview, setDictationPreview] = useState('');
  const files = useAttachments();
  const newSession = useNewSessionPrompt();
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

  // Persistent project-to-chat binding: opening the Chat view (or switching the active
  // workspace while it is open) always binds the current session to that workspace.
  useEffect(() => {
    bindActiveChatToWorkspace();
  }, [activeWorkspaceId, bindActiveChatToWorkspace]);

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
    if ((!inputVal.trim() && !files.attachments.length) || isWorking || files.busy || newSession.pending) return;
    // Sending ends dictation, so later speech doesn't land in the next message.
    if (isRecording) { chatVoice.current?.stopListening(); setIsRecording(false); setSpeechState('idle'); setDictationPreview(''); }
    const prompt = inputVal.trim() || (files.attachments.length === 1 ? `Take a look at ${files.attachments[0].name}.` : 'Take a look at these files.');
    const attachments = files.attachments.length ? files.attachments : undefined;
    // An unrelated task in a project thread is held until the user picks New session / Keep here.
    if (!newSession.offer({ prompt, attachments })) executeUserPrompt(prompt, false, undefined, attachments);
    files.clear();
    setInputVal('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // Re-runs the user turn at or before `index`, dropping it and everything after so the reply is regenerated.
  const retryFrom = (index: number) => {
    if (isWorking) return;
    let u = index;
    while (u >= 0 && messages[u].sender !== 'user') u--;
    if (u < 0) return;
    const prompt = messages[u].text;
    useAxionStore.setState({ messages: messages.slice(0, u) });
    executeUserPrompt(prompt);
  };

  const previousUserText = (index: number) => {
    for (let u = index - 1; u >= 0; u--) if (messages[u].sender === 'user') return messages[u].text;
    return '';
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

  const chatVoice = useRef<VoiceEngine | null>(null);
  useEffect(() => () => { chatVoice.current?.destroy(); }, []);
  const toggleRecording = () => {
    if (isRecording) {
      chatVoice.current?.stopListening(); setIsRecording(false); setSpeechState('idle'); setDictationPreview(''); return;
    }
    setVoiceInputError('');
    chatVoice.current?.destroy();
    // Dictation: what you say is written into the message box (like typing), where you can
    // edit it and press Send. Nothing is sent, and no new chat starts, until you do.
    const engine = new VoiceEngine({
      onStateChange: state => { if (state !== 'thinking') { setSpeechState(state); setIsRecording(state === 'listening'); } },
      onTranscript: (text, final) => {
        if (!final) { setDictationPreview(text); return; }
        setDictationPreview('');
        const spoken = text.trim();
        if (spoken) setInputVal(prev => (prev && !/\s$/.test(prev) ? `${prev} ${spoken}` : `${prev}${spoken}`));
        // Keep listening for the next sentence until the mic is switched off.
        setTimeout(() => { if (chatVoice.current === engine) engine.completeTurn(); }, 0);
      },
      onError: error => { setIsRecording(false); setDictationPreview(''); setVoiceInputError(error); }
    });
    chatVoice.current = engine;
    engine.configure({...useAxionStore.getState().voiceSettings, listeningMode: 'continuous'}, false);
    engine.startListening();
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
      label: '🎤 Voice Refactor',
      prompt: 'Make the dashboard header more compact and move the date to the right side',
      isVoice: true
    },
    {
      label: 'Explain Project Architecture',
      prompt: 'Explain the main App component of this project and its dependencies'
    },
    {
      label: 'Create StatsCard Component',
      prompt: 'Create a new StatsCard component with glowing trend metrics'
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
    <div className="axion-chat flex-1 flex flex-col h-full bg-[#050508] overflow-hidden relative">
      {/* Upgraded Central AI Chat / Voice Panel Header with Live AXION Holographic Visualizer */}
      <CentralPanelHeader
        isRecording={isRecording}
        onToggleVoiceRecording={toggleRecording}
        onOpenModelMenu={() => setIsModelMenuOpen(true)}
        onOpenAgentMenu={() => setIsAgentMenuOpen(true)}
      />

      {voiceInputError && (
        <p role="alert" className="px-4 py-2 text-xs text-rose-300 bg-rose-950/40 border-b border-rose-500/30 flex items-center justify-between">
          <span>{voiceInputError}</span>
          <button onClick={() => setVoiceInputError('')} className="underline hover:text-white">Dismiss</button>
        </p>
      )}

      {hasMessages && <ChatCoreRail />}

      {/* Messages Scroll Area OR Empty Chat Landing Hero */}
      {hasMessages ? (
        <div className="axion-active-messages flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6 max-w-3xl lg:max-w-4xl w-full mx-auto cyber-grid-bg">
          {messages.map((msg, index) => {
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
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs mt-1 shadow-sm ${
                      isSystem
                        ? 'bg-amber-950/60 text-amber-400 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                        : 'bg-[#081020] text-[#00f0ff] border border-cyan-500/35 shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                    }`}
                  >
                    {isSystem ? <AlertTriangle className="w-3.5 h-3.5" /> : <span aria-label="Supreme Core" role="img">👑</span>}
                  </div>
                )}

                {/* Message Content Container */}
                <div
                  className={`flex flex-col space-y-1.5 max-w-[88%] sm:max-w-[82%] ${
                    isUser ? 'items-end' : 'items-start flex-1'
                  }`}
                >
                  {/* Meta Header */}
                  <div className="flex items-center gap-2 text-[11px] text-cyan-300/60 font-mono px-0.5">
                    <span className="font-semibold text-cyan-200">
                      {isUser ? 'You' : isSystem?'System':'AXION'}
                    </span>
                    <span>{msg.timestamp}</span>
                    {msg.voiceTranscript && (
                      <span className="px-2 py-0.5 rounded-full bg-cyan-950/70 text-[#00f0ff] border border-cyan-500/40 text-[10px] flex items-center gap-1 font-mono">
                        <Mic className="w-2.5 h-2.5 text-[#00f0ff] animate-pulse" />
                        Voice Input ({msg.voiceTranscript.language})
                      </span>
                    )}
                  </div>

                  {/* Message Body */}
                  {isUser ? (
                    <div className="p-4 rounded-2xl bg-[#0c182c]/90 text-cyan-50 text-sm leading-relaxed border border-cyan-500/35 shadow-[0_0_20px_rgba(0,240,255,0.08)] backdrop-blur-sm">
                      {msg.attachments?.length ? (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {msg.attachments.map((a, i) => (
                            <span key={i} className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 px-1.5 py-0.5 text-[11px] font-mono text-cyan-200 max-w-[220px]">
                              <Paperclip className="w-3 h-3 shrink-0" /><span className="truncate">{a.name}</span>
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="whitespace-pre-wrap font-sans">{msg.text}</div>
                    </div>
                  ) : (
                    <div className="w-full space-y-3">
                      {!!msg.reasoningSteps?.length && (
                        <div role="status" aria-live="polite" className="px-4 py-2 rounded-xl border border-cyan-500/20 text-xs text-cyan-200 space-y-1">
                          {msg.reasoningSteps.slice(-4).map((step, i) => (
                            <div key={`${step.agent}-${i}`}>
                              <span aria-hidden="true">{step.status === 'pending' ? '⏳' : '✓'} </span>
                              {step.action}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Formatted Markdown Body */}
                      <div className="p-4 rounded-2xl bg-[#070b16]/85 border border-cyan-500/20 shadow-[0_4px_24px_rgba(0,0,0,0.6)] backdrop-blur-md">
                        {msg.text.trim() ? (
                          <MarkdownRenderer content={msg.text} />
                        ) : (
                          <div className="flex items-center gap-2 text-xs font-mono text-cyan-300/80 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff]" />
                            {isWorking ? 'Thinking…' : 'No reply was received.'}
                          </div>
                        )}
                      </div>

                      {/* Proposed AST Diff Gate Card */}
                      {msg.proposedDiff && (
                        <div className="rounded-xl border border-cyan-500/30 bg-[#080e1c] overflow-hidden shadow-[0_0_25px_rgba(0,240,255,0.1)]">
                          <div className="p-3 bg-[#0a1224] border-b border-cyan-500/25 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-md bg-cyan-950/80 text-[#00f0ff] border border-cyan-500/30">
                                <GitCompare className="w-4 h-4 text-[#00f0ff]" />
                              </div>
                              <div>
                                <div className="text-xs font-mono font-semibold text-white flex items-center gap-2">
                                  <span>{msg.proposedDiff.filePath}</span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                                    {msg.proposedDiff.taskId}
                                  </span>
                                </div>
                                <div className="text-[11px] text-cyan-300/80 mt-0.5">
                                  {msg.proposedDiff.summary}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleDiffExpand(msg.id)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0e1930] hover:bg-[#142344] text-cyan-200 border border-cyan-500/30 text-xs font-medium transition"
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
                                    className="px-2.5 py-1 rounded-md border border-rose-500/40 bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 text-xs font-medium transition"
                                  >
                                    Reject
                                  </button>
                                  <button
                                    onClick={() => approveDiff(msg.proposedDiff!.id)}
                                    className="px-3 py-1 rounded-md bg-[#00f0ff] hover:bg-[#38bdf8] text-[#050508] text-xs font-bold shadow-[0_0_15px_rgba(0,240,255,0.4)] transition"
                                  >
                                    Approve
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Expandable full diff inline */}
                          {isDiffExpanded && (
                            <div className="p-2 border-t border-cyan-500/20 bg-[#060a14]">
                              <DiffViewer diff={msg.proposedDiff} />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Native Build Status Card */}
                      {msg.buildStatus && (
                        <div className="p-3 rounded-xl bg-[#080d1a] border border-cyan-500/25 flex items-center justify-between my-1 shadow-[0_0_15px_rgba(0,240,255,0.06)]">
                          <div className="flex items-center gap-2">
                            {msg.buildStatus === 'passed' ? (
                              <CheckCircle className="w-4 h-4 text-[#00f0ff]" />
                            ) : msg.buildStatus === 'building' ? (
                              <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-rose-400" />
                            )}
                            <span className="text-xs font-mono text-cyan-200">
                              Project checks:{' '}
                              <strong
                                className={
                                  msg.buildStatus === 'passed'
                                    ? 'text-[#00f0ff]'
                                    : msg.buildStatus === 'building'
                                    ? 'text-cyan-300'
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
                                onClick={() => void requestCheckFix(msg.id)}
                                disabled={isWorking}
                                className="flex items-center gap-1 px-2.5 py-1 bg-cyan-950/80 hover:bg-cyan-900/80 text-cyan-200 border border-cyan-500/40 rounded-lg text-xs font-medium transition disabled:opacity-50"
                              >
                                <Wrench className="w-3 h-3 text-cyan-400" />
                                Fix it
                              </button>
                              <button
                                onClick={() => setCurrentTab('terminal')}
                                className="flex items-center gap-1 px-2 py-1 bg-[#0a1224] hover:bg-[#0e1930] text-cyan-300 hover:text-white rounded-lg text-xs border border-cyan-500/20 transition"
                              >
                                <Terminal className="w-3 h-3" />
                                Logs
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {msg.buildStatus === 'failed' && msg.buildErrorLogs && (
                        <details className="rounded-xl border border-rose-500/25 bg-[#0b0a12] text-xs">
                          <summary className="cursor-pointer px-3 py-2 text-rose-300/90 font-mono">Error output</summary>
                          <pre className="max-h-72 overflow-auto px-3 pb-3 whitespace-pre-wrap font-mono text-[11px] text-rose-100/80">{msg.buildErrorLogs}</pre>
                        </details>
                      )}
                    </div>
                  )}

                  {isUser&&<ResponseActions isUser text={msg.text} onRetry={isWorking?undefined:()=>retryFrom(index)}/>}
                  {!isUser&&!isSystem&&!!msg.text.trim()&&<ResponseActions text={msg.text} ecc={msg.ecc} durationMs={msg.durationMs} onRetry={isWorking?undefined:()=>retryFrom(index)} shareText={`Me: ${previousUserText(index)}

AXION: ${msg.text}`} onSpeak={()=>handleToggleSpeak(msg.id,msg.text)}/>}

                </div>

                {/* Right Avatar for User */}
                {isUser && (
                  <div className="w-7 h-7 rounded-lg bg-cyan-950/90 text-cyan-300 border border-cyan-500/40 flex items-center justify-center shrink-0 text-xs mt-1 shadow-[0_0_10px_rgba(0,240,255,0.2)]">
                    <User className="w-4 h-4 text-cyan-200" />
                  </div>
                )}
              </div>
            );
          })}

          {newSession.pending && (
            <NewSessionCard
              pending={newSession.pending}
              onNewSession={newSession.startNewSession}
              onKeepHere={newSession.keepHere}
            />
          )}

          <div ref={messagesEndRef} />
        </div>
      ) : (
        /* ==================================================
           AXION HOLOGRAPHIC AI DESKTOP CHAT HERO
           ================================================== */
        <div className="axion-welcome flex-1 flex flex-col items-center justify-center px-4 overflow-y-auto max-w-2xl w-full mx-auto text-center my-auto">
          {/* Live AXION Holographic Kinetic Pulse Visualizer Hero */}
          <div className="relative py-2 flex items-center justify-center">
            <AxionLivingCore
              state={speechState === 'speaking' ? 'speaking' : isWorking ? 'thinking' : isRecording ? 'listening' : 'idle'}
              size="welcome"
            />
          </div>

          {/* Clean Typography */}
          <div className="space-y-2 mt-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-[10px] font-mono font-semibold text-[#00f0ff] tracking-widest uppercase shadow-[0_0_12px_rgba(0,240,255,0.2)]">
              <Sparkles className="w-3 h-3 text-[#00f0ff]" />
              <span>QUANTUM HOLOGRAPHIC CORE // AXION-X100</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Local Intelligence. Engineering Velocity.
            </h1>
            <p className="text-xs sm:text-sm text-cyan-200/70 max-w-md mx-auto leading-relaxed">
              Your local workspace. Ask a question or start an interactive voice conversation with live AST review gates.
            </p>
          </div>

          {/* Three Focused Quick Action Cards */}
          <div className="axion-welcome-actions w-full text-left pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => setCurrentTab('local_workspace')}
              className="p-3.5 rounded-2xl bg-[#080d1a]/80 border border-cyan-500/25 hover:border-cyan-400/60 hover:bg-[#0c1426] hover:shadow-[0_0_20px_rgba(0,240,255,0.2)] transition-all group flex flex-col justify-between min-h-[88px] backdrop-blur-md"
            >
              <div className="flex items-center justify-between w-full">
                <Folder className="w-4 h-4 text-[#00f0ff]" />
                <ArrowUp className="w-3 h-3 text-cyan-500/60 group-hover:text-[#00f0ff] rotate-45 transition" />
              </div>
              <div className="mt-2">
                <div className="text-xs font-semibold text-white group-hover:text-[#00f0ff] transition">
                  Open Workspace
                </div>
                <div className="text-[11px] text-cyan-300/60 truncate mt-0.5 font-mono">
                  {activeWorkspace ? activeWorkspace.name : 'Mount directory'}
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setInputVal('Analyze this project architecture and check for build issues.');
                textareaRef.current?.focus();
              }}
              className="p-3.5 rounded-2xl bg-[#080d1a]/80 border border-cyan-500/25 hover:border-cyan-400/60 hover:bg-[#0c1426] hover:shadow-[0_0_20px_rgba(0,240,255,0.2)] transition-all group flex flex-col justify-between min-h-[88px] backdrop-blur-md"
            >
              <div className="flex items-center justify-between w-full">
                <Sparkles className="w-4 h-4 text-[#00f0ff]" />
                <ArrowUp className="w-3 h-3 text-cyan-500/60 group-hover:text-[#00f0ff] rotate-45 transition" />
              </div>
              <div className="mt-2">
                <div className="text-xs font-semibold text-white group-hover:text-[#00f0ff] transition">
                  Ask AXION
                </div>
                <div className="text-[11px] text-cyan-300/60 truncate mt-0.5 font-mono">
                  Engineering prompt
                </div>
              </div>
            </button>

            <button
              onClick={() => setSpeechMode('speech')}
              className="p-3.5 rounded-2xl bg-[#080d1a]/80 border border-cyan-500/25 hover:border-cyan-400/60 hover:bg-[#0c1426] hover:shadow-[0_0_20px_rgba(0,240,255,0.2)] transition-all group flex flex-col justify-between min-h-[88px] backdrop-blur-md"
            >
              <div className="flex items-center justify-between w-full">
                <Mic className="w-4 h-4 text-[#00f0ff]" />
                <ArrowUp className="w-3 h-3 text-cyan-500/60 group-hover:text-[#00f0ff] rotate-45 transition" />
              </div>
              <div className="mt-2">
                <div className="text-xs font-semibold text-white group-hover:text-[#00f0ff] transition">
                  Voice Mode
                </div>
                <div className="text-[11px] text-cyan-300/60 truncate mt-0.5 font-mono">
                  Live vocal coding
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ==================================================
         4. SUPREME CORE & CHAT COMPOSER (HOLOGRAPHIC AXION GLOW)
         ================================================== */}
      <div className="p-4 bg-gradient-to-t from-[#050508] via-[#050508]/95 to-transparent shrink-0">
        <div className="max-w-3xl lg:max-w-4xl mx-auto space-y-2">
          {/* Active Voice Waveform Pill */}
          <div className="flex justify-center">
            <VoiceAudioWaveform isActive={isRecording} state={speechState} />
          </div>

          {/* Composer Box */}
          <div onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }} onDrop={files.onDrop} className="bg-[#070c18]/90 backdrop-blur-xl border border-cyan-500/30 hover:border-cyan-400/50 rounded-2xl p-3 shadow-[0_4px_30px_rgba(0,0,0,0.7)] transition-all focus-within:border-[#00f0ff] focus-within:ring-1 focus-within:ring-cyan-500/30 focus-within:shadow-[0_0_25px_rgba(0,240,255,0.2)]">
            <AttachmentChips attachments={files.attachments} busy={files.busy} error={files.error} onRemove={files.remove} />
            {/* Input Row */}
            <div className="flex items-start gap-2.5">
              {/* Plus Menu Button */}
              <div className="relative" ref={plusMenuRef}>
                <button
                  onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
                  className="p-1.5 rounded-lg text-cyan-400/80 hover:text-[#00f0ff] hover:bg-cyan-500/20 transition mt-0.5"
                  title="Quick prompt presets"
                >
                  <Plus className="w-4 h-4" />
                </button>

                {isPlusMenuOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-[#080e1c] border border-cyan-500/35 rounded-xl shadow-2xl p-1 z-50 animate-in fade-in duration-100">
                    <div className="px-2.5 py-1 text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-semibold">
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
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-cyan-100 hover:bg-cyan-950/60 hover:text-[#00f0ff] transition flex items-center justify-between font-mono"
                      >
                        <span className="truncate">{qp.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <AttachButton onFiles={(list) => void files.addFiles(list)} disabled={isWorking} />

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={inputVal}
                onChange={handleInputResize}
                onKeyDown={handleKeyDown}
                onPaste={files.onPaste}
                rows={1}
                placeholder={
                  isRecording
                    ? 'Listening... speak in any language'
                    : 'Ask AXION anything, in any language (e.g. "Scan this project for bugs")...'
                }
                className="flex-1 bg-transparent text-sm text-[#e2f1fd] placeholder-cyan-300/40 focus:outline-none resize-none max-h-36 leading-relaxed font-sans pt-0.5"
              />
              {dictationPreview && (
                <span aria-live="polite" className="self-center max-w-[40%] truncate text-xs italic text-cyan-300/60">{dictationPreview}…</span>
              )}

              {/* Voice Microphone Toggle */}
              <button
                onClick={toggleRecording}
                className={`p-1.5 rounded-lg transition mt-0.5 ${
                  isRecording
                    ? 'bg-[#00f0ff] text-[#050508] shadow-[0_0_15px_rgba(0,240,255,0.7)] animate-pulse'
                    : 'text-cyan-400/80 hover:text-[#00f0ff] hover:bg-cyan-500/20'
                }`}
                title="Toggle voice input"
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Send Button */}
              <button
                onClick={handleSend}
                disabled={(!inputVal.trim() && !files.attachments.length) || isWorking || files.busy}
                className="w-7 h-7 rounded-full bg-[#00f0ff] hover:bg-[#38bdf8] text-[#050508] disabled:opacity-20 disabled:hover:bg-[#00f0ff] flex items-center justify-center transition shadow-[0_0_12px_rgba(0,240,255,0.4)] font-bold mt-0.5 shrink-0"
                title="Send Prompt (Enter)"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Composer Footer: Holographic Supreme Core & Model Router Interaction */}
            <div className="pt-2 mt-2 border-t border-cyan-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                {/* SUPREME CORE CONTROL BUTTON */}
                <div className="relative" ref={agentMenuRef}>
                  {isBossLocked ? (
                    /* LOCKED AUTONOMOUS MODE (DEFAULT) */
                    <button
                      onClick={() => setIsAgentMenuOpen(!isAgentMenuOpen)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0a1224] hover:bg-[#0e1932] text-white border border-cyan-500/35 text-[11px] font-mono transition shadow-[0_0_10px_rgba(0,240,255,0.1)]"
                      title="Supreme Core Autonomous Orchestration is Active (Click to configure)"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] shadow-[0_0_6px_#00f0ff]" />
                      <span>Supreme Core</span>
                      <span className="text-[9px] font-mono font-semibold text-[#00f0ff] bg-cyan-950/60 border border-cyan-500/30 px-1 py-0.2 rounded">AUTO</span>
                    </button>
                  ) : (
                    /* UNLOCKED MANUAL CONTROL */
                    <button
                      onClick={() => setIsAgentMenuOpen(!isAgentMenuOpen)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-950/40 hover:bg-amber-900/40 text-amber-300 border border-amber-500/40 text-[11px] font-mono transition shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                      title="Manual Mode Unlocked (Click to return to Boss Auto)"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span>Supreme Core</span>
                      <span className="text-[9px] font-mono font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1 py-0.2 rounded">MANUAL</span>
                    </button>
                  )}

                  {/* POPOVER FOR SUPREME CORE */}
                  {isAgentMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-72 bg-[#080e1c] border border-cyan-500/40 rounded-2xl shadow-[0_0_30px_rgba(0,240,255,0.25)] p-3 z-50 animate-in fade-in duration-100 backdrop-blur-xl">
                      {isBossLocked ? (
                        /* Popover when Locked */
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 pb-2 border-b border-cyan-500/20">
                            <span className="text-base">👑</span>
                            <div>
                              <div className="text-xs font-bold text-white tracking-tight font-mono">SUPREME CORE (AUTONOMOUS)</div>
                              <div className="text-[10px] text-cyan-300/70 font-mono">Rule-based specialist matching is active.</div>
                            </div>
                          </div>

                          <div className="space-y-1.5 py-1 text-[11px] text-cyan-100 font-sans">
                            <div className="flex items-center gap-2 text-[#00f0ff]">
                              <Check className="w-3.5 h-3.5 shrink-0" />
                              <span>Rule-based specialist matching</span>
                            </div>
                            <div className="flex items-center gap-2 text-[#00f0ff]">
                              <Check className="w-3.5 h-3.5 shrink-0" />
                              <span>Selects zero-cost model tier</span>
                            </div>
                            <div className="flex items-center gap-2 text-[#00f0ff]">
                              <Check className="w-3.5 h-3.5 shrink-0" />
                              <span>Read-only workspace context</span>
                            </div>
                            <div className="flex items-center gap-2 text-cyan-400/50">
                              <span className="w-3.5 h-3.5 flex items-center justify-center text-[10px]">•</span>
                              <span className="italic">Native terminal execution gated</span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-cyan-500/20">
                            <button
                              onClick={() => {
                                setIsBossLocked(false);
                                setIsAgentMenuOpen(false);
                              }}
                              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-amber-300 text-xs font-mono border border-amber-500/40 transition shadow-sm"
                            >
                              <span>🔓</span>
                              <span>Unlock Manual Control</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Popover when Unlocked */
                        <div className="space-y-3">
                          <div className="pb-2 border-b border-cyan-500/20">
                            <div className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                              <span>🔓</span>
                              <span>MANUAL MODE ACTIVE</span>
                            </div>
                            <p className="text-[10px] text-cyan-300/70 mt-1 font-mono">
                              Specialist agent and model router selections are unlocked for manual control.
                            </p>
                          </div>

                          <button
                            onClick={() => {
                              setIsBossLocked(true);
                              setIsAgentMenuOpen(false);
                            }}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#00f0ff] hover:bg-[#38bdf8] text-[#050508] text-xs font-bold font-mono shadow-[0_0_15px_rgba(0,240,255,0.4)] transition"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Return to Boss Auto</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* WHEN LOCKED: Subtle [ 🔒 Auto Route ] Badge */}
                {isBossLocked && (
                  <div
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono text-cyan-300/70 bg-[#0a1224]/60 border border-cyan-500/25"
                    title="AXION selects the best available model automatically."
                  >
                    <Lock className="w-2.5 h-2.5 text-cyan-400" />
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
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0a1224] hover:bg-[#0e1932] text-cyan-200 border border-cyan-500/30 text-[11px] font-mono transition shadow-sm"
                      >
                        <span>{activeSpecialist?.avatar || '🤖'}</span>
                        <span className="truncate max-w-[120px] font-medium">{activeSpecialist?.name}</span>
                        <ChevronDown className="w-3 h-3 text-cyan-400" />
                      </button>
                    </div>

                    {/* MANUAL MODEL SELECTOR */}
                    <div className="relative" ref={modelMenuRef}>
                      <button
                        onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0a1224] hover:bg-[#0e1932] text-cyan-200 border border-cyan-500/30 text-[11px] font-mono transition shadow-sm"
                        title="Model Router (Manual Override)"
                      >
                        <Zap className="w-3 h-3 text-[#00f0ff]" />
                        <span className="truncate max-w-[110px]">{activeModel?.name}</span>
                        <span className="text-[10px] text-[#00f0ff] font-bold">Free</span>
                        <ChevronDown className="w-3 h-3 text-cyan-400" />
                      </button>

                      {/* Model Popover */}
                      {isModelMenuOpen && (
                        <div className="absolute bottom-full left-0 mb-2 w-72 bg-[#080e1c] border border-cyan-500/40 rounded-2xl shadow-[0_0_30px_rgba(0,240,255,0.25)] p-2 z-50 animate-in fade-in duration-100 backdrop-blur-xl">
                          <div className="px-2 py-1 border-b border-cyan-500/20 flex items-center justify-between text-[10px] font-mono text-cyan-400 uppercase">
                            <span>Zero-Cost Model Route</span>
                            <span className="text-[#00f0ff] font-bold">Guaranteed $0.00</span>
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
                                      ? 'bg-cyan-950/80 text-[#00f0ff] font-medium border border-cyan-500/30 shadow-[0_0_10px_rgba(0,240,255,0.15)]'
                                      : 'text-cyan-300 hover:bg-[#0c162c] hover:text-white'
                                  }`}
                                >
                                  <div>
                                    <div className="font-mono text-xs">{m.name}</div>
                                    <div className="text-[10px] text-cyan-400/60 font-mono">{m.provider} • Free Tier</div>
                                  </div>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-[#00f0ff] shrink-0 ml-2" />}
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
              <div className="flex items-center gap-2 text-cyan-400/70 text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] shadow-[0_0_6px_#00f0ff]" />
                <span>Diff Safety Gate Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
