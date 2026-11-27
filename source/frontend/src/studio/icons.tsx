import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function I({ size = 24, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const IconAgents = (p: IconProps) => <I {...p}><path d="M3 21V8l9-5 9 5v13" /><path d="M9 21v-8h6v8" /></I>;
export const IconCalls = (p: IconProps) => <I {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></I>;
export const IconEvals = (p: IconProps) => <I {...p}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></I>;
export const IconMore = (p: IconProps) => <I {...p}><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></I>;
export const IconPlus = (p: IconProps) => <I {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></I>;
export const IconSearch = (p: IconProps) => <I {...p}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></I>;
export const IconBack = (p: IconProps) => <I {...p}><polyline points="15 18 9 12 15 6" /></I>;
export const IconClose = (p: IconProps) => <I {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></I>;
export const IconChevron = (p: IconProps) => <I {...p}><polyline points="9 18 15 12 9 6" /></I>;
export const IconMic = (p: IconProps) => <I {...p}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></I>;
export const IconMicOff = (p: IconProps) => <I {...p}><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12" /><path d="M15 9.34V4a3 3 0 0 0-5.94-.6" /><path d="M17 16.95A7 7 0 0 1 5 12v-2" /><path d="M19 10v2a7 7 0 0 1-.27 1.94" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></I>;
export const IconPhoneOff = (p: IconProps) => <I {...p}><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.3 12.3 0 0 0 4.53.77 2 2 0 0 1 2 2V20a2 2 0 0 1-2 2A18 18 0 0 1 6.39 7.61" /><line x1="1" y1="1" x2="23" y2="23" /><path d="M15.7 3.3a11 11 0 0 1 5 5" /></I>;
export const IconPhone = (p: IconProps) => <I {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.68 2.35a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.73-1.27a2 2 0 0 1 2.11-.45c.75.32 1.54.55 2.35.68A2 2 0 0 1 22 16.92z" /></I>;
export const IconSparkle = (p: IconProps) => <I {...p}><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" /><path d="M19 15l.6 2.2L22 18l-2.4.8L19 21l-.6-2.2L16 18l2.4-.8L19 15z" /></I>;
export const IconWave = (p: IconProps) => <I {...p}><path d="M3 12h2v0M8 8v8M12 5v14M16 8v8M21 12h-2" /><line x1="4" y1="8" x2="4" y2="16" /><line x1="8" y1="5" x2="8" y2="19" /><line x1="12" y1="3" x2="12" y2="21" /><line x1="16" y1="5" x2="16" y2="19" /><line x1="20" y1="8" x2="20" y2="16" /></I>;
export const IconPlay = (p: IconProps) => <I {...p}><polygon points="6 4 20 12 6 20 6 4" /></I>;
export const IconEdit = (p: IconProps) => <I {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></I>;
export const IconShield = (p: IconProps) => <I {...p}><path d="M12 3l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4z" /></I>;
export const IconTool = (p: IconProps) => <I {...p}><path d="M14.7 6.3a5 5 0 0 0-6.6 6.6L3 18l3 3 5.1-5.1a5 5 0 0 0 6.6-6.6L15 12l-3-3 2.7-2.7z" /></I>;
export const IconBook = (p: IconProps) => <I {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></I>;
export const IconSettings = (p: IconProps) => <I {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></I>;
export const IconLogout = (p: IconProps) => <I {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></I>;
export const IconSkills = (p: IconProps) => <I {...p}><path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3z" /></I>;
export const IconAgent = (p: IconProps) => <I {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></I>;
export const IconCheck = (p: IconProps) => <I {...p}><polyline points="20 6 9 17 4 12" /></I>;

export const IconPause = (p: IconProps) => <I {...p}><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></I>;
export const IconCopy = (p: IconProps) => <I {...p}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></I>;
export const IconDownload = (p: IconProps) => <I {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></I>;
