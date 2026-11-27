import {
  isRedundantFragment,
  mergeTurns,
  parseTranscriptPayload,
  toPlainTranscript,
  formatClock,
  type RawTurn,
} from './transcript';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const growing: RawTurn[] = [
  { role: 'user', text: 'Are you', timestamp: '2026-01-01T00:00:00.000Z' },
  { role: 'user', text: 'Are you open', timestamp: '2026-01-01T00:00:00.200Z' },
  { role: 'user', text: 'Are you open Sunday?', timestamp: '2026-01-01T00:00:00.400Z' },
  { role: 'assistant', text: 'Yes', timestamp: '2026-01-01T00:00:02.000Z' },
  { role: 'assistant', text: 'Yes, we are open Sunday.', timestamp: '2026-01-01T00:00:02.400Z' },
];

const merged = mergeTurns(growing, '2026-01-01T00:00:00.000Z');
assert(merged.length === 2, `expected 2 bubbles, got ${merged.length}`);
assert(merged[0].role === 'user', 'first should be user');
assert(merged[0].text === 'Are you open Sunday?', 'kept longest user fragment');
assert(merged[1].text === 'Yes, we are open Sunday.', 'kept longest assistant fragment');
assert(formatClock(merged[0].startMs) === '0:00', 'clock start');
assert(formatClock(merged[1].startMs) === '0:02', 'clock assistant');

const dups: RawTurn[] = [
  { role: 'user', text: 'Hello there', timestamp: '2026-01-01T00:00:00Z' },
  { role: 'user', text: 'Hello there', timestamp: '2026-01-01T00:00:00.1Z' },
  { role: 'user', text: '', timestamp: '2026-01-01T00:00:00.2Z' },
  { role: 'assistant', text: 'Hi', is_final: false, timestamp: '2026-01-01T00:00:01Z' },
  { role: 'assistant', text: 'Hi, how can I help?', timestamp: '2026-01-01T00:00:01.2Z' },
];
const m2 = mergeTurns(dups, '2026-01-01T00:00:00Z');
assert(m2.length === 2, `dups+interim expected 2, got ${m2.length}`);
assert(m2[0].text === 'Hello there', 'dropped empty and exact dups');
assert(m2[1].text === 'Hi, how can I help?', 'dropped interim');

assert(isRedundantFragment('Hello', 'Hello world'), 'prefix is redundant');
assert(isRedundantFragment('Hello world', 'hello world'), 'case/punct');
assert(!isRedundantFragment('Book Tuesday.', 'Are you open Sunday?'), 'distinct utterances');

const later: RawTurn[] = [
  { role: 'assistant', text: 'I can help with that.', timestamp: '2026-01-01T00:00:00Z' },
  { role: 'assistant', text: 'Anything else?', timestamp: '2026-01-01T00:00:08Z' },
];
const m3 = mergeTurns(later, '2026-01-01T00:00:00Z');
assert(m3.length === 2, 'distinct same-speaker far apart stay separate');

const close: RawTurn[] = [
  { role: 'assistant', text: 'Hello.', timestamp: '2026-01-01T00:00:00Z' },
  { role: 'assistant', text: 'How can I help?', timestamp: '2026-01-01T00:00:00.4Z' },
];
const m4 = mergeTurns(close, '2026-01-01T00:00:00Z');
assert(m4.length === 1, 'close consecutive fragments merge');
assert(m4[0].text.includes('Hello') && m4[0].text.includes('How can I help'), 'concatenated');

const tools: RawTurn[] = [
  { role: 'assistant', text: 'Let me check.', toolCalls: [{ name: 'calendar', args: { day: 'Tue' }, result: 'open' }], timestamp: '2026-01-01T00:00:00Z' },
];
const m5 = mergeTurns(tools);
assert(m5[0].toolCalls.length === 1 && m5[0].toolCalls[0].name === 'calendar', 'tools preserved');

const wrapped = JSON.stringify({ sessionId: 'x', turns: growing });
assert(parseTranscriptPayload(wrapped).length === growing.length, 'json turns wrapper');

const plain = 'User: Hi\nAgent: Hello';
const parsed = parseTranscriptPayload(plain);
assert(parsed.length === 2 && parsed[0].role === 'User', 'plain text fallback');

const text = toPlainTranscript(m2);
assert(text.includes('You (0:00):') && text.includes('Agent (0:01):'), 'plain export labels');

console.log('transcript tests passed', {
  growing: merged.length,
  dups: m2.length,
  far: m3.length,
  close: m4.length,
});
