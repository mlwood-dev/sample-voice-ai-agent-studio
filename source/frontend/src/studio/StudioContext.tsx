import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { listDemos, type Demo } from '../services/demosApi';
import { onAgentListChanged } from '../events/agentEvents';
import { SELECTED_AGENT_KEY } from './loadAgent';

interface StudioContextValue {
  agents: Demo[];
  loadingAgents: boolean;
  selectedAgentId: string | null;
  selectedAgent: Demo | null;
  setSelectedAgentId: (id: string | null) => void;
  refreshAgents: () => Promise<void>;
}

const StudioContext = createContext<StudioContextValue | undefined>(undefined);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<Demo[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [selectedAgentId, setSelectedAgentIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SELECTED_AGENT_KEY);
    } catch {
      return null;
    }
  });

  const refreshAgents = useCallback(async () => {
    try {
      setLoadingAgents(true);
      const data = await listDemos();
      setAgents(data);
    } catch {
      /* list failures surface on pages that need them */
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  useEffect(() => {
    refreshAgents();
    return onAgentListChanged(() => { void refreshAgents(); });
  }, [refreshAgents]);

  const setSelectedAgentId = useCallback((id: string | null) => {
    setSelectedAgentIdState(id);
    try {
      if (id) localStorage.setItem(SELECTED_AGENT_KEY, id);
      else localStorage.removeItem(SELECTED_AGENT_KEY);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (selectedAgentId && agents.length > 0 && !agents.some((a) => a.id === selectedAgentId)) {
      setSelectedAgentId(agents[0]?.id ?? null);
    } else if (!selectedAgentId && agents[0]) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId, setSelectedAgentId]);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  );

  const value = useMemo(
    () => ({ agents, loadingAgents, selectedAgentId, selectedAgent, setSelectedAgentId, refreshAgents }),
    [agents, loadingAgents, selectedAgentId, selectedAgent, setSelectedAgentId, refreshAgents],
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used within StudioProvider');
  return ctx;
}
