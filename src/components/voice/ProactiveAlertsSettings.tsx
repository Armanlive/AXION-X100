import React, { useEffect, useState } from 'react';
import { loadAlertSettings, onAlertSettingsChange, saveAlertSettings, speakLocally, proactiveAlerts, mailAnnouncement, type AlertSettings } from '../../services/proactiveAlerts';

const Toggle: React.FC<{ on: boolean; onClick: () => void; label: string }> = ({ on, onClick, label }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick}
    className={`w-10 h-6 shrink-0 rounded-full transition-colors relative border border-cyan-500/30 ${on ? 'bg-cyan-600' : 'bg-zinc-800'}`}>
    <span className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${on ? 'left-5' : 'left-1'}`} />
  </button>
);

const list = (text: string) => text.split(',').map((s) => s.trim()).filter(Boolean);

/** Settings for spoken alerts: on/off, sources, VIP senders and urgent words. */
export const ProactiveAlertsSettings: React.FC = () => {
  const [s, setS] = useState<AlertSettings>(loadAlertSettings);
  const [vip, setVip] = useState(s.vipSenders.join(', '));
  const [keywords, setKeywords] = useState(s.keywords.join(', '));
  const [note, setNote] = useState('');
  useEffect(() => onAlertSettingsChange(setS), []);
  const save = (patch: Partial<AlertSettings>) => setS(saveAlertSettings(patch));
  const input = 'w-full bg-[#080d1a] border border-cyan-500/30 rounded-lg p-2 text-xs font-mono text-cyan-100 focus:outline-none focus:border-[#00f0ff]';

  const test = async () => {
    const sample = mailAnnouncement([{ id: 'test', from: 'Priya Sharma <priya@example.com>', subject: 'Urgent: dealer invoice approval', important: true, receivedMs: Date.now() }], s.title);
    setNote((await speakLocally(sample)) ? `Spoke: “${sample}”` : 'No local Windows voice could play. Add one in Settings → Time & language → Speech.');
  };
  const checkNow = async () => {
    setNote('Checking Gmail…');
    const urgent = await proactiveAlerts.checkMail();
    const err = proactiveAlerts.status.lastError;
    setNote(err ? err : urgent.length ? `Announced ${urgent.length} urgent message${urgent.length > 1 ? 's' : ''}.` : 'No new urgent mail.');
  };

  return (
    <div className="pt-2 border-t border-cyan-500/20 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-cyan-100">Proactive Voice Alerts</div>
          <div className="text-[10px] text-cyan-400/60">AXION speaks urgent events aloud with your PC's own voice. Free and local; no cloud speech.</div>
        </div>
        <Toggle on={s.enabled} onClick={() => save({ enabled: !s.enabled })} label="Proactive voice alerts" />
      </div>
      {s.enabled && (
        <div className="space-y-3 pl-1">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] text-cyan-200">Urgent Gmail (needs Gmail connected in Plugins)</div>
            <Toggle on={s.gmail} onClick={() => save({ gmail: !s.gmail })} label="Gmail alerts" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] text-cyan-200">Also mail Gmail marks Important</div>
            <Toggle on={s.gmailImportant} onClick={() => save({ gmailImportant: !s.gmailImportant })} label="Gmail important mail" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] text-cyan-200">System: low battery, internet lost/back</div>
            <Toggle on={s.system} onClick={() => save({ system: !s.system })} label="System alerts" />
          </div>
          <label className="block text-[10px] font-mono text-cyan-300/80">VIP senders (names or emails, comma separated)
            <input className={input} value={vip} placeholder="boss@company.com, Priya" onChange={(e) => setVip(e.target.value)} onBlur={() => save({ vipSenders: list(vip) })} />
          </label>
          <label className="block text-[10px] font-mono text-cyan-300/80">Urgent words in the subject
            <input className={input} value={keywords} onChange={(e) => setKeywords(e.target.value)} onBlur={() => save({ keywords: list(keywords) })} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[10px] font-mono text-cyan-300/80">Check every
              <select className={input} value={s.intervalMinutes} onChange={(e) => save({ intervalMinutes: Number(e.target.value) })}>
                {[2, 5, 10, 15, 30, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
            </label>
            <label className="block text-[10px] font-mono text-cyan-300/80">Call me
              <input className={input} defaultValue={s.title} onBlur={(e) => save({ title: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={test} className="px-3 py-1.5 rounded-lg text-[11px] font-mono border border-cyan-500/40 text-cyan-100 hover:bg-cyan-500/10">Test voice alert</button>
            <button type="button" onClick={checkNow} className="px-3 py-1.5 rounded-lg text-[11px] font-mono border border-cyan-500/40 text-cyan-100 hover:bg-cyan-500/10">Check Gmail now</button>
          </div>
          {note && <div className="text-[10px] text-cyan-300/80" role="status">{note}</div>}
        </div>
      )}
    </div>
  );
};
