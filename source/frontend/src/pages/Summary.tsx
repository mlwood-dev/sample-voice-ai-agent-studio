import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useWizard } from '../context/WizardContext';
import { listTools, type SavedTool } from '../services/toolsApi';
import { createDemo, updateDemo, wizardStateToConfig } from '../services/demosApi';
import { notifyAgentListChanged } from '../events/agentEvents';
import { getVoiceConfig } from '../config/voices';
import { useStudio } from '../studio/StudioContext';
import { IconBack, IconClose, IconChevron, IconPlay } from '../studio/icons';
import styles from '../studio/studio.module.css';

const S2S_CORE = [
  { id: 'nova-2-sonic', label: 'Amazon Nova 2 Sonic', hint: 'Speech-to-speech on Bedrock' },
];
const S2S_OTHER = [
  { id: 'openai-realtime', label: 'OpenAI Realtime', hint: 'Requires an API key' },
  { id: 'gemini-live', label: 'Gemini Live', hint: 'Requires an API key' },
];
const STT_CORE = [{ id: 'transcribe', label: 'Amazon Transcribe' }];
const STT_OTHER = [{ id: 'deepgram', label: 'Deepgram' }];
const LLM_CORE = [{ id: 'nova-lite', label: 'Amazon Nova Lite' }, { id: 'gpt', label: 'GPT (via Bedrock)' }];
const TTS_CORE = [{ id: 'polly', label: 'Amazon Polly' }];
const TTS_OTHER = [{ id: 'eleven-labs', label: 'ElevenLabs' }];

const AGENT_LABELS: Record<string, string> = {
  'knowledge-base': 'Knowledge Base Lookup',
  calendar: 'Calendar / Scheduling',
  crm: 'CRM Lookup',
  'order-status': 'Order Status',
  transfer: 'Call Transfer',
  payment: 'Payment Processing',
  notification: 'Send Notification',
  custom: 'Custom Tool',
  endCallTool: 'End call',
  transferCall: 'Transfer call',
};

type Sheet = 'voice' | 'pipeline' | 'tools' | 'persona' | 'guardrails' | null;

function parseSheet(raw: string | null): Sheet {
  if (!raw) return null;
  if (raw === 'model' || raw === 'speech-to-speech' || raw === 'cascaded') return 'pipeline';
  if (raw === 'prompt' || raw === 'prompt-builder') return 'persona';
  if (raw === 'tools-selection' || raw === 'flow') return 'tools';
  if (raw === 'voice-1s' || raw === 'voice') return 'voice';
  if (['voice', 'pipeline', 'tools', 'persona', 'guardrails'].includes(raw)) return raw as Sheet;
  return null;
}

function splitGuardrails(instructions: string): { body: string; guardrails: string } {
  const marker = '\n\n# Guardrails\n';
  const idx = instructions.indexOf(marker);
  if (idx === -1) return { body: instructions, guardrails: '' };
  return { body: instructions.slice(0, idx), guardrails: instructions.slice(idx + marker.length) };
}

function joinGuardrails(body: string, guardrails: string) {
  const g = guardrails.trim();
  return g ? `${body.replace(/\s+$/, '')}${'\n\n# Guardrails\n'}${g}` : body;
}

