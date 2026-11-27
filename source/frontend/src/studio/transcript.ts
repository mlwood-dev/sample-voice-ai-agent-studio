/** Normalize and merge call-history transcript turns for display. */

export interface ToolCall {
  name: string;
  args?: unknown;
  result?: unknown;
}

export interface RawTurn {
  turnIndex?: number;
  role?: string;
  text?: string;
  timestamp?: string;
  audioFile?: string;
  toolCalls?: ToolCall[];
  tool_calls?: ToolCall[];
  tools?: ToolCall[];
  is_final?: boolean;
  isFinal?: boolean;
  type?: string;
  [key: string]: unknown;
}

export type Speaker = 'user' | 'assistant';

export interface SpeechItem {
  kind: 'speech';
  id: string;
  role: Speaker;
  text: string;
  startMs: number;
  endMs?: number;
  audioFile?: string;
  toolCalls: ToolCall[];
  sourceIndexes: number[];
}

export interface TechnicalEvent {
  ts?: string;
  dir?: string;
  type: string;
  preview?: string;
  raw: Record<string, unknown>;
}

export const SUMMARY_PROMPT =
  "Provide a concise summary of this conversation including: the caller's intent, key actions taken, outcome, and any follow-up items.";

const MERGE_GAP_MS = 2000;

export function normalizeRole(role?: string): Speaker | 'other' {
  const r = (role || '').toLowerCase().trim();
  if (['user', 'human', 'caller', 'you', 'customer'].includes(r)) return 'user';
  if (['assistant', 'agent', 'ai', 'bot', 'model'].includes(r)) return 'assistant';
  return 'other';
}

