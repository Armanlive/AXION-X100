import React, { useState } from 'react';
import { useAxionStore } from '../store/useAxionStore';
import { Agent } from '../types';
import {
  Users,
  Plus,
  Bot,
  Sparkles,
  Shield,
  Cpu,
  Check,
  Search,
  Wrench,
  BookOpen
} from 'lucide-react';

export const AgentLab: React.FC = () => {
  const { agents, createCustomAgent } = useAxionStore();
  const [selectedAgent, setSelectedAgent] = useState<Agent>(agents[0]);
  const [searchFilter, setSearchFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Custom Agent Form State
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentDesc, setNewAgentDesc] = useState('');
  const [newAgentPrompt, setNewAgentPrompt] = useState('');
  const [newAgentModel, setNewAgentModel] = useState('Gemini 2.0 Flash (Free)');

  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      a.description.toLowerCase().includes(searchFilter.toLowerCase()) ||
      a.category.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleCreateAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentName.trim()) return;

    createCustomAgent({
      name: newAgentName,
      description: newAgentDesc,
      systemPrompt: newAgentPrompt,
      preferredModel: newAgentModel,
      avatar: '🤖'
    });

    setIsModalOpen(false);
    setNewAgentName('');
    setNewAgentDesc('');
    setNewAgentPrompt('');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0f1d] overflow-hidden select-none">
      {/* Top Banner */}
      <div className="p-4 bg-[#0d1424] border-b border-[#1b263b] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            17 Specialist Agents Registry & Agent Lab
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Pre-configured specialist roles for autonomous delegation, planning, and verification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search specialists..."
              className="pl-8 pr-3 py-1.5 rounded-lg bg-[#121a2d] border border-[#23334e] text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Create Custom Agent
          </button>
        </div>
      </div>

      {/* Main Grid & Detail Pane */}
      <div className="flex-1 flex overflow-hidden">
        {/* Agent Cards Column */}
        <div className="w-1/2 p-4 overflow-y-auto space-y-2.5 border-r border-[#1a253a]">
          {filteredAgents.map((agent) => {
            const isSelected = selectedAgent.id === agent.id;
            return (
              <div
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start justify-between gap-3 ${
                  isSelected
                    ? 'bg-blue-600/10 border-blue-500/50 shadow-md'
                    : 'bg-[#0f172a] border-[#1e2c45] hover:border-slate-600 hover:bg-[#131d33]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#17223b] border border-[#263757] flex items-center justify-center text-lg shrink-0">
                    {agent.avatar}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-white">{agent.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {agent.badge}
                      </span>
                      {agent.isCustom && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          Custom
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {agent.description}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    ● Ready
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {agent.category}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Agent Inspector */}
        <div className="w-1/2 p-6 overflow-y-auto bg-[#0b1120] space-y-6">
          <div className="flex items-start justify-between pb-4 border-b border-[#1b273d]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#141f36] border border-[#273a61] flex items-center justify-center text-2xl shadow-sm">
                {selectedAgent.avatar}
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  {selectedAgent.name}
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {selectedAgent.badge}
                  </span>
                </h3>
                <p className="text-xs text-slate-400 capitalize">
                  Category: {selectedAgent.category}
                </p>
              </div>
            </div>

            <span className="text-xs font-mono px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Active in Sandbox
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold block mb-1.5">
                Core Responsibility
              </label>
              <p className="text-xs text-slate-200 leading-relaxed bg-[#0f172a] p-3 rounded-xl border border-[#202f4a]">
                {selectedAgent.description}
              </p>
            </div>

            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold block mb-1.5 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-sky-400" />
                Preferred Free Model Engine
              </label>
              <div className="text-xs font-mono text-blue-300 bg-[#0f172a] p-3 rounded-xl border border-[#202f4a] flex items-center justify-between">
                <span>{selectedAgent.preferredModel}</span>
                <span className="text-[10px] text-emerald-400 font-semibold">$0.00 Free Tier</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold block mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                System Prompt Directives
              </label>
              <pre className="text-xs font-mono text-slate-300 bg-[#090e1a] p-4 rounded-xl border border-[#1b263b] whitespace-pre-wrap leading-relaxed select-text">
                {selectedAgent.systemPrompt}
              </pre>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                Protected under Boss Agent safety policies. Cannot perform disk writes without user diff approval.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Create Custom Agent Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateAgent}
            className="bg-[#0f172a] border border-[#263756] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#1f2e4a]">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-400" />
                Register Custom Specialist Agent
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Agent Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tailwind Modernizer, Microservices Guard"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#131d33] border border-[#223352] text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="What is this specialist's role in the workspace?"
                  value={newAgentDesc}
                  onChange={(e) => setNewAgentDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#131d33] border border-[#223352] text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  System Prompt Directives
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Define operational guardrails, coding style, or verification standards..."
                  value={newAgentPrompt}
                  onChange={(e) => setNewAgentPrompt(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#131d33] border border-[#223352] text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Preferred Model
                </label>
                <select
                  value={newAgentModel}
                  onChange={(e) => setNewAgentModel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#131d33] border border-[#223352] text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="Gemini 2.0 Flash (Free)">Gemini 2.0 Flash (Free Zero-Cost)</option>
                  <option value="Meta Llama 3.3 70B (Free)">Meta Llama 3.3 70B (OpenRouter Free)</option>
                  <option value="Qwen 2.5 Coder 14B (Local)">Qwen 2.5 Coder 14B (Ollama Local)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1f2e4a]">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition"
              >
                Register Agent
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
