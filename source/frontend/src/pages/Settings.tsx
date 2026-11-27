import { useFilter } from '../context/FilterContext';

function Settings() {
  const { showOnlyMine, setShowOnlyMine } = useFilter();

  return (
    <div style={{ width: '100%' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>Settings</h1>
      <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '28px' }}>
        Manage your workspace preferences.
      </p>

      {/* Display Preferences */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '16px' }}>Display Preferences</div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={showOnlyMine}
              onChange={(e) => setShowOnlyMine(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#6366f1' }}
            />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>Show only my items</div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Filter all lists (agents, tools, eval suites, etc.) to show only items you created.</div>
            </div>
          </label>
        </div>
      </div>

      <p style={{ fontSize: '14px', color: '#64748b' }}>
        Provider credentials and number mappings live on the <a href="/telephony/phone-numbers" style={{ color: '#4f46e5', fontWeight: 600 }}>Telephony</a> page.
      </p>
    </div>
  );
}

export default Settings;