export function parseTimestampMs(value?: string): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}m ${r.toString().padStart(2, '0')}s` : `${r}s`;
}

function asToolCalls(turn: RawTurn): ToolCall[] {
  const raw = turn.toolCalls || turn.tool_calls || turn.tools;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t): ToolCall | null => {
      if (!t || typeof t !== 'object') return null;
      const rec = t as ToolCall;
      const name = rec.name || (t as { tool?: string }).tool;
      if (!name) return null;
      return { name: String(name), args: rec.args, result: rec.result };
    })
    .filter((t): t is ToolCall => !!t);
}

function isInterim(turn: RawTurn): boolean {
  if (turn.is_final === false || turn.isFinal === false) return true;
  const typ = String(turn.type || '').toLowerCase();
  if (typ.includes('partial') || typ.includes('speculative') || typ.includes('interim')) return true;
  return false;
}

function isTechnicalTurn(turn: RawTurn): boolean {
  const typ = String(turn.type || '').toLowerCase();
  if (['system', 'debug', 'usage', 'metric', 'trace', 'log'].includes(typ)) return true;
  const role = String(turn.role || '').toLowerCase();
  if (['system', 'debug', 'usage'].includes(role)) return true;
  return false;
}

/** True if `next` is a duplicate or a longer rewrite of `prev` (typical Sonic partials). */
export function isRedundantFragment(prev: string, next: string): boolean {
  const a = prev.trim();
  const b = next.trim();
  if (!a || !b) return !b;
  if (a === b) return true;
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (na === nb) return true;
  if (nb.startsWith(na) || na.startsWith(nb)) return true;
  // Next is prev plus a short continuation already contained after stripping punctuation
  if (nb.includes(na) && nb.length - na.length < 8) return true;
  return false;
}

function normalizeForCompare(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').replace(/[.,!?;:'"]/g, '').trim();
}

function pickLonger(a: string, b: string): string {
  return b.trim().length >= a.trim().length ? b : a;
}

export function parseTranscriptPayload(raw: string): RawTurn[] {
  const text = raw.trim();
  if (!text) return [];
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return data as RawTurn[];
    if (data && Array.isArray(data.turns)) return data.turns as RawTurn[];
    if (data && Array.isArray(data.messages)) return data.messages as RawTurn[];
  } catch {
    // not a single JSON document — try JSONL
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const jsonl: RawTurn[] = [];
    let allJson = true;
    for (const line of lines) {
      try {
        jsonl.push(JSON.parse(line) as RawTurn);
      } catch {
        allJson = false;
        break;
      }
    }
    if (allJson && jsonl.length) return jsonl;
    return lines.map((line) => {
      const m = line.match(/^(user|agent|assistant|human|ai|caller|you)\s*[:\-]\s*(.*)$/i);
      if (m) return { role: m[1], text: m[2] };
      return { role: 'assistant', text: line };
    });
  }
  return [];
}

export function mergeTurns(rawTurns: RawTurn[], callStartedAt?: string): SpeechItem[] {
  const origin = parseTimestampMs(callStartedAt) ?? firstTimestamp(rawTurns) ?? 0;
  const items: SpeechItem[] = [];

  rawTurns.forEach((turn, index) => {
    if (isInterim(turn) || isTechnicalTurn(turn)) return;
    const role = normalizeRole(turn.role);
    const text = typeof turn.text === 'string' ? turn.text : '';
    const tools = asToolCalls(turn);
    if (!text.trim() && tools.length === 0) return;
    if (role === 'other' && !text.trim()) return;
    const speaker: Speaker = role === 'user' ? 'user' : 'assistant';
    const abs = parseTimestampMs(turn.timestamp);
    const prev = items[items.length - 1];
    const startMs = abs != null ? Math.max(0, abs - origin) : (prev?.endMs ?? prev?.startMs ?? 0);

    if (prev && prev.role === speaker) {
      const gap = startMs - (prev.endMs ?? prev.startMs);
      if (!text.trim()) {
        prev.toolCalls = [...prev.toolCalls, ...tools];
        prev.sourceIndexes.push(index);
        if (turn.audioFile) prev.audioFile = turn.audioFile;
        return;
      }
      if (isRedundantFragment(prev.text, text)) {
        prev.text = pickLonger(prev.text, text);
        prev.endMs = startMs;
        prev.sourceIndexes.push(index);
        prev.toolCalls = [...prev.toolCalls, ...tools];
        if (turn.audioFile) prev.audioFile = turn.audioFile;
        return;
      }
      if (gap <= MERGE_GAP_MS) {
        prev.text = `${prev.text.trim()} ${text.trim()}`.trim();
        prev.endMs = startMs;
        prev.sourceIndexes.push(index);
        prev.toolCalls = [...prev.toolCalls, ...tools];
        if (turn.audioFile) prev.audioFile = turn.audioFile;
        return;
      }
    }

    items.push({
      kind: 'speech',
      id: `t-${index}`,
      role: speaker,
      text: text.trim(),
      startMs,
      endMs: startMs,
      audioFile: turn.audioFile,
      toolCalls: tools,
      sourceIndexes: [index],
    });
  });

  return items;
}

function firstTimestamp(turns: RawTurn[]): number | null {
  for (const t of turns) {
    const ms = parseTimestampMs(t.timestamp);
    if (ms != null) return ms;
  }
  return null;
}

export function parseEvents(raw: string): TechnicalEvent[] {
  const events: TechnicalEvent[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line) as Record<string, unknown>;
      const type = String(rec.type || rec.event || 'event');
      const skipKeys = new Set(['audio', 'audio_data', 'data', 'chunk']);
      const previewBits: string[] = [];
      if (typeof rec.tool === 'string') previewBits.push(String(rec.tool));
      if (typeof rec.text === 'string') previewBits.push(`${String(rec.text).length} chars`);
      const compact: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rec)) {
        if (skipKeys.has(k)) {
          compact[k] = '[omitted]';
          continue;
        }
        compact[k] = v;
      }
      events.push({
        ts: typeof rec.ts === 'string' ? rec.ts : undefined,
        dir: typeof rec.dir === 'string' ? rec.dir : undefined,
        type,
        preview: previewBits.join(' · ') || undefined,
        raw: compact,
      });
    } catch {
      events.push({ type: 'unparsed', preview: `${line.length} chars`, raw: { line: line.slice(0, 200) } });
    }
  }
  return events;
}

export function collectTools(items: SpeechItem[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const t of item.toolCalls) {
      counts.set(t.name, (counts.get(t.name) || 0) + 1);
    }
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }));
}

export function toPlainTranscript(items: SpeechItem[]): string {
  return items
    .map((item) => {
      const who = item.role === 'user' ? 'You' : 'Agent';
      const tools = item.toolCalls.length
        ? `\n[Tools: ${item.toolCalls.map((t) => t.name).join(', ')}]`
        : '';
      return `${who} (${formatClock(item.startMs)}): ${item.text}${tools}`;
    })
    .join('\n\n');
}

export function turnAudioFileName(audioFile?: string): string | null {
  if (!audioFile) return null;
  const parts = audioFile.split('/');
  return parts[parts.length - 1] || null;
}
