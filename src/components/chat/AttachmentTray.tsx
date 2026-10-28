import React, {useRef, useState} from 'react';
import {Paperclip, X, FileText, Image as ImageIcon, FileArchive, FileSpreadsheet} from 'lucide-react';
import {readAttachment} from '../../utils/attachmentReader';
import {ATTACHMENT_LIMITS, validateAttachments, type Attachment} from '../../utils/visualInput';

/** Pending files for the next message: picker, paste and drag-and-drop all feed the same list. */
export function useAttachments() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setBusy(true); setError('');
    try {
      const read = await Promise.all(list.slice(0, ATTACHMENT_LIMITS.files).map(readAttachment));
      setAttachments(prev => {
        const next = [...prev, ...read].slice(0, ATTACHMENT_LIMITS.files);
        try { validateAttachments(next); } catch (e) { setError(e instanceof Error ? e.message : String(e)); return prev; }
        if (list.length + prev.length > ATTACHMENT_LIMITS.files) setError(`Only ${ATTACHMENT_LIMITS.files} files per message.`);
        return next;
      });
    } finally { setBusy(false); }
  };
  const remove = (index: number) => { setAttachments(prev => prev.filter((_, i) => i !== index)); setError(''); };
  const clear = () => { setAttachments([]); setError(''); };
  /** Paste images or files straight from the clipboard. */
  const onPaste = (e: React.ClipboardEvent) => { const files = Array.from(e.clipboardData.files || []); if (files.length) { e.preventDefault(); void addFiles(files); } };
  const onDrop = (e: React.DragEvent) => { if (e.dataTransfer.files.length) { e.preventDefault(); void addFiles(e.dataTransfer.files); } };
  return {attachments, busy, error, addFiles, remove, clear, onPaste, onDrop};
}

const icon = (a: Attachment) => a.mimeType.startsWith('image/') ? <ImageIcon size={12}/> : /zip/.test(a.mimeType) || /\.zip$/i.test(a.name) ? <FileArchive size={12}/> : /\.(xlsx|xlsm|csv)$/i.test(a.name) ? <FileSpreadsheet size={12}/> : <FileText size={12}/>;
const size = (n: number) => n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`;

export function AttachButton({onFiles, disabled}: {onFiles: (files: FileList) => void; disabled?: boolean}) {
  const input = useRef<HTMLInputElement>(null);
  return <>
    <button type="button" onClick={() => input.current?.click()} disabled={disabled} title="Attach files: images, PDF, Excel, Word, ZIP, code, text" aria-label="Attach files"
      className="p-1.5 rounded-lg transition mt-0.5 text-cyan-400/80 hover:text-[#00f0ff] hover:bg-cyan-500/20 disabled:opacity-30">
      <Paperclip className="w-4 h-4"/>
    </button>
    <input ref={input} type="file" multiple hidden onChange={e => { if (e.target.files) onFiles(e.target.files); e.target.value = ''; }}/>
  </>;
}

export function AttachmentChips({attachments, busy, error, onRemove}: {attachments: Attachment[]; busy: boolean; error: string; onRemove: (i: number) => void}) {
  if (!attachments.length && !busy && !error) return null;
  return <div className="flex flex-wrap items-center gap-1.5 pb-2">
    {attachments.map((a, i) => (
      <span key={`${a.name}-${i}`} title={a.data ? 'Sent to the model as a file' : a.text !== undefined ? 'Sent as extracted text' : 'Could not be read; only the name and size are sent'}
        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-mono max-w-[220px] ${a.data || a.text !== undefined ? 'border-cyan-500/30 text-cyan-200' : 'border-amber-500/40 text-amber-200'}`}>
        {icon(a)}<span className="truncate">{a.name}</span><span className="opacity-50">{size(a.size)}</span>
        <button type="button" onClick={() => onRemove(i)} aria-label={`Remove ${a.name}`} className="hover:text-white"><X size={11}/></button>
      </span>
    ))}
    {busy && <span className="text-[11px] text-cyan-300/70 font-mono">Reading files…</span>}
    {error && <span role="alert" className="text-[11px] text-amber-300">{error}</span>}
  </div>;
}
