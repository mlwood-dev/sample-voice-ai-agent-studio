import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { analyzeCallHistory, getCallSessionDetail, type CallSession, type CallSessionDetail } from '../../services/callHistoryApi';
import { useStudio } from '../../studio/StudioContext';
import { IconBack } from '../../studio/icons';
import styles from '../../studio/studio.module.css';

function formatDur(sec: number) {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}m ${r.toString().padStart(2, '0')}s` : `${r}s`;
}

function CallReview() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { selectedAgentId, selectedAgent } = useStudio();
  const [detail, setDetail] = useState<CallSessionDetail | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!sessionId || !selectedAgentId) return;
    let cancelled = false;
    getCallSessionDetail(sessionId, selectedAgentId)
      .then(async (d) => {
        if (cancelled) return;
        setDetail(d);
        if (d.urls?.transcript) {
          try {
            const res = await fetch(d.urls.transcript);
            const text = await res.text();
            if (!cancelled) setTranscript(text);
          } catch {
            /* leave empty */
          }
        }
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load this call'); });
    return () => { cancelled = true; };
  }, [sessionId, selectedAgentId]);

  const session: CallSession | undefined = detail?.session;
  const turns = transcript
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(user|agent|assistant|human|ai)\s*[:\-]\s*(.*)$/i);
      if (m) return { role: /user|human/i.test(m[1]) ? 'you' : 'agent', text: m[2] };
      return { role: 'agent', text: line };
    });

  const runSummary = async () => {
    if (!transcript) return;
    setAnalyzing(true);
    try {
      const res = await analyzeCallHistory(transcript, 'Summarize this call in a short paragraph: goal, outcome, and any follow-up.');
      setAnalysis(res.analysis);
    } catch (e) {
      setAnalysis(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button type="button" className={styles.iconBtn} aria-label="Back" onClick={() => navigate('/calls')}><IconBack /></button>
        <span className={styles.heading}>Call</span>
        <span />
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {session && (
        <div className={styles.card} style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{selectedAgent?.name || 'Agent'}</div>
          <p className={styles.muted} style={{ marginTop: 4 }}>
            {new Date(session.startedAt).toLocaleString()} · {formatDur(session.durationSeconds)} · {session.turnCount} turns · {session.endReason || 'ended'}
            {session.source ? ` · ${session.source}` : ''}
          </p>
          {detail?.urls?.audio && <audio controls src={detail.urls.audio} style={{ width: '100%', marginTop: 12 }} />}
        </div>
      )}
      <div className={styles.pageHead}>
        <h2 className={styles.heading}>Transcript</h2>
        <button type="button" className={styles.btnGhost} disabled={!transcript || analyzing} onClick={() => void runSummary()}>
          {analyzing ? 'Summarizing…' : 'Summarize'}
        </button>
      </div>
      {analysis && <div className={styles.banner} style={{ marginBottom: 16 }}>{analysis}</div>}
      <div className={styles.transcript} style={{ minHeight: 200 }}>
        {turns.length === 0 && <p className={styles.muted}>No transcript is available for this call.</p>}
        {turns.map((t, i) => (
          <div key={i} className={`${styles.bubble} ${t.role === 'you' ? styles.bubbleYou : styles.bubbleAgent}`}>
            <div className={styles.bubbleMeta}>{t.role === 'you' ? 'You' : 'Agent'}</div>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export default CallReview;
