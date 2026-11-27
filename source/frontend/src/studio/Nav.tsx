import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useStudio } from './StudioContext';
import { initials } from './loadAgent';
import {
  IconAgents, IconCalls, IconEvals, IconMore, IconBook, IconTool, IconSkills, IconAgent,
  IconPhone, IconSettings, IconLogout, IconChevron,
} from './icons';
import styles from './studio.module.css';

const TABS = [
  { to: '/agents', label: 'Agents', icon: IconAgents, match: (p: string) => p === '/' || p.startsWith('/agents') },
  { to: '/calls', label: 'Calls', icon: IconCalls, match: (p: string) => p.startsWith('/calls') },
  { to: '/evals', label: 'Evals', icon: IconEvals, match: (p: string) => p.startsWith('/eval') },
  { to: '/more', label: 'More', icon: IconMore, match: (p: string) => p.startsWith('/more') || p.startsWith('/integrations') || p.startsWith('/telephony') || p.startsWith('/settings') },
];

export function pathShowsTabs(pathname: string): boolean {
  if (pathname === '/poc') return false;
  if (pathname === '/start' || pathname === '/summary' || pathname === '/launch') return false;
  if (pathname.startsWith('/calls/')) return false;
  if (/^\/agents\/[^/]+/.test(pathname)) return false;
  if (/^\/eval-suites\/[^/]+/.test(pathname)) return false;
  const wizard = ['/voice-1s', '/pipeline', '/speech-to-speech', '/cascaded', '/tools-selection', '/prompt-builder'];
  if (wizard.includes(pathname)) return false;
  return true;
}

export function BottomTabs() {
  const { pathname } = useLocation();
  return (
    <nav className={styles.tabBar} aria-label="Primary">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        const Icon = tab.icon;
        return (
          <NavLink key={tab.to} to={tab.to} className={`${styles.tabItem} ${active ? styles.tabItemActive : ''}`} aria-current={active ? 'page' : undefined}>
            <span className={styles.tabPill}><Icon size={22} /></span>
            {tab.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

const CAPABILITY_LINKS = [
  { to: '/integrations/rag', label: 'Knowledge bases', icon: IconBook },
  { to: '/integrations/tools', label: 'Tools', icon: IconTool },
  { to: '/integrations/skills', label: 'Skills', icon: IconSkills },
  { to: '/integrations/sub-agents', label: 'Sub-agents', icon: IconAgent },
];

export function SideNav() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { selectedAgent } = useStudio();
  const navigate = useNavigate();
  const [capsOpen, setCapsOpen] = useState(true);

  return (
    <aside className={styles.sideNav}>
      <NavLink to="/agents" className={styles.brand}>
        <img src="/favicon.svg" alt="" width={32} height={32} />
        <span className={styles.brandText}>
          <span className={styles.brandName}>Everwood Technologies</span>
          <span className={styles.brandSub}>x AWS-Sample</span>
        </span>
      </NavLink>

      {selectedAgent && (
        <button
          type="button"
          className={styles.navItem}
          title="Switch agent"
          onClick={() => navigate('/agents')}
        >
          <span className={styles.avatar} style={{ width: 28, height: 28, fontSize: 11, borderRadius: 8 }}>{initials(selectedAgent.name)}</span>
          <span className={styles.navLabel}>{selectedAgent.name}</span>
          <IconChevron size={16} />
        </button>
      )}

      {TABS.filter((t) => t.label !== 'More').map((tab) => {
        const Icon = tab.icon;
        const active = tab.match(pathname);
        return (
          <NavLink key={tab.to} to={tab.to} className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}>
            <Icon size={20} />
            <span className={styles.navLabel}>{tab.label}</span>
          </NavLink>
        );
      })}

      <button type="button" className={styles.navSection} onClick={() => setCapsOpen((v) => !v)} style={{ cursor: 'pointer', border: 'none', background: 'none', width: '100%', textAlign: 'left' }}>
        Agent capabilities
      </button>
      {capsOpen && CAPABILITY_LINKS.map((l) => {
        const Icon = l.icon;
        const active = pathname.startsWith(l.to);
        return (
          <NavLink key={l.to} to={l.to} className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}>
            <Icon size={20} />
            <span className={styles.navLabel}>{l.label}</span>
          </NavLink>
        );
      })}

      <div className={styles.navSection}>Telephony</div>
      <NavLink to="/telephony/phone-numbers" className={`${styles.navItem} ${pathname.startsWith('/telephony') ? styles.navItemActive : ''}`}>
        <IconPhone size={20} />
        <span className={styles.navLabel}>Telephony</span>
      </NavLink>

      <div className={styles.navFooter}>
        <NavLink to="/settings" className={`${styles.navItem} ${pathname.startsWith('/settings') ? styles.navItemActive : ''}`}>
          <IconSettings size={20} />
          <span className={styles.navLabel}>Settings</span>
        </NavLink>
        <div className={styles.navUser}>{user?.email || user?.username}</div>
        <button type="button" className={styles.navItem} onClick={() => { logout(); navigate('/'); }}>
          <IconLogout size={20} />
          <span className={styles.navLabel}>Sign out</span>
        </button>
      </div>
    </aside>
  );
}

