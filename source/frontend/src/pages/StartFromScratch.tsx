import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { generateAgentConfig } from '../services/generateAgent';
import { useWizard } from '../context/WizardContext';
import type { HostType, FrameworkType, PipelineType } from '../context/WizardContext';
import TEMPLATES from '../config/templates';
import { IconBack, IconClose, IconSparkle } from '../studio/icons';
import styles from '../studio/studio.module.css';

const EXAMPLES = [
  {
    label: 'E-commerce',
    text: 'A customer service agent for an e-commerce company that handles order status inquiries, returns, and refund requests. It should be polite and efficient, and escalate to a human for complaints about damaged items.',
  },
  {
    label: 'Vet clinic',
    text: 'A receptionist for a veterinary clinic that schedules pet appointments, provides information about services (vaccines, dental, surgery), and collects pet and owner details for new patients.',
  },
  {
    label: 'Restaurant reservations',
    text: 'A restaurant reservation agent that takes bookings, handles dietary requirements, answers questions about the menu and specials, and can modify or cancel existing reservations.',
  },
];

function StartFromScratch() {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'template' | 'custom' | null>(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { dispatch } = useWizard();

  useEffect(() => {
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  useEffect(() => {
    if (params.get('open') === 'templates') setSheet('template');
    if (params.get('open') === 'custom') setSheet('custom');
  }, [params]);

  const generateAndReview = async (text: string, nameHint?: string) => {
    setLoading(true);
    setError(null);
    try {
      const config = await generateAgentConfig(text);
      dispatch({ type: 'RESET' });
      dispatch({ type: 'SET_HOST', payload: config.host as HostType });
      dispatch({ type: 'SET_FRAMEWORK', payload: config.framework as FrameworkType });
      dispatch({ type: 'SET_MODEL', payload: config.model });
      dispatch({ type: 'SET_PIPELINE', payload: (config.pipeline || 'speech-to-speech') as PipelineType });
      dispatch({ type: 'SET_VOICE', payload: config.voice });
      dispatch({ type: 'SET_AGENTS', payload: { selectedAgents: config.tools || [] } });
      dispatch({ type: 'SET_PROMPT', payload: config.prompt });
      dispatch({ type: 'SET_WORKFLOW', payload: null });
      dispatch({ type: 'SET_PATH', payload: 'some-technical' });
      dispatch({ type: 'SET_CALL_HISTORY_ENABLED', payload: true });
      navigate('/summary', { state: { draftName: nameHint || '' } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed. Try again or skip and set it up yourself.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    generateAndReview(description.trim());
  };

  const pickTemplate = (id: string) => {
    const template = TEMPLATES.find((t) => t.id === id);
    if (!template) return;
    dispatch({ type: 'RESET' });
    dispatch({ type: 'SET_HOST', payload: template.host as HostType });
    dispatch({ type: 'SET_FRAMEWORK', payload: template.framework as FrameworkType });
    dispatch({ type: 'SET_MODEL', payload: template.model });
    dispatch({ type: 'SET_PIPELINE', payload: template.pipeline as PipelineType });
    dispatch({ type: 'SET_VOICE', payload: template.voice });
    dispatch({ type: 'SET_AGENTS', payload: { selectedAgents: template.tools || [] } });
    dispatch({ type: 'SET_PROMPT', payload: { greeting: '', instructions: template.systemPrompt } });
    if (template.workflow) dispatch({ type: 'SET_WORKFLOW', payload: template.workflow });
    dispatch({ type: 'SET_PATH', payload: 'some-technical' });
    dispatch({ type: 'SET_CALL_HISTORY_ENABLED', payload: true });
    setSheet(null);
    navigate('/summary', { state: { draftName: template.useCase } });
  };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button type="button" className={styles.iconBtn} aria-label="Back" onClick={() => navigate('/agents')}><IconBack /></button>
        <span />
        <button type="button" className={styles.iconBtn} aria-label="Close" onClick={() => navigate('/agents')}><IconClose /></button>
      </div>
      <p className={styles.kicker}><IconSparkle size={16} /> Designed with Amazon Nova</p>
      <h1 className={styles.heading} style={{ fontSize: 28, lineHeight: '34px' }}>What should this agent do?</h1>
      <p className={styles.subtitle}>Describe it in a sentence or two. We’ll draft a voice, a greeting, and a first prompt — nothing is live until you approve it.</p>

      <form onSubmit={handleSubmit}>
        <textarea
          className={styles.textarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A friendly booking agent for a neighborhood veterinary clinic. It should confirm appointments, answer hours questions, and take down pet details."
          required
        />
        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBlock}`} disabled={loading || !description.trim()} style={{ marginTop: 16 }}>
          {loading ? 'Drafting…' : 'Generate draft'}
        </button>
      </form>

      <div className={styles.chips} style={{ marginTop: 20 }}>
        {EXAMPLES.map((ex) => (
          <button key={ex.label} type="button" className={styles.chip} disabled={loading} onClick={() => { setDescription(ex.text); void generateAndReview(ex.text, ex.label); }}>
            {ex.label}
          </button>
        ))}
      </div>

      <button type="button" className={styles.textLink} onClick={() => setSheet('template')}>Start with a template</button>
      <button type="button" className={styles.textLink} onClick={() => setSheet('custom')}>Skip — I’ll set it up myself</button>

      {loading && (
        <div className={styles.overlay} role="status">
          <div className={styles.spinner} />
          <p>Drafting your agent…</p>
        </div>
      )}

      {sheet === 'template' && (
        <div className={styles.sheetBackdrop} role="dialog" aria-label="Templates" onClick={() => setSheet(null)}>
          <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetHandle} />
            <div className={styles.sheetHead}>
              <h2 className={styles.sheetTitle}>Start with a template</h2>
              <button type="button" className={styles.iconBtn} aria-label="Close" onClick={() => setSheet(null)}><IconClose /></button>
            </div>
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" className={styles.templateRow} onClick={() => pickTemplate(t.id)}>
                <span className={styles.templateEmoji}>{t.icon}</span>
                <span>
                  <div className={styles.templateName}>{t.useCase}</div>
                  <div className={styles.muted} style={{ fontSize: 13 }}>{t.description}</div>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {sheet === 'custom' && (
        <div className={styles.sheetBackdrop} role="dialog" aria-label="Set it up yourself" onClick={() => setSheet(null)}>
          <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetHandle} />
            <div className={styles.sheetHead}>
              <h2 className={styles.sheetTitle}>Set it up yourself</h2>
              <button type="button" className={styles.iconBtn} aria-label="Close" onClick={() => setSheet(null)}><IconClose /></button>
            </div>
            <p className={styles.body}>These are the existing Quick and Custom wizard paths. After you pick one you’ll land in Review draft, where you can still edit every section.</p>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnBlock}`}
              style={{ margin: '12px 0 8px' }}
              onClick={() => { dispatch({ type: 'SET_PATH', payload: 'minimal' }); dispatch({ type: 'SET_PIPELINE', payload: 'speech-to-speech' }); dispatch({ type: 'SET_MODEL', payload: ['nova-2-sonic'] }); dispatch({ type: 'SET_CALL_HISTORY_ENABLED', payload: true }); setSheet(null); navigate('/summary?sheet=voice'); }}
            >
              Quick start — Amazon Nova 2 Sonic
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnBlock}`}
              onClick={() => { dispatch({ type: 'SET_PATH', payload: 'some-technical' }); dispatch({ type: 'SET_CALL_HISTORY_ENABLED', payload: true }); setSheet(null); navigate('/summary?sheet=pipeline'); }}
            >
              Custom pipeline
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default StartFromScratch;
