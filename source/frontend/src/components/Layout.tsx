import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import AutoSaveIndicator from './AutoSaveIndicator';
import styles from './Layout.module.css';

function Layout() {
  const { user, logout } = useAuth();
  const [archOpen, setArchOpen] = useState(false);
  const [archTab, setArchTab] = useState<'solution' | 'stack'>('solution');
  const [navOpen, setNavOpen] = useState(false);

  const closeNav = useCallback(() => setNavOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNavOpen(false);
        setArchOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const lock = navOpen || archOpen;
    const prev = document.body.style.overflow;
    document.body.style.overflow = lock ? 'hidden' : prev || '';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen, archOpen]);

  return (
    <div className={styles.layout}>
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <button
            type="button"
            className={styles.menuBtn}
            aria-label="Open menu"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>
          <Link to="/" className={styles.topBrand}>
            <img src="/favicon.svg" alt="Everwood Technologies" width="28" height="28" />
            <span className={styles.topBrandText}>
              Everwood Technologies
              <span className={styles.topBrandSub}>x AWS-Sample</span>
            </span>
          </Link>
          <button
            type="button"
            className={styles.iconBtn}
            title="Architecture Diagram"
            aria-label="Architecture diagram"
            onClick={() => setArchOpen(true)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
        </div>
      </header>

      <div className={styles.body}>
        {navOpen && <div className={styles.backdrop} onClick={closeNav} aria-hidden="true" />}
        <Sidebar
          user={user}
          logout={logout}
          onArchOpen={() => { setArchOpen(true); closeNav(); }}
          mobileOpen={navOpen}
          onMobileClose={closeNav}
        />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
      <AutoSaveIndicator />

      {archOpen && (
        <div className={styles.modal} onClick={() => setArchOpen(false)} role="dialog" aria-modal="true">
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.archTabs}>
                <button
                  type="button"
                  className={`${styles.archTab} ${archTab === 'solution' ? styles.archTabActive : ''}`}
                  onClick={() => setArchTab('solution')}
                >
                  Solution Architecture
                </button>
                <button
                  type="button"
                  className={`${styles.archTab} ${archTab === 'stack' ? styles.archTabActive : ''}`}
                  onClick={() => setArchTab('stack')}
                >
                  Voice Agent Stack
                </button>
              </div>
              <button type="button" className={styles.modalClose} aria-label="Close" onClick={() => setArchOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              {archTab === 'solution' ? (
                <img
                  src="/images/architecture.png"
                  alt="Solution Architecture Diagram"
                />
              ) : (
                <img
                  src="/images/voice-agent-stack.png"
                  alt="Voice Agent Stack Diagram"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Layout;
