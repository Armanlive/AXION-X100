/**
 * Turns a file Sir attaches in chat into something the model can read:
 * images and PDFs go as files (Gemini reads them natively); spreadsheets,
 * Word, PowerPoint, ZIP archives and any text/code are extracted to text;
 * anything else is passed by name and size only. Nothing is uploaded until
 * the message is sent, and nothing is stored in chat history.
 */
import {unzipSync, strFromU8} from 'fflate';
import type {Attachment} from './visualInput';

const TEXT_LIMIT = 60_000;          // per file
const ZIP_TEXT_LIMIT = 80_000;      // across one archive
const MAX_FILE_BYTES = 25_000_000;  // larger files are described, not read
const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|jsonl|xml|html?|css|scss|less|js|jsx|ts|tsx|mjs|cjs|py|rb|go|rs|java|kt|c|h|cpp|hpp|cs|php|swift|sql|sh|bash|ps1|bat|yaml|yml|toml|ini|cfg|conf|env\.example|log|gradle|dockerfile|gitignore|svg|tex|rst|vue|svelte)$/i;

const cap = (text: string, limit = TEXT_LIMIT) => text.length > limit ? `${text.slice(0, limit)}\n[… truncated, ${text.length - limit} more characters]` : text;
const decodeXml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
/** Text if the bytes look like UTF-8 text (no NULs, few replacement characters), else null. */
export function asText(bytes: Uint8Array): string | null {
  const sample = bytes.subarray(0, 8192);
  if (sample.includes(0)) return null;
  const text = new TextDecoder('utf-8', {fatal: false}).decode(bytes);
  const bad = (text.slice(0, 8192).match(/�/g) || []).length;
  return bad > 8 ? null : text;
}

/** Column letters → zero-based index ("AB" → 27). */
const colIndex = (ref: string) => [...ref.replace(/\d+/g, '')].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
const csvCell = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

/** .xlsx / .xlsm → one CSV block per sheet (values, not formulas). */
export function xlsxToText(bytes: Uint8Array): string {
  const files = unzipSync(bytes, {filter: f => /^xl\/(sharedStrings\.xml|workbook\.xml|worksheets\/sheet\d+\.xml)$/.test(f.name)});
  const shared = files['xl/sharedStrings.xml'] ? [...strFromU8(files['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => decodeXml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join(''))) : [];
  const names = files['xl/workbook.xml'] ? [...strFromU8(files['xl/workbook.xml']).matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map(m => decodeXml(m[1])) : [];
  const sheets = Object.keys(files).filter(n => /worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => +a.match(/(\d+)\.xml$/)![1] - +b.match(/(\d+)\.xml$/)![1]);
  const out: string[] = [];
  sheets.forEach((name, i) => {
    const rows: string[][] = [];
    for (const row of strFromU8(files[name]).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const c of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = c[1].match(/\br="([A-Z]+\d+)"/)?.[1]; const type = c[1].match(/\bt="(\w+)"/)?.[1];
        const raw = c[2]?.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? c[2]?.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? '';
        const value = type === 's' ? shared[+raw] ?? '' : decodeXml(raw);
        cells[ref ? colIndex(ref) : cells.length] = value;
      }
      rows.push(Array.from(cells, v => csvCell(v ?? '')));
    }
    out.push(`## Sheet: ${names[i] || `Sheet${i + 1}`}\n${rows.map(r => r.join(',')).join('\n')}`);
  });
  return out.join('\n\n') || '[Empty workbook]';
}

/** .docx → paragraphs of plain text. */
export function docxToText(bytes: Uint8Array): string {
  const files = unzipSync(bytes, {filter: f => f.name === 'word/document.xml'});
  const xml = files['word/document.xml'] ? strFromU8(files['word/document.xml']) : '';
  return [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map(p => decodeXml([...p[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map(t => t[1]).join(''))).filter(Boolean).join('\n') || '[No text found]';
}

/** .pptx → text per slide. */
export function pptxToText(bytes: Uint8Array): string {
  const files = unzipSync(bytes, {filter: f => /^ppt\/slides\/slide\d+\.xml$/.test(f.name)});
  return Object.keys(files).sort((a, b) => +a.match(/(\d+)\.xml$/)![1] - +b.match(/(\d+)\.xml$/)![1])
    .map((n, i) => `## Slide ${i + 1}\n${[...strFromU8(files[n]).matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(t => decodeXml(t[1])).join(' ')}`).join('\n\n') || '[No slide text found]';
}

/** .zip → file listing plus the contents of readable text files inside. */
export function zipToText(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const names = Object.keys(files).filter(n => !n.endsWith('/'));
  let budget = ZIP_TEXT_LIMIT; const parts = [`Archive with ${names.length} file(s):\n${names.slice(0, 300).map(n => `- ${n} (${files[n].length} bytes)`).join('\n')}${names.length > 300 ? `\n- … ${names.length - 300} more` : ''}`];
  for (const name of names) {
    if (budget <= 0) { parts.push('[More files not shown: text limit reached]'); break; }
    if (!TEXT_EXT.test(name) || /(^|\/)(node_modules|\.git)\//.test(name)) continue;
    const text = asText(files[name]); if (text === null) continue;
    const chunk = cap(text, Math.min(budget, 20_000)); budget -= chunk.length;
    parts.push(`### ${name}\n${chunk}`);
  }
  return parts.join('\n\n');
}

const extension = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '';
const toBase64 = (bytes: Uint8Array) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };

/** Re-encodes big or unusual images as a ≤2000px JPEG so they fit one request. */
async function imageToJpeg(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

/** Classifies by extension and content; never throws for an unreadable file (it is described instead). */
export async function readAttachment(file: File): Promise<Attachment> {
  const base = {name: file.name || 'pasted-file', size: file.size};
  const ext = extension(base.name);
  const mime = file.type || 'application/octet-stream';
  if (file.size > MAX_FILE_BYTES) return {...base, mimeType: mime};
  try {
    if (mime.startsWith('image/') && !/svg/.test(mime)) {
      const direct = /^image\/(jpeg|png|webp)$/.test(mime) && file.size <= 1_500_000;
      return direct ? {...base, mimeType: mime, data: toBase64(new Uint8Array(await file.arrayBuffer()))} : {...base, mimeType: 'image/jpeg', data: await imageToJpeg(file)};
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (ext === 'pdf' || mime === 'application/pdf') return {...base, mimeType: 'application/pdf', data: toBase64(bytes)};
    if (ext === 'xlsx' || ext === 'xlsm') return {...base, mimeType: mime, text: cap(xlsxToText(bytes))};
    if (ext === 'docx') return {...base, mimeType: mime, text: cap(docxToText(bytes))};
    if (ext === 'pptx') return {...base, mimeType: mime, text: cap(pptxToText(bytes))};
    if (ext === 'zip') return {...base, mimeType: 'application/zip', text: zipToText(bytes)};
    const text = asText(bytes);
    if (text !== null && (TEXT_EXT.test(base.name) || mime.startsWith('text/') || bytes.length < 2_000_000)) return {...base, mimeType: mime, text: cap(text)};
  } catch { /* fall through: describe by name and size */ }
  return {...base, mimeType: mime};
}
