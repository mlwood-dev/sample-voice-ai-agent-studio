import type { FrameworkType, HostType, PipelineType } from '../context/WizardContext';
import type { Demo } from '../services/demosApi';

export function applyDemoToWizard(demo: Demo, dispatch: (action: any) => void) {
  const config = demo.config;
  dispatch({ type: 'SET_HOST', payload: (config.host || 'agentcore') as HostType });
  dispatch({ type: 'SET_FRAMEWORK', payload: (config.framework || 'strands-bidiagent') as FrameworkType });
  dispatch({ type: 'SET_MODEL', payload: config.model || ['nova-2-sonic'] });
  dispatch({ type: 'SET_PIPELINE', payload: (config.pipeline || 'speech-to-speech') as PipelineType });
  dispatch({
    type: 'SET_VOICE',
    payload: config.voice || { voiceId: '', language: 'en-US', gender: 'female' },
  });
  dispatch({
    type: 'SET_AGENTS',
    payload: { selectedAgents: config.tools || [], customTools: config.customTools || [] },
  });
  dispatch({
    type: 'SET_PROMPT',
    payload: config.prompt || {
      greeting: config.greeting || '',
      instructions: config.systemPrompt || '',
    },
  });
  dispatch({ type: 'SET_TELEPHONY_ENABLED', payload: config.telephonyEnabled ?? false });
  dispatch({ type: 'SET_AGENT_START_FIRST', payload: config.agentStartFirst ?? true });
  dispatch({ type: 'SET_PHONE', payload: config.telephony?.phoneNumber || '' });
  dispatch({ type: 'SET_USE_MOCK', payload: config.useMock ?? true });
  dispatch({ type: 'SET_CALL_HISTORY_ENABLED', payload: (config as { callHistoryEnabled?: boolean }).callHistoryEnabled ?? true });
  dispatch({ type: 'SET_CALL_LOG_ENABLED', payload: (config as { callLogEnabled?: boolean }).callLogEnabled ?? false });
  if (config.workflow) {
    const wf = typeof config.workflow === 'string' ? JSON.parse(config.workflow) : config.workflow;
    dispatch({ type: 'SET_WORKFLOW', payload: wf });
  }
  dispatch({ type: 'SET_EDITING_DEMO', payload: { id: demo.id, name: demo.name } });
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'A';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function firstNameFromUser(user?: { email?: string; username?: string } | null): string {
  const raw = (user?.username || user?.email || '').split('@')[0].trim();
  if (!raw) return 'there';
  const token = raw.replace(/[._-]+/g, ' ').split(' ')[0];
  return token.charAt(0).toUpperCase() + token.slice(1);
}

export function greetingForNow(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function relativeTime(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const delta = Date.now() - then;
  const mins = Math.round(delta / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function toolLabel(id: string): string {
  const raw = id.includes(':') ? id.split(':').slice(1).join(':') : id;
  return raw.replace(/^int:/, '');
}

export const SELECTED_AGENT_KEY = 'studio.selectedAgentId';
