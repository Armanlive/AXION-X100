import React, { useState } from 'react';
import { useAxionStore } from '../store/useAxionStore';
import { Agent } from '../types';
import {
  Users,
  Plus,
  Search,
  Cpu,
  Check,
  X,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Info,
  Sliders,
  ExternalLink,
  Bot
} from 'lucide-react';

export const AgentLab: React.FC = () => {
  const {
    agents,
    createCustomAgent,
    selectedAgentId,
    setSelectedAgentId,
    setIsManualMode,
    setCurrentTab
  } = useAxionStore();

  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [inspectingAgent, setInspectingAgent] = useState<Agent | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New Custom Agent Form State
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentDesc, setNewAgentDesc] = useState('');
  const [newAgentPrompt, setNewAgentPrompt] = useState('');
  const [newAgentCategory, setNewAgentCategory] = useState('CODING');
  const [newAgentModel, setNewAgentModel] = useState('Gemini 2.0 Flash (Free)');
  const [newAgentAvatar, setNewAgentAvatar] = useState('🤖');

  const categories = [
    'ALL',
    'CODING',
    'COMMAND',
    'RESEARCH',
    'WRITING',
    'STRATEGY',
    'QUALITY',
    'DATA',
    'VISUAL',
    'MEDIA',
    'PRODUCTIVITY',
    'CUSTOM'
  ];

  const filteredAgents = agents.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      a.description.toLowerCase().includes(searchFilter.toLowerCase()) ||
      a.category.toLowerCase().includes(searchFilter.toLowerCase()) ||
      a.badge.toLowerCase().includes(searchFilter.toLowerCase());

    const matchesCategory =
      selectedCategory === 'ALL' ||
      (selectedCategory === 'CUSTOM' ? a.isCustom : a.category.toUpperCase() === selectedCategory);

    return matchesSearch && matchesCategory;
  });

  const handleCreateAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentName.trim()) return;

    createCustomAgent({
      name: newAgentName.trim(),
      description: newAgentDesc.trim(),
      systemPrompt: newAgentPrompt.trim() || 'You are an autonomous AXION specialist agent.',
      preferredModel: newAgentModel,
      category: newAgentCategory as any,
      avatar: newAgentAvatar || '🤖',
      badge: 'CUST',
      isCustom: true
    });

    setIsCreateModalOpen(false);
    setNewAgentName('');
    setNewAgentDesc('');
    setNewAgentPrompt('');
  };

  const handleChatWithAgent = (agent: Agent) => {
    if (agent.id === 'boss-agent') {
      setIsManualMode(false);
      setSelectedAgentId('boss-agent');
    } else {
      setIsManualMode(true);
      setSelectedAgentId(agent.id);
    }
    setCurrentTab('workspace');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0b0c] text-zinc-100 overflow-hidden select-none">
      {/* Top Header */}
      <div className="p-6 bg-[#0e0e11] border-b border-zinc-800/80 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 uppercase tracking-widest mb-1">
              <Users className="w-3.5 h-3.5 text-zinc-400" />
              <span>SPECIALISTS REGISTRY</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-3">
              <span>100 SPECIALISTS</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                {agents.length} Total Registered
              </span>
            </h1>
            <p className="text-xs text-zinc-400 mt-1 max-w-xl leading-relaxed">
              Autonomous and manual specialist agents for full-stack engineering, security audits, diff verification, and system architecture.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search specialists, tags, roles..."
                className="w-56 sm:w-64 pl-9 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-750 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-sans"
              />
            </div>

            {/* Create Custom Agent Button */}
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Custom Agent</span>
            </button>
          </div>
        </div>

        {/* Category Tabs Filter */}
        <div className="max-w-7xl mx-auto flex items-center gap-1.5 overflow-x-auto pt-4 no-scrollbar">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            const count = agents.filter((a) =>
              cat === 'ALL'
                ? true
                : cat === 'CUSTOM'
                ? a.isCustom
                : a.category.toUpperCase() === cat
            ).length;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition shrink-0 flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-zinc-800 text-white font-semibold border-zinc-650 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/60 border-transparent'
                }`}
              >
                <span>{cat}</span>
                <span className="text-[10px] text-zinc-500">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Specialist Cards Multi-Column Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          {filteredAgents.length === 0 ? (
            <div className="py-20 text-center text-zinc-500 space-y-2">
              <Bot className="w-8 h-8 mx-auto text-zinc-600" />
              <p className="text-sm">No specialists found matching "{searchFilter}"</p>
              <button
                onClick={() => {
                  setSearchFilter('');
                  setSelectedCategory('ALL');
                }}
                className="text-xs text-zinc-400 hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredAgents.map((agent) => {
                const isActiveInChat =
                  (agent.id === 'boss-agent' && !useAxionStore.getState().isManualMode) ||
                  (agent.id === selectedAgentId && useAxionStore.getState().isManualMode);

                return (
                  <div
                    key={agent.id}
                    className={`rounded-2xl border p-4 flex flex-col justify-between transition-all duration-150 relative group ${
                      isActiveInChat
                        ? 'bg-[#15151a] border-zinc-600 shadow-lg shadow-black/30 ring-1 ring-zinc-500/30'
                        : 'bg-[#121215] border-zinc-800/80 hover:border-zinc-700 hover:bg-[#151518]'
                    }`}
                  >
                    <div>
                      {/* Top Meta Row */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-lg shadow-sm">
                            {agent.avatar}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-850 text-zinc-400 border border-zinc-750">
                                {agent.badge}
                              </span>
                              <span className="text-[10px] font-mono uppercase text-zinc-500">
                                {agent.category}
                              </span>
                            </div>
                            <h3 className="font-semibold text-xs text-zinc-100 mt-0.5 truncate max-w-[150px]">
                              {agent.name}
                            </h3>
                          </div>
                        </div>

                        {isActiveInChat ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 shrink-0 mt-1" title="Currently Active in Chat" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-zinc-700 shrink-0 mt-1" />
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-3 mb-3">
                        {agent.description}
                      </p>

                      {/* Preferred Model Tag */}
                      <div className="text-[10px] font-mono text-zinc-500 flex items-center gap-1 mb-4 truncate">
                        <Cpu className="w-3 h-3 text-zinc-600 shrink-0" />
                        <span className="truncate">{agent.preferredModel}</span>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/60">
                      <button
                        onClick={() => handleChatWithAgent(agent)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition ${
                          isActiveInChat
                            ? 'bg-zinc-800 text-white border border-zinc-650'
                            : 'bg-zinc-850 hover:bg-zinc-800 text-zinc-200 border border-zinc-750 hover:text-white'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{isActiveInChat ? 'Active in Chat' : 'Chat with Agent'}</span>
                      </button>

                      <button
                        onClick={() => setInspectingAgent(agent)}
                        className="p-1.5 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-750 transition"
                        title="Inspect Agent System Prompt & Parameters"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Inspect Agent Details */}
      {inspectingAgent && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-zinc-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in duration-150">
            <div className="p-4 bg-[#16161a] border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{inspectingAgent.avatar}</span>
                <div>
                  <h3 className="text-sm font-semibold text-white font-mono">
                    {inspectingAgent.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
                    <span>Badge: {inspectingAgent.badge}</span>
                    <span>•</span>
                    <span>Category: {inspectingAgent.category}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setInspectingAgent(null)}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-1">
                  ROLE & MISSION
                </label>
                <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/60 p-3 rounded-xl border border-zinc-800">
                  {inspectingAgent.description}
                </p>
              </div>

              <div>
                <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-1">
                  SYSTEM PROMPT & SPECIALIZED DIRECTIVES
                </label>
                <div className="bg-[#09090b] p-3 rounded-xl border border-zinc-800/80 font-mono text-xs text-zinc-300 max-h-48 overflow-y-auto leading-relaxed">
                  {inspectingAgent.systemPrompt}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="text-[10px] text-zinc-500">PREFERRED MODEL</div>
                  <div className="text-zinc-200 mt-0.5 truncate">{inspectingAgent.preferredModel}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
                  <div className="text-[10px] text-zinc-500">STATUS</div>
                  <div className="text-emerald-400 mt-0.5 font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Ready</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setInspectingAgent(null)}
                  className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    handleChatWithAgent(inspectingAgent);
                    setInspectingAgent(null);
                  }}
                  className="px-4 py-1.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs transition shadow-sm"
                >
                  Select for Chat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Custom Agent */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121215] border border-zinc-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in duration-150">
            <div className="p-3.5 bg-[#16161a] border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-100 font-mono">
                <Plus className="w-4 h-4 text-zinc-300" />
                <span>Create Custom Specialist Agent</span>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleCreateAgent} className="p-4 space-y-3">
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Agent Name:
                </label>
                <input
                  type="text"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="e.g. Tailwind Polish Specialist"
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 font-mono"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                    Avatar Emoji:
                  </label>
                  <input
                    type="text"
                    value={newAgentAvatar}
                    onChange={(e) => setNewAgentAvatar(e.target.value)}
                    placeholder="e.g. 🎨"
                    className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                    Category:
                  </label>
                  <select
                    value={newAgentCategory}
                    onChange={(e) => setNewAgentCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:border-zinc-500 font-mono"
                  >
                    <option value="CODING">CODING</option>
                    <option value="QUALITY">QUALITY</option>
                    <option value="STRATEGY">STRATEGY</option>
                    <option value="RESEARCH">RESEARCH</option>
                    <option value="WRITING">WRITING</option>
                    <option value="DATA">DATA</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Role Description:
                </label>
                <input
                  type="text"
                  value={newAgentDesc}
                  onChange={(e) => setNewAgentDesc(e.target.value)}
                  placeholder="e.g. Refactors components to match strict design tokens"
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 mb-1">
                  System Prompt:
                </label>
                <textarea
                  value={newAgentPrompt}
                  onChange={(e) => setNewAgentPrompt(e.target.value)}
                  placeholder="Enter custom instructions and domain constraints..."
                  rows={3}
                  className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-none font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newAgentName.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 hover:bg-white text-zinc-950 disabled:opacity-40 transition shadow-sm"
                >
                  Register Specialist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
