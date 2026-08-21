import React, { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_BASE || '/api';

const styles = {
  body: { fontFamily: 'system-ui, sans-serif', background: '#0b0f1a', color: '#e6ebf5', minHeight: '100vh', margin: 0, padding: 24 },
  header: { fontSize: 20, fontWeight: 700, marginBottom: 16 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 },
  card: { background: '#131a2b', border: '1px solid #243047', borderRadius: 14, padding: 16 },
  muted: { color: '#8b96ad', fontSize: 12 },
  big: { fontSize: 26, fontWeight: 600, margin: '8px 0' },
  pillUp: { background: 'rgba(61,220,132,.12)', color: '#3ddc84', borderRadius: 999, padding: '2px 8px', fontSize: 11 },
  pillDown: { background: 'rgba(255,93,93,.14)', color: '#ff5d5d', borderRadius: 999, padding: '2px 8px', fontSize: 11 },
};

function App() {
  const [status, setStatus] = useState({ clouds: [], active: null });
  const [cost, setCost] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const s = await (await fetch(`${API}/status`)).json();
        setStatus(s);
        const c = await (await fetch(`${API}/cost`)).json();
        setCost(c);
      } catch (e) {
        console.error('Cannot reach API — is the demo/API server running?', e);
      }
    };
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={styles.body}>
      <div style={styles.header}>⚔️ Aegis — Multi-Cloud Dashboard</div>
      <div style={styles.muted}>Active route: {status.active || 'none — all clouds down'}</div>

      <div style={{ ...styles.grid, marginTop: 16 }}>
        {(status.clouds || []).map((c) => (
          <div key={c.name} style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{c.label}</strong>
              {c.healthy ? <span style={styles.pillUp}>UP</span> : <span style={styles.pillDown}>DOWN</span>}
            </div>
            <div style={styles.big}>{c.latency == null ? '—' : `${c.latency} ms`}</div>
            <div style={styles.muted}>{c.name}</div>
            <div style={styles.muted}>uptime {c.uptimePct}% · {c.checks} checks</div>
          </div>
        ))}
      </div>

      {cost && (
        <div style={{ ...styles.card, marginTop: 16 }}>
          <strong>💸 Cost intelligence</strong>
          <div style={styles.big}>saves ${cost.savedUsd}/mo</div>
          <div style={styles.muted}>
            {cost.monthlyRequests.toLocaleString()} req/mo: ${cost.singleCloudCostUsd} on one paid cloud vs ${cost.aegisCostUsd} on Aegis free tiers.
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
