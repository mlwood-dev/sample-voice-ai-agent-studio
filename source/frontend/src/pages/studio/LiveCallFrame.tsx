import type { ReactNode, RefObject } from 'react';
import { IconBack, IconMic, IconMicOff, IconPhoneOff } from '../../studio/icons';
import styles from '../../studio/studio.module.css';

export type LiveStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface Turn {
  role: 'user' | 'agent';
  text: string;
  type?: string;
}

interface LiveCallFrameProps {
  agentName: string;
  status: LiveStatus;
  isRecording: boolean;
  agentSpeaking: boolean;
  muted: boolean;
  transcript: Turn[];
  error?: string | null;
  phoneLabel?: string | null;
  toast?: string | null;
  onBack: () => void;
  onStart: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onInterrupt: () => void;
  transcriptEndRef?: RefObject<HTMLDivElement | null>;
  footer?: ReactNode;
}

export function LiveCallFrame({
  agentName,
  status,
  isRecording,
  agentSpeaking,
  muted,
  transcript,
  error,
  phoneLabel,
  toast,
  onBack,
  onStart,
  onEnd,
  onToggleMute,
  onInterrupt,
  transcriptEndRef,
  footer,
}: LiveCallFrameProps) {
  const live = isRecording || status === 'connected' || status === 'connecting';
  let caption = 'Tap the mic to start';
  let micClass = styles.micIdle;
  if (status === 'connecting') { caption = 'Connecting…'; micClass = styles.micConnect; }
  else if (muted && live) { caption = 'Muted'; micClass = styles.micMute; }
  else if (agentSpeaking) { caption = 'Speaking'; micClass = styles.micSpeak; }
  else if (isRecording) { caption = 'Listening'; micClass = styles.micListen; }
  else if (status === 'error') { caption = 'Could not connect'; micClass = styles.micIdle; }

  const handleMic = () => {
    if (!live) onStart();
    else if (agentSpeaking) onInterrupt();
  };

  return (
    <div className={styles.callStage}>
      <div className={styles.callHead}>
        <button type="button" className={styles.iconBtn} style={{ color: '#e7f0ec' }} aria-label="Back" onClick={onBack}><IconBack /></button>
        <div className={styles.callHeadBody}>
          <div style={{ fontWeight: 700 }}>{agentName || 'Voice agent'}</div>
          {live && <div className={styles.callLive}><span className={styles.dot} /> Live</div>}
        </div>
        <span style={{ width: 48 }} />
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {agentSpeaking && <div className={styles.statePill}>Agent speaking — tap mic to interrupt</div>}
      <div className={styles.transcript}>
        {transcript.filter((t) => t.type !== 'tool').map((t, i) => (
          <div key={i} className={`${styles.bubble} ${t.role === 'user' ? styles.bubbleYou : styles.bubbleAgent}`}>
            <div className={styles.bubbleMeta}>{t.role === 'user' ? 'You' : 'Agent'}</div>
            {t.text}
          </div>
        ))}
        <div ref={transcriptEndRef} />
      </div>
      <div className={styles.thumbZone}>
        <div>
          {live && (
            <button type="button" className={`${styles.roundBtn} ${styles.muteBtn}`} aria-label={muted ? 'Unmute' : 'Mute'} onClick={onToggleMute}>
              {muted ? <IconMicOff /> : <IconMic />}
            </button>
          )}
          {live && <div className={styles.roundLabel}>{muted ? 'Unmute' : 'Mute'}</div>}
        </div>
        <div className={styles.micWrap}>
          <div className={styles.micRing}>
            <button type="button" className={`${styles.micCore} ${micClass}`} aria-label={live ? 'Interrupt' : 'Start call'} onClick={handleMic}>
              <IconMic size={36} />
            </button>
          </div>
          <div className={styles.micCaption}>{caption}</div>
        </div>
        <div>
          {live && (
            <button type="button" className={`${styles.roundBtn} ${styles.endBtn}`} aria-label="End call" onClick={onEnd}>
              <IconPhoneOff />
            </button>
          )}
          {live && <div className={styles.roundLabel}>End</div>}
        </div>
      </div>
      {phoneLabel && <p className={styles.hint}>Call from a phone: {phoneLabel}</p>}
      {!phoneLabel && <p className={styles.hint}>Web call · Space starts, M mutes, Esc ends</p>}
      {footer}
      {toast && <div className={styles.toast} role="status">{toast}</div>}
    </div>
  );
}

export default LiveCallFrame;
