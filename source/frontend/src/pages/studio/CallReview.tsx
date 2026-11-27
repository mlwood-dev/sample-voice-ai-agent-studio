import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { analyzeCallHistory, getCallSessionDetail, type CallSession, type CallSessionDetail } from '../../services/callHistoryApi';
import { useStudio } from '../../studio/StudioContext';
import {
  IconBack,
  IconCopy,
  IconDownload,
  IconPause,
  IconPlay,
  IconSearch,
  IconTool,
} from '../../studio/icons';
import {
  SUMMARY_PROMPT,
  collectTools,
  formatClock,
  formatDuration,
  mergeTurns,
  parseEvents,
  parseTranscriptPayload,
  toPlainTranscript,
  turnAudioFileName,
  type SpeechItem,
  type TechnicalEvent,
  type ToolCall,
} from '../../studio/transcript';
import styles from '../../studio/studio.module.css';

const SUMMARY_KEY = (id: string) => `studio.callSummary.${id}`;
const CLAMP_CHARS = 320;

function sourceLabel(source?: string) {
  const s = (source || '').toLowerCase();
  if (s.includes('tel') || s === 'pstn' || s === 'sip' || s.includes('phone')) return 'Phone call';
  if (s.includes('eval')) return 'Eval call';
  return 'Web call';
}

function outcomeLabel(reason?: string) {
  const r = (reason || '').replace(/_/g, ' ').trim();
  if (!r) return 'Ended';
  return r.charAt(0).toUpperCase() + r.slice(1);
}

