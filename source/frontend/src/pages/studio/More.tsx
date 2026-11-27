import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from '../../studio/studio.module.css';
import {
  IconBook, IconTool, IconSkills, IconAgent, IconPhone, IconSettings, IconLogout, IconChevron,
} from '../../studio/icons';

const GROUPS = [
  {
    label: 'Agent capabilities · shared by all your agents',
    items: [
      { to: '/integrations/rag', title: 'Knowledge bases', desc: 'Bedrock Knowledge Base for answers (RAG)', icon: IconBook },
      { to: '/integrations/tools', title: 'Tools', desc: 'Webhook · Lambda · MCP (AgentCore Gateway)', icon: IconTool },
      { to: '/integrations/skills', title: 'Skills', desc: 'SKILL.md files from GitHub or S3', icon: IconSkills },
      { to: '/integrations/sub-agents', title: 'Sub-agents', desc: 'AgentCore runtimes your agent can delegate to', icon: IconAgent },
    ],
  },
  {
    label: 'Telephony',
    items: [
      { to: '/telephony/phone-numbers', title: 'Phone numbers & providers', desc: 'Map numbers to agents · Twilio and SIP setup', icon: IconPhone },
    ],
  },
];

function More() {
  const { user, logout } = useAuth();
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>More</h1>
      {GROUPS.map((g) => (
        <section key={g.label}>
          <div className={styles.groupLabel}>{g.label}</div>
          <div className={styles.listGroup}>
            {g.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.to} to={item.to} className={styles.listRow}>
                  <span className={styles.listIcon}><Icon size={20} /></span>
                  <span className={styles.listText}>
                    <span className={styles.listTitle}>{item.title}</span>
                    <span className={styles.listDesc}>{item.desc}</span>
                  </span>
                  <IconChevron size={18} className={styles.listChevron} />
                </Link>
              );
            })}
          </div>
        </section>
      ))}
      <div className={styles.groupLabel}>Workspace</div>
      <div className={styles.listGroup}>
        <Link to="/settings" className={styles.listRow}>
          <span className={styles.listIcon}><IconSettings size={20} /></span>
          <span className={styles.listText}>
            <span className={styles.listTitle}>Settings</span>
            <span className={styles.listDesc}>Display preferences</span>
          </span>
          <IconChevron size={18} className={styles.listChevron} />
        </Link>
        <button type="button" className={styles.listRow} onClick={() => logout()}>
          <span className={styles.listIcon}><IconLogout size={20} /></span>
          <span className={styles.listText}>
            <span className={styles.listTitle}>Sign out</span>
            <span className={styles.listDesc}>{user?.email || user?.username}</span>
          </span>
          <IconChevron size={18} className={styles.listChevron} />
        </button>
      </div>
      <p className={styles.hint} style={{ color: 'var(--text-muted)', marginTop: 16 }}>Eval suites now live in the Evals tab.</p>
    </div>
  );
}

export default More;
