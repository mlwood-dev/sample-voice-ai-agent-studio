import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listCallSessions, type CallSession } from '../../services/callHistoryApi';
import { useStudio } from '../../studio/StudioContext';
import { initials } from '../../studio/loadAgent';
import { IconChevron, IconSearch } from '../../studio/icons';
import styles from '../../studio/studio.module.css';

function isPhone(s: CallSession) {
  return (s.source || '').toLowerCase().includes('tel') || (s.source || '').toLowerCase().includes('phone') || (s.source || '').toLowerCase() === 'pstn' || (s.source || '').toLowerCase() === 'sip';
}

function formatDur(sec: number) {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}m ${r.toString().padStart(2, '0')}s` : `${r}s`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function CallsPage() {
  const navigate = useNavigate();
  const { agents, selectedAgent, selectedAgentId, setSelectedAgentId } = useStudio();
  const [sessions, setSessions] = useState<CallSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'web' | 'phone'>('all');
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    if (!selectedAgentId) { setSessions([]); return; }
    let cancelled = false;
    setLoading(true);
    listCallSessions(selectedAgentId, 50)
      .then((res) => { if (!cancelled) setSessions(res.sessions || []); })
      .catch(() => { if (!cancelled) setSessions([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedAgentId]);

  const filtered = sessions.filter((s) => {
    if (filter === 'web') return !isPhone(s);
    if (filter === 'phone') return isPhone(s);
    return true;
  });

  const groups = useMemo(() => {
    const map = new Map<string, CallSession[]>();
    for (const s of filtered) {
      const key = dayLabel(s.startedAt || s.endedAt);
      map.set(key, [...(map.get(key) || []), s]);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <h1 className={styles.title}>Calls</h1>
        <button type="button" className={styles.iconBtn} aria-label="Search calls" onClick={() => navigate('/agents')}><IconSearch /></button>
      </div>

      {selectedAgent ? (
        <button type="button" className={styles.switcher} onClick={() => setPicker((v) => !v)} style={{ margin: '8px 0 16px' }}>
          <span className={styles.avatar}>{initials(selectedAgent.name)}</span>
          <span style={{ flex: 1, textAlign: 'left' }}>
            <div className={styles.meta}>Agent</div>
            <div style={{ fontWeight: 700 }}>{selectedAgent.name}</div>
          </span>
          <IconChevron />
        </button>
      ) : (
        <p className={styles.muted}>Create an agent first to see its calls.</p>
      )}

      {picker && (
        <div className={styles.listGroup} style={{ marginBottom: 16 }}>
          {agents.map((a) => (
            <button key={a.id} type="button" className={styles.listRow} onClick={() => { setSelectedAgentId(a.id); setPicker(false); }}>
              <span className={styles.avatar}>{initials(a.name)}</span>
              <span className={styles.listTitle}>{a.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.chips} style={{ marginBottom: 16 }}>
        {(['all', 'web', 'phone'] as const).map((f) => (
          <button key={f} type="button" className={`${styles.chip} ${filter === f ? styles.chipOn : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'web' ? 'Web' : 'Phone'}
          </button>
        ))}
      </div>

      {loading && <p className={styles.muted}>Loading calls…</p>}
      {!loading && filtered.length === 0 && (
        <div className={styles.card}><p className={styles.body}>No calls yet for this agent. Tap Talk to it on the Agents tab to start one.</p></div>
      )}

      {groups.map(([label, items]) => (
        <section key={label}>
          <div className={styles.groupLabel}>{label}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((s) => {
              const phone = isPhone(s);
              const time = new Date(s.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
              const title = phone
                ? `Phone call · ${s.callerId || ''} · ${time}`.replace(/\s+·\s+$/, '')
                : `Web call · ${time}`;
              return (
                <Link key={s.sessionId} to={`/calls/${s.sessionId}`} className={styles.callCard}>
                  <div className={styles.callCardBody}>
                    <div style={{ fontWeight: 700 }}>{title}</div>
                    <div className={styles.muted} style={{ fontSize: 13, marginTop: 2 }}>
                      {formatDur(s.durationSeconds)} · {s.turnCount} turns · {s.endReason || 'ended'}
                    </div>
                  </div>
                  <IconChevron size={18} />
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export default CallsPage;