function highlight(text: string, query: string) {
  if (!query.trim()) return text;
  const q = query.trim();
  const parts: Array<string | { mark: string }> = [];
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  let i = 0;
  while (i < text.length) {
    const hit = lower.indexOf(needle, i);
    if (hit === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (hit > i) parts.push(text.slice(i, hit));
    parts.push({ mark: text.slice(hit, hit + q.length) });
    i = hit + q.length;
  }
  return parts.map((p, idx) =>
    typeof p === 'string' ? <span key={idx}>{p}</span> : <mark key={idx} className={styles.mark}>{p.mark}</mark>,
  );
}

function ToolChips({ calls }: { calls: ToolCall[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!calls.length) return null;
  return (
    <div className={styles.toolRow}>
      {calls.map((call, i) => (
        <div key={`${call.name}-${i}`}>
          <button
            type="button"
            className={`${styles.toolChip} ${open === i ? styles.toolChipOpen : ''}`}
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
          >
            <IconTool size={14} /> {call.name}
          </button>
          {open === i && (
            <pre className={styles.toolDetail}>
              {JSON.stringify({ name: call.name, args: call.args ?? {}, result: call.result ?? '' }, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

function ClampedText({ text, query }: { text: string; query: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > CLAMP_CHARS;
  const shown = !long || open ? text : `${text.slice(0, CLAMP_CHARS).trim()}…`;
  return (
    <>
      <div className={styles.bubbleText}>{highlight(shown, query)}</div>
      {long && (
        <button type="button" className={styles.showMore} onClick={() => setOpen((v) => !v)}>
          {open ? 'Show less' : 'Show more'}
        </button>
      )}
    </>
  );
}

export interface CallReviewViewProps {
  agentName: string;
  session: CallSession;
  items: SpeechItem[];
  events: TechnicalEvent[];
  urls: CallSessionDetail['urls'];
  summary: string | null;
  summarizing: boolean;
  summaryError?: string | null;
  onSummarize: () => void;
  onBack: () => void;
}

export function CallReviewView({
  agentName,
  session,
  items,
  events,
  urls,
  summary,
  summarizing,
  summaryError,
  onSummarize,
  onBack,
}: CallReviewViewProps) {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [techOpen, setTechOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [playDur, setPlayDur] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const queueRef = useRef<{ id: string; url: string }[]>([]);
  const queuePos = useRef(0);
  const modeRef = useRef<'mix' | 'turns'>('turns');

  const tools = useMemo(() => collectTools(items), [items]);
  const plain = useMemo(() => toPlainTranscript(items), [items]);
  const turnUrl = (item: SpeechItem) => {
    const name = turnAudioFileName(item.audioFile);
    if (!name || !urls.turnAudio) return undefined;
    return urls.turnAudio[name];
  };
  const playableTurns = items.filter((i) => turnUrl(i));
  const canPlayTurns = playableTurns.length > 0;
  const mixUrl = urls.audio;
  const totalLabel = formatDuration(session.durationSeconds);

  const filtered = query.trim()
    ? items.filter((i) => i.text.toLowerCase().includes(query.trim().toLowerCase()) || i.toolCalls.some((t) => t.name.toLowerCase().includes(query.trim().toLowerCase())))
    : items;
  const matchCount = query.trim()
    ? items.reduce((n, i) => n + (i.text.toLowerCase().split(query.trim().toLowerCase()).length - 1), 0)
    : 0;

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const stopAudio = () => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    setPlaying(false);
    setActiveId(null);
    setElapsed(0);
  };

  const playUrl = (url: string, id: string | null, mode: 'mix' | 'turns') => {
    modeRef.current = mode;
    let el = audioRef.current;
    if (!el) {
      el = new Audio();
      audioRef.current = el;
      el.addEventListener('timeupdate', () => setElapsed(el!.currentTime));
      el.addEventListener('durationchange', () => setPlayDur(el!.duration || 0));
      el.addEventListener('ended', () => {
        if (modeRef.current === 'turns') {
          queuePos.current += 1;
          const next = queueRef.current[queuePos.current];
          if (next) {
            setActiveId(next.id);
            itemRefs.current[next.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el!.src = next.url;
            void el!.play();
            return;
          }
        }
        setPlaying(false);
        setActiveId(null);
      });
    }
    el.src = url;
    setActiveId(id);
    if (id) itemRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  const playConversation = () => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
      return;
    }
    if (audioRef.current && audioRef.current.src && audioRef.current.paused && elapsed > 0) {
      void audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      return;
    }
    if (canPlayTurns) {
      const queue = playableTurns.map((i) => ({ id: i.id, url: turnUrl(i)! }));
      queueRef.current = queue;
      queuePos.current = 0;
      playUrl(queue[0].url, queue[0].id, 'turns');
      return;
    }
    if (mixUrl) playUrl(mixUrl, null, 'mix');
  };

  const onScrub = (value: number) => {
    if (audioRef.current) audioRef.current.currentTime = value;
    setElapsed(value);
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* ignore */ }
  };

  const downloadText = () => {
    const blob = new Blob([plain], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `call-${session.sessionId.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const started = new Date(session.startedAt);
  const when = started.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const title = `${sourceLabel(session.source)} · ${when}`;
  const hasAudio = canPlayTurns || !!mixUrl;
  const displayDur = playDur > 0 ? playDur : (canPlayTurns ? 0 : session.durationSeconds);
  const audioHint = canPlayTurns
    ? 'Playing each turn in order — the current line is highlighted.'
    : mixUrl
      ? 'This recording is the agent’s speech only. Per-turn timing isn’t aligned to it.'
      : 'No recording is available for this call.';

  const summaryCard = (
    <section className={styles.summaryCard}>
      <div className={styles.summaryHead}>
        <h2 className={styles.heading}>Summary</h2>
        <span className={styles.meta}>Analyze · Summary</span>
      </div>
      {summary ? (
        <p className={styles.body}>{summary}</p>
      ) : (
        <p className={styles.muted}>No saved summary yet. Generate one from the conversation.</p>
      )}
      {summaryError && <p className={styles.error}>{summaryError}</p>}
      <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnBlock}`} style={{ marginTop: 12 }} disabled={summarizing || items.length === 0} onClick={onSummarize}>
        {summarizing ? 'Summarizing…' : summary ? 'Refresh summary' : 'Summarize'}
      </button>
      <dl className={styles.metaList}>
        <div><dt>Duration</dt><dd>{totalLabel}</dd></div>
        <div><dt>Turns</dt><dd>{items.length}</dd></div>
        <div><dt>Outcome</dt><dd>{outcomeLabel(session.endReason)}</dd></div>
        <div>
          <dt>Tools used</dt>
          <dd>{tools.length ? tools.map((t) => `${t.name}${t.count > 1 ? ` ×${t.count}` : ''}`).join(', ') : 'None'}</dd>
        </div>
      </dl>
    </section>
  );

  const transcriptPane = (
    <section className={styles.reviewTranscript}>
      <div className={styles.pageHead}>
        <h2 className={styles.heading}>Transcript</h2>
        <div className={styles.reviewActions}>
          <button type="button" className={styles.iconBtn} aria-label="Search transcript" onClick={() => setSearchOpen((v) => !v)}><IconSearch /></button>
          <button type="button" className={styles.iconBtn} aria-label="Copy transcript" onClick={() => void copyText()}><IconCopy /></button>
          <button type="button" className={styles.iconBtn} aria-label="Download transcript" onClick={downloadText}><IconDownload /></button>
        </div>
      </div>
      {searchOpen && (
        <div className={styles.searchRow}>
          <input className={styles.input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this call" autoFocus />
          {query.trim() && <span className={styles.muted}>{matchCount} match{matchCount === 1 ? '' : 'es'}</span>}
        </div>
      )}
      {copied && <div className={styles.toast} role="status">Transcript copied</div>}
      {filtered.length === 0 && <p className={styles.muted}>{query ? 'No lines match that search.' : 'No transcript is available for this call.'}</p>}
      <div className={styles.reviewLog} role="log">
        {filtered.map((item) => (
          <div
            key={item.id}
            ref={(el) => { itemRefs.current[item.id] = el; }}
            className={`${styles.reviewBubble} ${item.role === 'user' ? styles.reviewYou : styles.reviewAgent} ${activeId === item.id ? styles.reviewActive : ''}`}
          >
            <div className={styles.bubbleMeta}>
              {item.role === 'user' ? 'You' : 'Agent'}
              <span className={styles.bubbleTime}>{formatClock(item.startMs)}</span>
            </div>
            <ClampedText text={item.text} query={query} />
            <ToolChips calls={item.toolCalls} />
          </div>
        ))}
      </div>
    </section>
  );

  const techPane = (
    <details className={styles.techDetails} open={techOpen} onToggle={(e) => setTechOpen((e.target as HTMLDetailsElement).open)}>
      <summary>Show technical details</summary>
      {events.length === 0 && <p className={styles.muted}>No event log was stored for this call.</p>}
      {events.length > 0 && (
        <ol className={styles.techList}>
          {events.map((ev, i) => (
            <li key={i}>
              <div className={styles.techLine}>
                <span className={styles.meta}>{ev.dir || 'event'}</span>
                <strong>{ev.type}</strong>
                {ev.ts && <span className={styles.muted}>{new Date(ev.ts).toLocaleTimeString()}</span>}
              </div>
              {ev.preview && <div className={styles.muted}>{ev.preview}</div>}
              <details>
                <summary>Raw JSON</summary>
                <pre className={styles.toolDetail}>{JSON.stringify(ev.raw, null, 2)}</pre>
              </details>
            </li>
          ))}
        </ol>
      )}
    </details>
  );

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button type="button" className={styles.iconBtn} aria-label="Back to calls" onClick={onBack}><IconBack /></button>
        <h1 className={styles.heading}>Call review</h1>
        <span style={{ width: 48 }} />
      </div>
      <header className={styles.reviewHeader}>
        <h2 className={styles.title} style={{ fontSize: 22, lineHeight: '30px' }}>{title}</h2>
        <p className={styles.muted}>
          {agentName} · {totalLabel} · {items.length} {items.length === 1 ? 'turn' : 'turns'} · {outcomeLabel(session.endReason)}
          {session.callerId ? ` · ${session.callerId}` : ''}
        </p>
      </header>

      <div className={styles.audioDock}>
        <button type="button" className={styles.playBtn} aria-label={playing ? 'Pause' : 'Play'} disabled={!hasAudio} onClick={playConversation}>
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(displayDur, 0.1)}
          step={0.1}
          value={Math.min(elapsed, displayDur || elapsed)}
          onChange={(e) => onScrub(Number(e.target.value))}
          disabled={!hasAudio}
          aria-label="Playback position"
          className={styles.scrubber}
        />
        <span className={styles.audioTime}>{formatClock(elapsed * 1000)} / {displayDur ? formatClock(displayDur * 1000) : totalLabel.replace('m ', ':').replace('s', '')}</span>
      </div>
      <p className={styles.audioHint}>{audioHint}</p>

      <div className={styles.reviewLayout}>
        <div>
          <div className={styles.summaryMobile}>{summaryCard}</div>
          {transcriptPane}
          <div className={styles.reviewMainTech}>{techPane}</div>
        </div>
        <aside className={styles.reviewSide}>
          {summaryCard}
          {techPane}
        </aside>
      </div>
    </div>
  );
}

function CallReview() {
  const { sessionId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { selectedAgentId, selectedAgent, agents } = useStudio();
  const [detail, setDetail] = useState<CallSessionDetail | null>(null);
  const [agentName, setAgentName] = useState(selectedAgent?.name || 'Agent');
  const [items, setItems] = useState<SpeechItem[]>([]);
  const [events, setEvents] = useState<TechnicalEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      try {
        const cached = sessionStorage.getItem(SUMMARY_KEY(sessionId));
        if (cached) setSummary(cached);
      } catch { /* ignore */ }
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    const hinted = params.get('agent') || selectedAgentId;
    const ids = [...new Set([hinted, ...agents.map((a) => a.id)].filter(Boolean) as string[])];

    const run = async () => {
      setError(null);
      let lastErr: Error | null = null;
      for (const agentId of ids.length ? ids : []) {
        try {
          const d = await getCallSessionDetail(sessionId, agentId);
          if (cancelled) return;
          setDetail(d);
          const name = agents.find((a) => a.id === agentId)?.name;
          if (name) setAgentName(name);
          if (d.urls?.transcript) {
            const res = await fetch(d.urls.transcript);
            const raw = await res.text();
            if (cancelled) return;
            const merged = mergeTurns(parseTranscriptPayload(raw), d.session.startedAt);
            setItems(merged);
          } else {
            setItems([]);
          }
          if (d.urls?.events) {
            try {
              const evRes = await fetch(d.urls.events);
              const evRaw = await evRes.text();
              if (!cancelled) setEvents(parseEvents(evRaw));
            } catch {
              if (!cancelled) setEvents([]);
            }
          } else {
            setEvents([]);
          }
          return;
        } catch (e) {
          lastErr = e instanceof Error ? e : new Error('Could not load this call');
        }
      }
      if (!cancelled) setError(ids.length ? (lastErr?.message || 'Could not load this call') : 'Select an agent to open this call.');
    };
    void run();
    return () => { cancelled = true; };
  }, [sessionId, selectedAgentId, agents, params]);

  const onSummarize = async () => {
    if (!items.length || !sessionId) return;
    setSummarizing(true);
    setSummaryError(null);
    try {
      const res = await analyzeCallHistory(toPlainTranscript(items), SUMMARY_PROMPT);
      setSummary(res.analysis);
      try { sessionStorage.setItem(SUMMARY_KEY(sessionId), res.analysis); } catch { /* ignore */ }
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : 'Summary failed');
    } finally {
      setSummarizing(false);
    }
  };

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.topBar}>
          <button type="button" className={styles.iconBtn} aria-label="Back" onClick={() => navigate('/calls')}><IconBack /></button>
          <h1 className={styles.heading}>Call review</h1>
          <span />
        </div>
        <p className={styles.error}>{error}</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className={styles.page}>
        <div className={styles.topBar}>
          <button type="button" className={styles.iconBtn} aria-label="Back" onClick={() => navigate('/calls')}><IconBack /></button>
          <h1 className={styles.heading}>Call review</h1>
          <span />
        </div>
        <p className={styles.muted}>Loading call…</p>
      </div>
    );
  }

  return (
    <CallReviewView
      agentName={agentName}
      session={detail.session}
      items={items}
      events={events}
      urls={detail.urls}
      summary={summary}
      summarizing={summarizing}
      summaryError={summaryError}
      onSummarize={() => void onSummarize()}
      onBack={() => navigate('/calls')}
    />
  );
}

export default CallReview;
