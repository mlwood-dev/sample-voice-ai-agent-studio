import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useStudio } from '../../studio/StudioContext';
import { applyDemoToWizard, firstNameFromUser, greetingForNow, initials, relativeTime } from '../../studio/loadAgent';
import { useWizard } from '../../context/WizardContext';
import { IconPlus, IconSearch } from '../../studio/icons';
import styles from '../../studio/studio.module.css';
import type { Demo } from '../../services/demosApi';

function AgentsHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { dispatch } = useWizard();
  const { agents, loadingAgents, setSelectedAgentId } = useStudio();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) => a.name.toLowerCase().includes(q) || (a.config.prompt?.instructions || a.config.systemPrompt || '').toLowerCase().includes(q));
  }, [agents, query]);

  const talk = (demo: Demo) => {
    applyDemoToWizard(demo, dispatch);
    setSelectedAgentId(demo.id);
    navigate('/poc', { state: { fromSavedAgent: true, agentName: demo.name } });
  };

  const reviewCalls = (demo: Demo) => {
    setSelectedAgentId(demo.id);
    navigate('/calls');
  };

  const editAgent = (demo: Demo) => {
    applyDemoToWizard(demo, dispatch);
    setSelectedAgentId(demo.id);
    navigate('/summary');
  };

  const name = firstNameFromUser(user);

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <h1 className={styles.title}>Your agents</h1>
        <button type="button" className={styles.iconBtn} aria-label="Search agents" onClick={() => setSearchOpen((v) => !v)}>
          <IconSearch />
        </button>
      </div>
      {searchOpen && (
        <input className={styles.input} style={{ marginBottom: 16 }} placeholder="Search agents" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      )}
      <h2 className={styles.heading} style={{ fontSize: 22, lineHeight: '30px', margin: '8px 0 4px' }}>
        {greetingForNow()}, {name}
      </h2>
      <p className={styles.subtitle} style={{ marginBottom: 20 }}>Pick an agent to talk to, or design a new one.</p>

      {loadingAgents && <p className={styles.muted}>Loading agents…</p>}
      {!loadingAgents && filtered.length === 0 && (
        <div className={styles.card}>
          <p className={styles.body}>No agents yet. Tap <strong>New agent</strong> to describe what it should do.</p>
        </div>
      )}

      <div className={styles.grid3}>
        {filtered.map((demo) => {
          const desc = demo.config.prompt?.instructions || demo.config.systemPrompt || '';
          const voice = demo.config.voice?.voiceId || 'Voice';
          const lang = demo.config.voice?.language || 'en-US';
          const pipeline = demo.config.pipeline === 'cascaded' ? 'Cascaded' : 'Speech-to-speech';
          const tools = (demo.config.tools || []).length;
          return (
            <article key={demo.id} className={styles.agentCard}>
              <div className={styles.agentTop}>
                <span className={styles.avatar}>{initials(demo.name)}</span>
                <div>
                  <button type="button" onClick={() => navigate(`/agents/${demo.id}`)} style={{ fontWeight: 700, fontSize: 16, background: 'none', border: 'none', padding: 0, color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>{demo.name}</button>
                  <div className={styles.muted} style={{ fontSize: 13 }}>Edited {relativeTime(demo.updatedAt || demo.createdAt)}</div>
                </div>
              </div>
              {desc && <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{desc}</p>}
              <p className={styles.muted} style={{ fontSize: 13 }}>Voice: {voice} ({lang}) · {pipeline} · {tools} {tools === 1 ? 'tool' : 'tools'}</p>
              <div className={`${styles.agentActions} ${styles.btnRow3}`}>
                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => talk(demo)}>Talk to it</button>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => reviewCalls(demo)}>Review calls</button>
                <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnWide}`} onClick={() => editAgent(demo)}>Edit</button>
              </div>
            </article>
          );
        })}
      </div>

      <button type="button" className={styles.fab} onClick={() => navigate('/start')}>
        <IconPlus size={18} /> New agent
      </button>
    </div>
  );
}

export default AgentsHome;