function Summary() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { state, dispatch } = useWizard();
  const { setSelectedAgentId } = useStudio();
  const [availableTools, setAvailableTools] = useState<SavedTool[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const draftFromNav = (location.state as { draftName?: string } | null)?.draftName;
  const [agentName, setAgentName] = useState(state.editingDemoName || draftFromNav || 'My agent');
  const [otherOpen, setOtherOpen] = useState(false);
  const sheet = parseSheet(params.get('sheet'));

  useEffect(() => {
    listTools().then(setAvailableTools).catch(() => {});
  }, []);

  const closeSheet = () => {
    const next = new URLSearchParams(params);
    next.delete('sheet');
    setParams(next, { replace: true });
  };
  const openSheet = (s: Exclude<Sheet, null>) => {
    const next = new URLSearchParams(params);
    next.set('sheet', s);
    setParams(next);
  };

  const modelId = state.model[0] || 'nova-2-sonic';
  const voiceCfg = getVoiceConfig(modelId);
  const voices = voiceCfg.voices.filter((v) => v.languages.includes(state.voice.language) || v.languages.length === 0);
  const voiceOptions = voices.length ? voices : voiceCfg.voices;

  const playSample = (voiceId: string) => {
    const v = voiceCfg.voices.find((x) => x.id === voiceId);
    const src = v?.sampleAudios?.[state.voice.language] || v?.sampleAudio || `/audios/sonic/${voiceId}_${state.voice.language}.mp3`;
    const audio = new Audio(src);
    audio.play().catch(() => {});
  };

  const toolNames = state.agents.selectedAgents.map((id) => {
    const tool = availableTools.find((t) => `int:${t.id}` === id || t.id === id);
    return tool ? tool.name : (AGENT_LABELS[id] || id.replace(/^int:/, ''));
  });

  const pipelineLabel = state.pipeline === 'cascaded'
    ? `Cascaded · ${state.cascaded.sttProvider} / ${state.cascaded.llmProvider} / ${state.cascaded.ttsProvider}`
    : `Speech-to-speech · ${S2S_CORE.concat(S2S_OTHER).find((m) => m.id === modelId)?.label || modelId}`;

  const voiceLabel = state.voice.voiceId
    ? `${voiceCfg.voices.find((v) => v.id === state.voice.voiceId)?.label || state.voice.voiceId} · ${state.voice.language}`
    : 'No voice selected yet';

  const persist = async () => {
    const name = agentName.trim() || 'My agent';
    if (state.editingDemoId) {
      const demo = await updateDemo(state.editingDemoId, { name, config: wizardStateToConfig(state) });
      dispatch({ type: 'SET_EDITING_DEMO', payload: { id: demo.id, name: demo.name } });
      setSelectedAgentId(demo.id);
      return demo;
    }
    const demo = await createDemo({ name, config: wizardStateToConfig(state) });
    dispatch({ type: 'SET_EDITING_DEMO', payload: { id: demo.id, name: demo.name } });
    setSelectedAgentId(demo.id);
    return demo;
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await persist();
      notifyAgentListChanged();
      setToast('Saved as draft');
      setTimeout(() => setToast(null), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save agent');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndTry = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const demo = await persist();
      notifyAgentListChanged();
      navigate('/poc', { state: { fromSavedAgent: true, agentName: demo.name } });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save agent');
      setSaving(false);
    }
  };

  const toggleTool = (id: string) => {
    const selected = state.agents.selectedAgents;
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    dispatch({ type: 'SET_AGENTS', payload: { selectedAgents: next } });
  };

  const { body: personaBody, guardrails } = useMemo(
    () => splitGuardrails(state.prompt.instructions || ''),
    [state.prompt.instructions],
  );

  const modelIsOther = S2S_OTHER.some((m) => m.id === modelId);
  const cascadedHasOther = state.cascaded.sttProvider === 'deepgram' || state.cascaded.ttsProvider === 'eleven-labs';

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button type="button" className={styles.iconBtn} aria-label="Back" onClick={() => navigate('/start')}><IconBack /></button>
        <span className={styles.stepLabel}>Review draft</span>
        <button type="button" className={styles.iconBtn} aria-label="Close" onClick={() => navigate('/agents')}><IconClose /></button>
      </div>
      <div className={styles.stepper}>
        <div className={styles.stepLabel}>Step 2 of 3 · Review draft</div>
        <div className={styles.stepTrack}>
          <span className={`${styles.stepSeg} ${styles.stepSegOn}`} />
          <span className={`${styles.stepSeg} ${styles.stepSegOn}`} />
          <span className={styles.stepSeg} />
        </div>
      </div>
      <div className={styles.banner}>Nothing is live until you approve it.</div>

      <label className={styles.fieldLabel} style={{ marginTop: 16 }}>Agent name</label>
      <input className={styles.input} value={agentName} onChange={(e) => setAgentName(e.target.value)} />

      <button type="button" className={styles.reviewRow} onClick={() => openSheet('voice')}>
        <span style={{ flex: 1 }}>
          <div className={styles.reviewLabel}>Voice</div>
          <div className={styles.reviewValue}>{voiceLabel}</div>
        </span>
        <IconChevron />
      </button>
      <button type="button" className={styles.reviewRow} onClick={() => openSheet('pipeline')}>
        <span style={{ flex: 1 }}>
          <div className={styles.reviewLabel}>Pipeline & model</div>
          <div className={styles.reviewValue}>{pipelineLabel}</div>
        </span>
        <IconChevron />
      </button>
      <button type="button" className={styles.reviewRow} onClick={() => openSheet('tools')}>
        <span style={{ flex: 1 }}>
          <div className={styles.reviewLabel}>Tools</div>
          <div className={styles.reviewValue}>{toolNames.length ? toolNames.join(', ') : 'No tools selected'}</div>
        </span>
        <IconChevron />
      </button>
      <button type="button" className={styles.reviewRow} onClick={() => openSheet('persona')}>
        <span style={{ flex: 1 }}>
          <div className={styles.reviewLabel}>Persona & prompt</div>
          <div className={styles.reviewValue}>{state.prompt.greeting || personaBody || 'Add a greeting and instructions'}</div>
        </span>
        <IconChevron />
      </button>
      <button type="button" className={styles.reviewRow} onClick={() => openSheet('guardrails')}>
        <span style={{ flex: 1 }}>
          <div className={styles.reviewLabel}>Guardrails</div>
          <div className={styles.reviewValue}>{guardrails || 'Optional limits and safety notes'}</div>
        </span>
        <IconChevron />
      </button>

      {saveError && <p className={styles.error}>{saveError}</p>}
      <div className={styles.pinFooter}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBlock}`} disabled={saving} onClick={() => void handleSaveAndTry()}>
          {saving ? 'Saving…' : 'Save & try it'}
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnSecondary} ${styles.btnBlock}`} style={{ marginTop: 8 }} disabled={saving} onClick={() => void handleSaveDraft()}>
          Save as draft
        </button>
      </div>
      {toast && <div className={styles.toast} role="status">{toast}</div>}

      {sheet && (
        <div className={styles.sheetBackdrop} role="dialog" onClick={closeSheet}>
          <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetHandle} />
            <div className={styles.sheetHead}>
              <h2 className={styles.sheetTitle}>
                {sheet === 'voice' && 'Voice'}
                {sheet === 'pipeline' && 'Pipeline & model'}
                {sheet === 'tools' && 'Tools'}
                {sheet === 'persona' && 'Persona & prompt'}
                {sheet === 'guardrails' && 'Guardrails'}
              </h2>
              <button type="button" className={styles.iconBtn} aria-label="Close" onClick={closeSheet}><IconClose /></button>
            </div>

            {sheet === 'voice' && (
              <>
                <label className={styles.fieldLabel}>Language</label>
                <select className={styles.select} value={state.voice.language} onChange={(e) => dispatch({ type: 'SET_VOICE', payload: { language: e.target.value } })}>
                  {voiceCfg.languages.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
                <label className={styles.fieldLabel} style={{ marginTop: 12 }}>Voice</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {voiceOptions.map((v) => (
                    <div key={v.id} className={styles.listRow} style={{ borderRadius: 12, border: '1px solid var(--border)', marginTop: 0 }}>
                      <button type="button" className={styles.chip + (state.voice.voiceId === v.id ? ' ' + styles.chipOn : '')} onClick={() => dispatch({ type: 'SET_VOICE', payload: { voiceId: v.id, gender: v.gender } })}>
                        {v.label} · {v.gender}
                      </button>
                      <button type="button" className={styles.iconBtn} aria-label={`Preview ${v.label}`} onClick={() => playSample(v.id)}><IconPlay /></button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {sheet === 'pipeline' && (
              <>
                <label className={styles.fieldLabel}>Pipeline</label>
                <div className={styles.chips} style={{ marginBottom: 16 }}>
                  <button type="button" className={`${styles.chip} ${state.pipeline !== 'cascaded' ? styles.chipOn : ''}`} onClick={() => dispatch({ type: 'SET_PIPELINE', payload: 'speech-to-speech' })}>Speech-to-speech</button>
                  <button type="button" className={`${styles.chip} ${state.pipeline === 'cascaded' ? styles.chipOn : ''}`} onClick={() => dispatch({ type: 'SET_PIPELINE', payload: 'cascaded' })}>Cascaded</button>
                </div>
                {state.pipeline !== 'cascaded' && (
                  <>
                    <label className={styles.fieldLabel}>Model</label>
                    {S2S_CORE.map((m) => (
                      <button key={m.id} type="button" className={`${styles.chip} ${modelId === m.id ? styles.chipOn : ''}`} style={{ margin: '4px 8px 4px 0' }} onClick={() => dispatch({ type: 'SET_MODEL', payload: [m.id] })}>
                        {m.label}
                      </button>
                    ))}
                    <details open={otherOpen || modelIsOther} onToggle={(e) => setOtherOpen((e.target as HTMLDetailsElement).open)} style={{ marginTop: 16 }}>
                      <summary className={styles.fieldLabel} style={{ cursor: 'pointer' }}>Other providers</summary>
                      <p className={styles.muted} style={{ fontSize: 13, margin: '8px 0' }}>Still selectable. These usually need an API key in the existing model pages.</p>
                      {S2S_OTHER.map((m) => (
                        <button key={m.id} type="button" className={`${styles.chip} ${modelId === m.id ? styles.chipOn : ''}`} style={{ margin: '4px 8px 4px 0' }} onClick={() => dispatch({ type: 'SET_MODEL', payload: [m.id] })}>
                          {m.label}
                        </button>
                      ))}
                    </details>
                  </>
                )}
                {state.pipeline === 'cascaded' && (
                  <>
                    <label className={styles.fieldLabel}>Speech-to-text</label>
                    <div className={styles.chips}>
                      {STT_CORE.map((m) => <button key={m.id} type="button" className={`${styles.chip} ${state.cascaded.sttProvider === m.id ? styles.chipOn : ''}`} onClick={() => dispatch({ type: 'SET_CASCADED', payload: { sttProvider: m.id } })}>{m.label}</button>)}
                    </div>
                    <label className={styles.fieldLabel} style={{ marginTop: 12 }}>Language model</label>
                    <div className={styles.chips}>
                      {LLM_CORE.map((m) => <button key={m.id} type="button" className={`${styles.chip} ${state.cascaded.llmProvider === m.id ? styles.chipOn : ''}`} onClick={() => dispatch({ type: 'SET_CASCADED', payload: { llmProvider: m.id } })}>{m.label}</button>)}
                    </div>
                    <label className={styles.fieldLabel} style={{ marginTop: 12 }}>Text-to-speech</label>
                    <div className={styles.chips}>
                      {TTS_CORE.map((m) => <button key={m.id} type="button" className={`${styles.chip} ${state.cascaded.ttsProvider === m.id ? styles.chipOn : ''}`} onClick={() => dispatch({ type: 'SET_CASCADED', payload: { ttsProvider: m.id } })}>{m.label}</button>)}
                    </div>
                    <details open={otherOpen || cascadedHasOther} style={{ marginTop: 16 }}>
                      <summary className={styles.fieldLabel} style={{ cursor: 'pointer' }}>Other providers</summary>
                      <div className={styles.chips} style={{ marginTop: 8 }}>
                        {STT_OTHER.concat(TTS_OTHER).map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className={`${styles.chip} ${(state.cascaded.sttProvider === m.id || state.cascaded.ttsProvider === m.id) ? styles.chipOn : ''}`}
                            onClick={() => dispatch({ type: 'SET_CASCADED', payload: m.id === 'deepgram' ? { sttProvider: m.id } : { ttsProvider: m.id } })}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </details>
                  </>
                )}
              </>
            )}

            {sheet === 'tools' && (
              <>
                <p className={styles.body} style={{ marginBottom: 12 }}>Select tools this agent can use. Conversation-flow canvas stays available on a larger screen.</p>
                {availableTools.length === 0 && <p className={styles.muted}>No saved tools yet. Add them under More → Tools.</p>}
                {availableTools.map((t) => {
                  const id = `int:${t.id}`;
                  const on = state.agents.selectedAgents.includes(id) || state.agents.selectedAgents.includes(t.id);
                  return (
                    <button key={t.id} type="button" className={styles.listRow} onClick={() => toggleTool(on && state.agents.selectedAgents.includes(t.id) ? t.id : id)}>
                      <span className={`${styles.chip} ${on ? styles.chipOn : ''}`}>{on ? 'Selected' : 'Add'}</span>
                      <span className={styles.listText}>
                        <span className={styles.listTitle}>{t.name}</span>
                        <span className={styles.listDesc}>{t.type}{t.description ? ` · ${t.description}` : ''}</span>
                      </span>
                    </button>
                  );
                })}
                <button type="button" className={styles.textLink} onClick={() => navigate('/tools-selection')}>Open conversation flow (legacy wizard)</button>
              </>
            )}

            {sheet === 'persona' && (
              <>
                <label className={styles.fieldLabel}>Greeting</label>
                <textarea className={styles.textarea} style={{ minHeight: 80 }} value={state.prompt.greeting} onChange={(e) => dispatch({ type: 'SET_PROMPT', payload: { greeting: e.target.value } })} />
                <label className={styles.fieldLabel} style={{ marginTop: 12 }}>Instructions</label>
                <textarea className={styles.textarea} value={personaBody} onChange={(e) => dispatch({ type: 'SET_PROMPT', payload: { instructions: joinGuardrails(e.target.value, guardrails) } })} />
              </>
            )}

            {sheet === 'guardrails' && (
              <>
                <p className={styles.muted} style={{ fontSize: 14, marginBottom: 8 }}>Optional limits appended to the agent prompt. They are not a separate backend feature.</p>
                <textarea className={styles.textarea} value={guardrails} onChange={(e) => dispatch({ type: 'SET_PROMPT', payload: { instructions: joinGuardrails(personaBody, e.target.value) } })} placeholder="Don’t give medical advice. Transfer if the caller is distressed." />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Summary;
