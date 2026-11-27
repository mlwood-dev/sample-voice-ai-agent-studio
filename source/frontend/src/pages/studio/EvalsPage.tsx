import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listEvalJobs, startEvalJob, type EvalJob } from '../../services/evalApi';
import { listEvalSuites, type EvalSuite } from '../../services/evalSuitesApi';
import { useStudio } from '../../studio/StudioContext';
import { initials } from '../../studio/loadAgent';
import { IconChevron } from '../../studio/icons';
import styles from '../../studio/studio.module.css';

const DEFAULT_ASPECTS = [
  'Goal Achievement',
  'Response Quality',
  'Conversation Flow',
  'Tool Usage',
  'Tone & Professionalism',
];

function statusClass(status: EvalJob['status']) {
  if (status === 'COMPLETED') return styles.evalPass;
  if (status === 'FAILED' || status === 'CANCELLED') return styles.evalFail;
  if (status === 'RUNNING' || status === 'EVALUATING') return styles.evalRun;
  return styles.evalPend;
}

function EvalsPage() {
  const navigate = useNavigate();
  const { agents, selectedAgent, selectedAgentId, setSelectedAgentId } = useStudio();
  const [jobs, setJobs] = useState<EvalJob[]>([]);
  const [suites, setSuites] = useState<EvalSuite[]>([]);
  const [scenario, setScenario] = useState('The caller wants to book an appointment tomorrow morning and asks about hours.');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);

  const load = () => {
    if (selectedAgentId) {
      listEvalJobs(selectedAgentId).then((r) => setJobs(r || [])).catch(() => setJobs([]));
    } else {
      setJobs([]);
    }
    listEvalSuites().then((r) => setSuites(r || [])).catch(() => setSuites([]));
  };

  useEffect(() => { load(); }, [selectedAgentId]);

  const run = async () => {
    if (!selectedAgentId) return;
    setRunning(true);
    setError(null);
    try {
      await startEvalJob(selectedAgentId, {
        testName: 'Quick eval',
        scenarioDescription: scenario,
        maxTurns: 10,
        userModelId: 'nova-pro',
        inputMode: 'text',
        evaluationAspects: DEFAULT_ASPECTS,
        useMock: true,
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start eval');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Evals</h1>
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
        <p className={styles.muted}>Create an agent first to run evals.</p>
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

      <div className={styles.card} style={{ marginBottom: 24 }}>
        <h2 className={styles.heading}>Run an eval</h2>
        <p className={styles.muted} style={{ margin: '4px 0 12px' }}>Uses the existing eval runner with mock tools and the default quality aspects.</p>
        <label className={styles.fieldLabel}>Scenario</label>
        <textarea className={styles.textarea} style={{ minHeight: 100 }} value={scenario} onChange={(e) => setScenario(e.target.value)} />
        {error && <p className={styles.error}>{error}</p>}
        <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBlock}`} style={{ marginTop: 12 }} disabled={!selectedAgentId || running} onClick={() => void run()}>
          {running ? 'Starting…' : 'Start eval'}
        </button>
      </div>

      <h2 className={styles.heading}>Recent jobs</h2>
      {jobs.length === 0 && <p className={styles.muted} style={{ margin: '8px 0 16px' }}>No eval jobs yet for this agent.</p>}
      <div className={styles.listGroup} style={{ margin: '8px 0 24px' }}>
        {jobs.slice(0, 10).map((job) => (
          <Link key={job.id} to={selectedAgentId ? `/agents/${selectedAgentId}/evaluation/${job.id}` : '/evals'} className={styles.listRow}>
            <span className={styles.listText}>
              <span className={styles.listTitle}>{job.config.testName || 'Eval'}</span>
              <span className={styles.listDesc}>{new Date(job.createdAt).toLocaleString()}</span>
            </span>
            <span className={`${styles.evalChip} ${statusClass(job.status)}`}>{job.status.toLowerCase()}</span>
          </Link>
        ))}
      </div>

      <div className={styles.pageHead}>
        <h2 className={styles.heading}>Eval suites</h2>
        <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => navigate('/eval-suites/manage')}>New suite</button>
      </div>
      {suites.length === 0 && <p className={styles.muted}>No suites yet.</p>}
      <div className={styles.listGroup}>
        {suites.map((s) => (
          <Link key={s.id} to={`/eval-suites/${s.id}`} className={styles.listRow}>
            <span className={styles.listText}>
              <span className={styles.listTitle}>{s.name}</span>
              <span className={styles.listDesc}>{s.description || 'Eval suite'}</span>
            </span>
            <IconChevron />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default EvalsPage;
