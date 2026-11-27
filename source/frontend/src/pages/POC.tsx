import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWizard } from '../context/WizardContext';
import { useAuth } from '../context/AuthContext';
import { createDemo, updateDemo, getDemo, wizardStateToConfig } from '../services/demosApi';
import { getAgentCoreWsUrl } from '../services/presignWs';
import { listTools } from '../services/toolsApi';
import type { SavedTool } from '../services/toolsApi';
import { notifyAgentListChanged } from '../events/agentEvents';
import PageWrapper from '../components/PageWrapper';
import styles from './POC.module.css';
import { LiveCallFrame } from './studio/LiveCallFrame';
import { listPhoneMappings, type PhoneMapping } from '../services/phoneMappingsApi';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface TranscriptEntry {
  role: 'user' | 'agent';
  text: string;
  timestamp: Date;
  type?: 'tool';
}

// Default WebSocket endpoint — reads from env or falls back to localhost
const DEFAULT_WS_URL = import.meta.env.VITE_AGENTCORE_WS_URL || 'ws://localhost:8081/ws';

function POC() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, dispatch } = useWizard();
  const { user, refreshToken } = useAuth();
  const isFromSavedAgent = !!(location.state as any)?.fromSavedAgent;
  const agentName = (location.state as any)?.agentName || state.editingDemoName || '';

  // Persist editingDemoId to sessionStorage so page refresh can restore agent config
  useEffect(() => {
    if (state.editingDemoId) {
      sessionStorage.setItem('poc_editing_demo_id', state.editingDemoId);
      if (state.editingDemoName) sessionStorage.setItem('poc_editing_demo_name', state.editingDemoName);
    }
  }, [state.editingDemoId, state.editingDemoName]);

  // Restore agent from sessionStorage on mount if wizard state is empty (page refresh)
  useEffect(() => {
    if (!state.editingDemoId && !state.prompt.instructions) {
      const savedId = sessionStorage.getItem('poc_editing_demo_id');
      const savedName = sessionStorage.getItem('poc_editing_demo_name');
      if (savedId) {
        dispatch({ type: 'SET_EDITING_DEMO', payload: { id: savedId, name: savedName || '' } });
        getDemo(savedId).then((demo) => {
          const config = demo.config;
          dispatch({ type: 'SET_HOST', payload: (config.host || 'agentcore') as any });
          dispatch({ type: 'SET_FRAMEWORK', payload: (config.framework || 'strands-bidiagent') as any });
          dispatch({ type: 'SET_MODEL', payload: config.model || ['nova-2-sonic'] });
          dispatch({ type: 'SET_PIPELINE', payload: (config.pipeline || 'speech-to-speech') as any });
          dispatch({ type: 'SET_VOICE', payload: config.voice || { voiceId: '', language: 'en-US', gender: 'female' } });
          dispatch({ type: 'SET_AGENTS', payload: { selectedAgents: config.tools || [], customTools: config.customTools || [] } });
          dispatch({ type: 'SET_PROMPT', payload: config.prompt || { greeting: config.greeting || '', instructions: config.systemPrompt || '' } });
          dispatch({ type: 'SET_TELEPHONY_ENABLED', payload: config.telephonyEnabled ?? false });
          dispatch({ type: 'SET_AGENT_START_FIRST', payload: config.agentStartFirst ?? true });
          dispatch({ type: 'SET_PHONE', payload: config.telephony?.phoneNumber || '' });
          dispatch({ type: 'SET_USE_MOCK', payload: config.useMock ?? true });
          dispatch({ type: 'SET_CALL_HISTORY_ENABLED', payload: (config as any).callHistoryEnabled ?? true });
          dispatch({ type: 'SET_CALL_LOG_ENABLED', payload: (config as any).callLogEnabled ?? false });
        }).catch(() => {});
      }
    }
  }, []);

  const formatPhoneNumber = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('disconnected');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [availableTools, setAvailableTools] = useState<SavedTool[]>([]);
  const [chatPopupOpen, setChatPopupOpen] = useState(false);

  useEffect(() => {
    listTools().then(setAvailableTools).catch(() => {});
    // Always fetch fresh agent config for display (avoid stale wizard state)
    if (state.editingDemoId) {
      getDemo(state.editingDemoId).then((demo) => {
        const config = demo.config;
        const prompt = config.prompt?.instructions || config.systemPrompt || '';
        const tools = config.tools || [];
        const customTools = config.customTools || [];
        // Update wizard state to match latest saved config
        dispatch({ type: 'SET_PROMPT', payload: { greeting: config.prompt?.greeting || '', instructions: prompt } });
        dispatch({ type: 'SET_AGENTS', payload: { selectedAgents: tools, customTools } });
        if (config.useMock !== undefined) dispatch({ type: 'SET_USE_MOCK', payload: config.useMock });
      }).catch(() => {});
    }
  }, []);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [textInput, setTextInput] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioPlayerRef = useRef<AudioContext | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const isRecordingRef = useRef(false);
  const mutedRef = useRef(false);
  const [muted, setMuted] = useState(false);
  const [endToast, setEndToast] = useState<string | null>(null);
  const [mappedNumber, setMappedNumber] = useState<string | null>(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Cleanup on unmount (navigating away)
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      processorRef.current?.disconnect();
      audioContextRef.current?.close().catch(() => {});
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioPlayerRef.current?.close().catch(() => {});
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.onclose = null;
        wsRef.current.send(JSON.stringify({ type: 'sessionEnd' }));
        wsRef.current.close(1000, 'Navigation');
      }
    };
  }, []);

  const generateSystemPrompt = useCallback(() => {
    const parts: string[] = [];
    if (state.prompt.instructions) {
      parts.push(state.prompt.instructions);
    }
    if (state.prompt.greeting) {
      parts.push(`Greeting: "${state.prompt.greeting}"`);
    }
    return parts.join('\n') || 'You are a helpful voice agent.';
  }, [state.prompt]);

  const handleServerMessage = (data: any) => {
    switch (data.type) {
      case 'sessionReady':
      case 'system':
        console.log('System:', data.message || data.config);
        // The agent reports the model's output sample rate so we play audio back
        // at the right rate (Nova Sonic 16 kHz; OpenAI Realtime / Gemini Live 24 kHz).
        // Input/capture rate is set synchronously at connect time from the
        // selected model, so we don't override it here.
        if (typeof data.outputSampleRate === 'number' && data.outputSampleRate > 0) {
          outputSampleRateRef.current = data.outputSampleRate;
        }
        break;
      case 'bidi_audio_stream':
        // Audio response from Nova Sonic
        playAudioBase64(data.audio);
        setAgentSpeaking(true);
        break;
      case 'bidi_transcript_stream':
        // Display speculative transcripts only. Nova Sonic emits both a
        // speculative and a final transcript per turn (for both user and agent);
        // showing both duplicates every line, so skip the finals for both roles.
        if (data.is_final) break;
        if (data.text && data.text.trim()) {
          setTranscript((prev) => [
            ...prev,
            { role: (data.role === 'assistant' ? 'agent' : data.role) as 'user' | 'agent', text: data.text, timestamp: new Date() },
          ]);
        }
        if (data.role === 'assistant' || data.role === 'agent') {
          setAgentSpeaking(true);
        }
        break;
      case 'bidi_interruption':
        // User barged in — stop audio playback
        stopAudioPlayback();
        break;
      case 'transcript':
        // Legacy format (greeting)
        setTranscript((prev) => [
          ...prev,
          {
            role: data.role as 'user' | 'agent',
            text: data.text,
            timestamp: new Date(),
          },
        ]);
        break;
      case 'agentStartSpeaking':
        setAgentSpeaking(true);
        break;
      case 'agentStopSpeaking':
        setAgentSpeaking(false);
        break;
      case 'error':
        setError(data.message || 'Server error');
        break;
      case 'tool_call':
        // Debug: tool was invoked by the agent
        setTranscript((prev) => [
          ...prev,
          { role: 'agent', text: `🔧 [${data.tool}] ${Object.keys(data.args || {}).length > 0 ? JSON.stringify(data.args) : ''}`, timestamp: new Date(), type: 'tool' },
        ]);
        break;
      case 'tool_result':
        // Debug: tool returned a result
        // Skip protocol-level tool_result messages (from BidiAgent framework) that don't have our 'tool' field
        if (data.tool) {
          setTranscript((prev) => [
            ...prev,
            { role: 'agent', text: `✅ [${data.tool}] → ${data.result || ''}`, timestamp: new Date(), type: 'tool' },
          ]);
        }
        // else: protocol tool_result (has toolUseId/content) — already shown via our _notify_tool_result
        break;
      case 'sessionEnd':
        // Agent ended the call via end_call tool
        setTranscript((prev) => [
          ...prev,
          { role: 'agent', text: '📞 Call ended.', timestamp: new Date() },
        ]);
        stopAudioPlayback();
        setConnectionStatus('disconnected');
        if (wsRef.current) {
          wsRef.current.close(1000, 'agent_ended');
          wsRef.current = null;
        }
        break;
      case 'transfer':
        // Agent transferred to human via transfer_to_human tool
        setTranscript((prev) => [
          ...prev,
          { role: 'agent', text: `🔄 Transferring to a human agent${data.reason ? `: ${data.reason}` : ''}.`, timestamp: new Date() },
        ]);
        stopAudioPlayback();
        setConnectionStatus('disconnected');
        if (wsRef.current) {
          wsRef.current.close(1000, 'transfer');
          wsRef.current = null;
        }
        break;
    }
  };

  const nextPlayTimeRef = useRef(0);
  const activeSourcesRef = useRef(0);
  // Sample rates negotiated with the agent's "system" ready message. Nova Sonic
  // is 16 kHz; OpenAI Realtime and Gemini Live are 24 kHz. Default to 16 kHz
  // until the agent tells us otherwise.
  const outputSampleRateRef = useRef(16000);
  const inputSampleRateRef = useRef(16000);

  const playAudioBase64 = async (base64Audio: string) => {
    try {
      if (!audioPlayerRef.current) {
        audioPlayerRef.current = new AudioContext({ sampleRate: outputSampleRateRef.current });
        nextPlayTimeRef.current = 0;
        activeSourcesRef.current = 0;
      }

      if (audioPlayerRef.current.state === 'suspended') {
        await audioPlayerRef.current.resume();
      }

      // Decode base64 to Int16 PCM
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const int16Data = new Int16Array(bytes.buffer);

      // Convert Int16 to Float32
      const float32Data = new Float32Array(int16Data.length);
      for (let i = 0; i < int16Data.length; i++) {
        float32Data[i] = int16Data[i] / 32768.0;
      }

      // Create AudioBuffer at the model's output rate
      const buffer = audioPlayerRef.current.createBuffer(1, float32Data.length, outputSampleRateRef.current);
      buffer.getChannelData(0).set(float32Data);

      const currentTime = audioPlayerRef.current.currentTime;
      if (nextPlayTimeRef.current < currentTime) {
        nextPlayTimeRef.current = currentTime + 0.05;
      }

      // Schedule playback
      const source = audioPlayerRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioPlayerRef.current.destination);
      source.start(nextPlayTimeRef.current);
      nextPlayTimeRef.current += buffer.duration;

      activeSourcesRef.current++;
      source.onended = () => {
        activeSourcesRef.current--;
        if (activeSourcesRef.current <= 0) {
          activeSourcesRef.current = 0;
          setAgentSpeaking(false);
        }
      };
    } catch {
      // Audio playback error — non-fatal
    }
  };

  const stopAudioPlayback = () => {
    setAgentSpeaking(false);
    nextPlayTimeRef.current = 0;
    activeSourcesRef.current = 0;
    if (audioPlayerRef.current) {
      // Close immediately — this kills all scheduled/playing audio sources
      audioPlayerRef.current.close().catch(() => {});
      audioPlayerRef.current = null;
    }
  };

  const startAudioCapture = async () => {
    try {
      // Capture at the model's input rate (Nova 16 kHz; OpenAI/Gemini 24 kHz).
      const captureRate = inputSampleRateRef.current || 16000;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: captureRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: captureRate });
      audioContextRef.current = audioContext;

      // Resume context (required by some browsers after user gesture)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!isRecordingRef.current) return;
        if (mutedRef.current) return;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Calculate audio level for visualization
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        setAudioLevel(Math.min(1, rms * 10));

        // Resample to the model's input rate and convert to Int16 PCM
        const SAMPLE_RATE = captureRate;
        const downsampleRatio = audioContext.sampleRate / SAMPLE_RATE;
        const outputLength = Math.floor(inputData.length / downsampleRatio);
        const int16Data = new Int16Array(outputLength);

        for (let i = 0; i < outputLength; i++) {
          const sourceIndex = Math.floor(i * downsampleRatio);
          int16Data[i] = Math.max(-32768, Math.min(32767,
            inputData[sourceIndex] * 32768));
        }

        // Convert Int16Array to base64
        const bytes = new Uint8Array(int16Data.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Audio = btoa(binary);

        // Send as JSON event (BidiAgent protocol)
        wsRef.current.send(JSON.stringify({
          type: 'bidi_audio_input',
          audio: base64Audio,
          format: 'pcm',
          sample_rate: SAMPLE_RATE,
          channels: 1,
        }));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      isRecordingRef.current = true;
      setIsRecording(true);
      console.log('Audio capture started');
    } catch (err) {
      setError(
        'Microphone access denied. Please allow microphone access and try again.'
      );
    }
  };

  const stopAudioCapture = () => {
    isRecordingRef.current = false;
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
    setAudioLevel(0);
  };

  const handleStartConversation = async () => {
    setError(null);
    setTranscript([]);

    // Clean up any existing connection
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionStatus('connecting');

    try {
      // Refresh token before generating presigned URL (handles expired sessions)
      const freshToken = await refreshToken();

      // Generate a fresh presigned URL (or fall back to static URL for local dev)
      const connectionUrl = await getAgentCoreWsUrl(freshToken || user?.token || '');

      // Connect with retry for cold starts (AgentCore can take 30-60s on first invocation)
      let ws: WebSocket | null = null;
      let connected = false;
      const maxAttempts = 3;

      for (let attempt = 1; attempt <= maxAttempts && !connected; attempt++) {
        const url = attempt === 1 ? connectionUrl : await getAgentCoreWsUrl(freshToken || user?.token || '');
        ws = new WebSocket(url);
        wsRef.current = ws;

        try {
          await new Promise<void>((resolve, reject) => {
            ws!.onopen = () => { connected = true; resolve(); };
            ws!.onerror = () => reject(new Error('WebSocket connection failed'));
            setTimeout(() => reject(new Error('Connection timeout')), 30000);
          });
        } catch (err) {
          if (attempt < maxAttempts) {
            console.log(`Attempt ${attempt} failed (cold start?), retrying...`);
            ws?.close();
            await new Promise(r => setTimeout(r, 2000));
          } else {
            throw err;
          }
        }
      }

      if (!ws || !connected) throw new Error('Failed to connect after retries');

      setConnectionStatus('connected');

      // Set up message handler
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleServerMessage(data);
        } catch {
          // Non-JSON data (shouldn't happen with BidiAgent)
          console.warn('Received non-JSON message:', event.data);
        }
      };

      // Set up close handler
      ws.onclose = (event) => {
        setConnectionStatus('disconnected');
        isRecordingRef.current = false;
        setIsRecording(false);
        setAudioLevel(0);
        if (event.code !== 1000) {
          setError(
            `Connection closed (code ${event.code}). ${event.reason || 'Check server status.'}`
          );
        }
      };

      ws.onerror = () => {
        setConnectionStatus('error');
        setError('WebSocket error occurred.');
      };

      // Send session config
      // Resolve tools: fetch fresh config from DB to avoid stale wizard state
      let agentConfig: any = null;
      if (state.editingDemoId) {
        try {
          const demo = await getDemo(state.editingDemoId);
          agentConfig = demo.config;
        } catch (e) {
          console.warn('Failed to fetch agent config from DB, using wizard state');
        }
      }

      // Use DB config if available, fall back to wizard state
      const configTools = agentConfig?.tools || state.agents.selectedAgents;
      const configCustomTools = agentConfig?.customTools || state.agents.customTools || [];
      const configSystemPrompt = agentConfig?.prompt?.instructions || agentConfig?.systemPrompt || generateSystemPrompt();
      const configVoice = agentConfig?.voice || state.voice;

      const configInferenceConfig = agentConfig?.inferenceConfig || state.inferenceConfig || undefined;

      // Resolve int:GUID tool references to full tool specs for the runtime
      const resolvedTools = configTools
        .filter((id: string) => id.startsWith('int:'))
        .map((id: string) => {
          const tool = availableTools.find((t) => `int:${t.id}` === id || t.id === id);
          if (!tool) return null;
          const spec: any = {
            name: tool.name,
            description: tool.description || '',
            parameters: tool.parameters || '',
          };
          // Only include mockResponse when mock mode is enabled
          if (state.useMock) {
            spec.mockResponse = tool.mockResponse || 'Tool executed successfully.';
          } else {
            // In live mode, include endpoint/arn/gatewayId so the runtime can call it
            if (tool.endpoint) spec.endpoint = tool.endpoint;
            if (tool.method) spec.method = tool.method;
            if (tool.functionArn) spec.functionArn = tool.functionArn;
            // Route by tool type: subagent uses A2A, mcp uses gateway
            if (tool.type === 'subagent' && tool.gatewayId) {
              spec.subagentArn = tool.gatewayId; // gatewayId stores runtime name for subagents
            } else if (tool.gatewayId) {
              spec.gatewayId = tool.gatewayId;
            }
            if ((tool as any).subagentArn) spec.subagentArn = (tool as any).subagentArn;
            if ((tool as any).skillPath) spec.skillPath = (tool as any).skillPath;
            // If no real integration configured, still include mock as fallback
            if (!tool.endpoint && !tool.functionArn && !tool.gatewayId && !(tool as any).subagentArn && !(tool as any).skillPath) {
              spec.mockResponse = tool.mockResponse || 'Tool executed successfully.';
            }
          }
          return spec;
        })
        .filter(Boolean);

      // Combine with any existing customTools from DB config
      const allCustomTools = [
        ...configCustomTools,
        ...resolvedTools,
      ];

      // Non-int tools (built-in registry names like "crm", "transfer")
      const builtinTools = configTools.filter((id: string) => !id.startsWith('int:'));

      // Extract gateway IDs for auto-discovery (passed in tools array since AgentCore strips customTools)
      const gatewayIds = allCustomTools
        .filter((t: any) => t.gatewayId && !t.mockResponse)
        .map((t: any) => `gateway:${t.gatewayId}`);

      // Also embed gateway IDs in system prompt (most reliable passthrough)
      const gatewayTags = allCustomTools
        .filter((t: any) => t.gatewayId && !t.mockResponse)
        .map((t: any) => `[GATEWAY:${t.gatewayId}]`)
        .join(' ');
      const systemPromptWithGateways = gatewayTags
        ? `${configSystemPrompt}\n\n${gatewayTags}`
        : configSystemPrompt;

      // Encode tool config as JSON string in greeting field (AgentCore preserves string fields)
      // Truncate mockResponse to avoid exceeding AgentCore's 64KB WebSocket frame limit
      const toolConfigForGreeting = allCustomTools.map((t: any) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
        mockResponse: t.mockResponse ? t.mockResponse.substring(0, 200) : '',
      }));
      const toolConfigPayload = toolConfigForGreeting.length > 0
        ? JSON.stringify({ customTools: toolConfigForGreeting })
        : '';

      const sessionConfig = {
        type: 'sessionConfig',
        clientId: crypto.randomUUID(),
        host: state.host,
        framework: state.framework,
        model: state.model,
        systemPrompt: systemPromptWithGateways,
        tools: [...builtinTools, ...gatewayIds],
        customTools: allCustomTools.map((t: any) => ({ name: t.name, description: t.description, parameters: t.parameters, mockResponse: (t.mockResponse || '').substring(0, 200) })),
        greeting: toolConfigPayload || state.prompt.greeting || '',
        useMock: state.useMock,
        voice: {
          voiceId: configVoice.voiceId,
          language: configVoice.language,
          gender: configVoice.gender,
        },
        pipeline: state.pipeline,
        agentStartFirst: state.agentStartFirst,
        telephony: state.phoneNumber ? {
          provider: 'twilio',
          phoneNumber: state.phoneNumber,
        } : undefined,
        apiKeys: (state.apiKeys.openai || state.apiKeys.gemini) ? {
          openai: state.apiKeys.openai || undefined,
          gemini: state.apiKeys.gemini || undefined,
        } : undefined,
        inferenceConfig: configInferenceConfig,
        callHistoryEnabled: state.callHistoryEnabled ?? true,
        callLogEnabled: state.callLogEnabled ?? false,
        agentId: state.editingDemoId || '',
        source: 'webchat',
        callerId: user?.username || user?.email || '',
      };
      console.log('[POC] Session config being sent:', { tools: builtinTools.length, customTools: allCustomTools.length, customToolNames: allCustomTools.map((t: any) => t.name) });
      ws.send(JSON.stringify(sessionConfig));

      // Determine the capture (input) rate synchronously from the selected model
      // so we can start the mic immediately — waiting on the server's ready
      // message delayed capture and clipped the start of the caller's first
      // words (garbling names/numbers for Nova). Nova = 16 kHz; OpenAI/Gemini = 24 kHz.
      const _selModel = (state.model || ['nova-2-sonic'])[0];
      inputSampleRateRef.current =
        _selModel === 'openai-realtime' || _selModel === 'gemini-live' ? 24000 : 16000;

      // Start audio capture immediately (as before the multi-provider change).
      // The server's "system" message still updates the playback rate on arrival.
      await startAudioCapture();
    } catch (err: any) {
      setConnectionStatus('error');
      setError(err?.message || 'Failed to connect to voice agent server.');
    }
  };

  // Save (or update) the current agent to the account. Available regardless of
  // whether telephony is configured — mirrors the Summary page's save logic.
  const handleSaveAgent = async () => {
    setSaving(true);
    try {
      if (state.editingDemoId) {
        // Editing an existing agent — update it in place.
        await updateDemo(state.editingDemoId, { config: wizardStateToConfig(state) });
      } else {
        // New agent — prompt for a name and create it.
        const name = window.prompt('Agent name:', state.editingDemoName || agentName || 'My Agent');
        if (!name) {
          setSaving(false);
          return;
        }
        const created = await createDemo({ name, config: wizardStateToConfig(state) });
        dispatch({ type: 'SET_EDITING_DEMO', payload: { id: created.id, name } });
      }
      setSaveSuccess(true);
      notifyAgentListChanged();
      // Reset the "Saved" confirmation after a moment so the button can be reused.
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save agent');
    } finally {
      setSaving(false);
    }
  };

  const handleStopConversation = () => {
    if (!isRecordingRef.current && !wsRef.current) return;

    // Stop microphone capture immediately
    stopAudioCapture();

    // Stop audio playback immediately
    stopAudioPlayback();

    // Close WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'sessionEnd' }));
      wsRef.current.onclose = null;
      wsRef.current.close(1000, 'User ended conversation');
    }
    wsRef.current = null;
    setConnectionStatus('disconnected');
    setAgentSpeaking(false);
  };


  useEffect(() => {
    const agentId = state.editingDemoId;
    if (!agentId) { setMappedNumber(null); return; }
    listPhoneMappings()
      .then((rows: PhoneMapping[]) => {
        const hit = rows.find((m) => m.demoId === agentId);
        setMappedNumber(hit ? hit.phoneNumber : null);
      })
      .catch(() => setMappedNumber(null));
  }, [state.editingDemoId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (agentSpeaking) stopAudioPlayback();
        else if (!isRecordingRef.current) handleStartConversation();
      } else if (e.key === 'm' || e.key === 'M') {
        mutedRef.current = !mutedRef.current;
        setMuted(mutedRef.current);
      } else if (e.key === 'Escape') {
        endAndLeave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const endAndLeave = () => {
    handleStopConversation();
    setEndToast('Saved to Call history');
    setTimeout(() => navigate('/calls'), 600);
  };

  const getSteps = () => {
    if (state.path === 'minimal') {
      return [
        { label: 'Voice', active: false, completed: true },
        { label: 'Flow', active: false, completed: true },
        { label: 'Summary', active: false, completed: true },
        { label: 'Try It', active: true, completed: false },
      ];
    }
    return [
      { label: 'Pipeline', active: false, completed: true },
      { label: 'Model', active: false, completed: true },
      { label: 'Voice', active: false, completed: true },
      { label: 'Flow', active: false, completed: true },
      { label: 'Summary', active: false, completed: true },
      { label: 'Try It', active: true, completed: false },
    ];
  };

  return (
    <LiveCallFrame
      agentName={agentName || state.editingDemoName || 'Voice agent'}
      status={connectionStatus}
      isRecording={isRecording}
      agentSpeaking={agentSpeaking}
      muted={muted}
      transcript={transcript}
      error={error}
      phoneLabel={mappedNumber}
      toast={endToast}
      transcriptEndRef={transcriptEndRef}
      onBack={() => navigate(isFromSavedAgent ? '/agents' : '/summary')}
      onStart={() => { void handleStartConversation(); }}
      onEnd={endAndLeave}
      onToggleMute={() => {
        mutedRef.current = !mutedRef.current;
        setMuted(mutedRef.current);
      }}
      onInterrupt={() => stopAudioPlayback()}
    />
  );
}

function TechnicalReport({ state }: { state: any }) {
  const [tools, setTools] = useState<any[]>([]);
  useEffect(() => { listTools().then(setTools).catch(() => {}); }, []);
  return (
    <div className={styles.report}>
      <h3 className={styles.reportTitle}>Technical Breakdown</h3>
      <p className={styles.reportSubtitle}>
        Architecture and service details for your configured voice agent POC.
      </p>

      <div className={styles.reportSections}>
        {/* Architecture Diagram */}
        <div className={styles.reportSection}>
          <h4>Architecture</h4>
          {state.pipeline === 'speech-to-speech' ? (
            <div className={styles.archDiagram}>
              <div className={styles.archNode}>
                <span className={styles.archIcon}>🌐</span>
                <strong>Browser Client</strong>
                <p>WebSocket + MediaStream API</p>
              </div>
              <div className={styles.archArrow}>⇄ WSS</div>
              <div className={styles.archNode}>
                <span className={styles.archIcon}>☁️</span>
                <strong>AgentCore Runtime</strong>
                <p>Strands BidiAgent</p>
              </div>
              <div className={styles.archArrow}>⇄</div>
              <div className={styles.archNodeHighlight}>
                <span className={styles.archIcon}>🎙️</span>
                <strong>Amazon Nova Sonic</strong>
                <p>Speech-to-Speech Model</p>
              </div>
            </div>
          ) : (
            <div className={styles.archDiagram}>
              <div className={styles.archNode}>
                <span className={styles.archIcon}>🌐</span>
                <strong>Browser Client</strong>
                <p>WebSocket Audio Stream</p>
              </div>
              <div className={styles.archArrow}>⇄ WSS</div>
              <div className={styles.archNode}>
                <span className={styles.archIcon}>☁️</span>
                <strong>AgentCore Runtime</strong>
                <p>Orchestrator</p>
              </div>
              <div className={styles.archArrow}>→</div>
              <div className={styles.archCascade}>
                <div className={styles.cascadeNode}>
                  <strong>
                    {state.cascaded.sttProvider === 'transcribe'
                      ? 'Amazon Transcribe'
                      : 'Deepgram'}
                  </strong>
                  <p>STT</p>
                </div>
                <span>→</span>
                <div className={styles.cascadeNode}>
                  <strong>
                    {state.cascaded.llmProvider === 'nova-lite'
                      ? 'Nova Lite'
                      : 'GPT'}
                  </strong>
                  <p>LLM (Bedrock)</p>
                </div>
                <span>→</span>
                <div className={styles.cascadeNode}>
                  <strong>
                    {state.cascaded.ttsProvider === 'polly'
                      ? 'Amazon Polly'
                      : 'Eleven Labs'}
                  </strong>
                  <p>TTS</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Services Breakdown */}
        <div className={styles.reportSection}>
          <h4>Services Used</h4>
          <table className={styles.serviceTable}>
            <thead>
              <tr>
                <th>Component</th>
                <th>Service</th>
                <th>Purpose</th>
                <th>Region</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="Component">Runtime</td>
                <td data-label="Service">Amazon Bedrock AgentCore</td>
                <td data-label="Purpose">WebSocket server hosting the voice agent</td>
                <td data-label="Region">us-east-1</td>
              </tr>
              <tr>
                <td data-label="Component">Agent Framework</td>
                <td data-label="Service">Strands Agents SDK (BidiAgent)</td>
                <td data-label="Purpose">Bidirectional streaming orchestration</td>
                <td data-label="Region">—</td>
              </tr>
              {state.pipeline === 'speech-to-speech' ? (
                <tr>
                  <td data-label="Component">Voice Model</td>
                  <td data-label="Service">Amazon Nova Sonic</td>
                  <td data-label="Purpose">End-to-end speech understanding and generation</td>
                  <td data-label="Region">us-east-1</td>
                </tr>
              ) : (
                <>
                  <tr>
                    <td data-label="Component">STT</td>
                    <td data-label="Service">
                      {state.cascaded.sttProvider === 'transcribe'
                        ? 'Amazon Transcribe'
                        : 'Deepgram'}
                    </td>
                    <td data-label="Purpose">Real-time speech-to-text transcription</td>
                    <td data-label="Region">us-east-1</td>
                  </tr>
                  <tr>
                    <td data-label="Component">LLM</td>
                    <td data-label="Service">
                      {state.cascaded.llmProvider === 'nova-lite'
                        ? 'Amazon Nova Lite (Bedrock)'
                        : 'GPT (via Bedrock)'}
                    </td>
                    <td data-label="Purpose">Natural language understanding and response generation</td>
                    <td data-label="Region">us-east-1</td>
                  </tr>
                  <tr>
                    <td data-label="Component">TTS</td>
                    <td data-label="Service">
                      {state.cascaded.ttsProvider === 'polly'
                        ? 'Amazon Polly'
                        : 'Eleven Labs'}
                    </td>
                    <td data-label="Purpose">Text-to-speech synthesis</td>
                    <td data-label="Region">us-east-1</td>
                  </tr>
                </>
              )}
              <tr>
                <td data-label="Component">Transport</td>
                <td data-label="Service">WebSocket (WSS)</td>
                <td data-label="Purpose">Bidirectional audio streaming</td>
                <td data-label="Region">—</td>
              </tr>
              <tr>
                <td data-label="Component">Client Audio</td>
                <td data-label="Service">Web Audio API + MediaStream</td>
                <td data-label="Purpose">Microphone capture (16kHz PCM) and playback (24kHz)</td>
                <td data-label="Region">—</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Configuration Details */}
        <div className={styles.reportSection}>
          <h4>Configuration</h4>
          <div className={styles.configGrid}>
            <div className={styles.configBlock}>
              <h5>Voice</h5>
              <ul>
                <li>
                  <strong>Voice ID:</strong> {state.voice.voiceId || '—'}
                </li>
                <li>
                  <strong>Language:</strong> {state.voice.language}
                </li>
                <li>
                  <strong>Gender:</strong> {state.voice.gender}
                </li>
              </ul>
            </div>
            <div className={styles.configBlock}>
              <h5>Agent Tools</h5>
              <ul>
                {state.agents.selectedAgents.length > 0 ? (
                  state.agents.selectedAgents.map((id: string) => {
                    const tool = tools.find((t: any) => `int:${t.id}` === id || t.id === id);
                    const label = tool ? tool.name : id.replace('int:', '').substring(0, 8) + '...';
                    const typeLabel = tool ? (tool.type === 'webhook' ? 'API' : tool.type) : '';
                    return <li key={id}>{typeLabel ? `${typeLabel}: ${label}` : label}</li>;
                  })
                ) : (
                  <li>None configured</li>
                )}
              </ul>
            </div>
            <div className={styles.configBlock}>
              <h5>Audio Settings</h5>
              <ul>
                <li>
                  <strong>Input:</strong> 16kHz, mono, PCM16
                </li>
                <li>
                  <strong>Output:</strong> 24kHz, mono
                </li>
                <li>
                  <strong>Echo Cancellation:</strong> Enabled
                </li>
                <li>
                  <strong>Noise Suppression:</strong> Enabled
                </li>
              </ul>
            </div>
            <div className={styles.configBlock}>
              <h5>Features</h5>
              <ul>
                <li>✓ Barge-in support</li>
                <li>✓ Real-time transcription</li>
                <li>✓ Automatic turn-taking</li>
                <li>
                  {state.pipeline === 'speech-to-speech'
                    ? '✓ Native speech understanding'
                    : '✓ Cascaded pipeline orchestration'}
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* System Prompt */}
        <div className={styles.reportSection}>
          <h4>System Prompt</h4>
          <pre className={styles.promptBlock}>
            {`${state.prompt.instructions || 'You are a helpful voice agent.'}${state.prompt.greeting ? `\nGreeting: "${state.prompt.greeting}"` : ''}`}
          </pre>
        </div>

        {/* Deployment Info */}
        <div className={styles.reportSection}>
          <h4>Deployment Details</h4>
          <div className={styles.deployInfo}>
            <div className={styles.deployRow}>
              <span>Hosting</span>
              <strong>Amazon Bedrock AgentCore (WebSocket Runtime)</strong>
            </div>
            <div className={styles.deployRow}>
              <span>Agent SDK</span>
              <strong>Strands Agents — BidiAgent</strong>
            </div>
            <div className={styles.deployRow}>
              <span>Protocol</span>
              <strong>WebSocket (WSS) — Bidirectional Streaming</strong>
            </div>
            <div className={styles.deployRow}>
              <span>Authentication</span>
              <strong>IAM SigV4 (via Cognito Identity Pool)</strong>
            </div>
            {state.path === 'some-technical' && (
              <>
                <div className={styles.deployRow}>
                  <span>Telephony</span>
                  <strong>Twilio + Harmonex</strong>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default POC;
