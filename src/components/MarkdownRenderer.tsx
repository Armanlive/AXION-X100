import React, { useState } from 'react';
import { Copy, Check, Terminal, FileCode } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="space-y-2.5 text-[13px] leading-relaxed text-[#e4e4e7] font-normal selection:bg-zinc-700 selection:text-white">
      {renderBlocks(content)}
    </div>
  );
};

function renderBlocks(content: string): React.ReactNode[] {
  const blocks: React.ReactNode[] = [];
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Multi-line code block: ```lang ... ```
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim() || 'code';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const fullCode = codeLines.join('\n');
      blocks.push(
        <CodeBlockItem key={`code-${i}`} code={fullCode} language={lang} />
      );
      continue;
    }

    // Heading 3: ###
    if (line.startsWith('### ')) {
      blocks.push(
        <h3 key={`h3-${i}`} className="text-sm font-semibold text-[#f4f4f5] tracking-tight pt-1">
          {renderInline(line.replace('### ', ''))}
        </h3>
      );
      i++;
      continue;
    }

    // Heading 2: ##
    if (line.startsWith('## ')) {
      blocks.push(
        <h2 key={`h2-${i}`} className="text-sm font-bold text-[#f4f4f5] tracking-tight pt-1.5 pb-0.5 border-b border-zinc-800">
          {renderInline(line.replace('## ', ''))}
        </h2>
      );
      i++;
      continue;
    }

    // Heading 1: #
    if (line.startsWith('# ')) {
      blocks.push(
        <h1 key={`h1-${i}`} className="text-base font-bold text-white tracking-tight pt-2">
          {renderInline(line.replace('# ', ''))}
        </h1>
      );
      i++;
      continue;
    }

    // Blockquote: >
    if (line.startsWith('> ')) {
      blocks.push(
        <div key={`quote-${i}`} className="border-l-2 border-zinc-600 pl-3 py-0.5 my-1 text-zinc-400 italic text-[12px] bg-zinc-900/40 rounded-r">
          {renderInline(line.replace('> ', ''))}
        </div>
      );
      i++;
      continue;
    }

    // Bullet points: * or -
    if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('* ') || lines[i].trim().startsWith('- '))) {
        listItems.push(lines[i].trim().replace(/^[\*\-]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="space-y-1 my-1.5 pl-4 list-disc marker:text-zinc-500">
          {listItems.map((item, idx) => (
            <li key={idx} className="text-zinc-300 text-[13px]">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Empty lines
    if (!line.trim()) {
      blocks.push(<div key={`blank-${i}`} className="h-1.5" />);
      i++;
      continue;
    }

    // Standard paragraph
    blocks.push(
      <p key={`p-${i}`} className="leading-relaxed">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return blocks;
}

// Inline formatting: bold, italic, inline code
function renderInline(text: string): React.ReactNode {
  // Regex to match inline code `code`, bold **text**, and italic *text*
  const parts: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 rounded bg-zinc-800/90 text-zinc-200 font-mono text-[11px] border border-zinc-700/60"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={match.index} className="italic text-zinc-300">
          {token.slice(1, -1)}
        </em>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

// Clean Code Block with copy action
const CodeBlockItem: React.FC<{ code: string; language: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2.5 rounded-lg border border-zinc-800 bg-[#0c0c0e] overflow-hidden text-xs font-mono shadow-sm">
      {/* Code Block Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#141417] border-b border-zinc-800/80 text-[11px] text-zinc-400">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3 h-3 text-zinc-500" />
          <span className="font-mono lowercase text-zinc-400 font-medium">{language}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
          title="Copy code snippet"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="text-[10px]">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <div className="p-3 overflow-x-auto text-[12px] leading-relaxed text-zinc-300 select-text">
        <pre className="whitespace-pre font-mono">{code}</pre>
      </div>
    </div>
  );
};
