import { useEffect, useMemo, useState } from 'react';
import { API_CONFIG } from './config';
import { fetchFridgeSnapshot } from './services/fridgeApi';

const statusMeta = {
  Fresh: { tone: 'fresh', icon: '✓', detail: 'Good to eat' },
  Spoiling: { tone: 'warning', icon: '!', detail: 'Use soon' },
  Spoiled: { tone: 'danger', icon: '×', detail: 'Do not eat' },
  Uncertain: { tone: 'neutral', icon: '?', detail: 'Needs a closer look' },
};

function formatUpdatedAt(value) {
  return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function StatusBadge({ status }) {
  const meta = statusMeta[status] ?? statusMeta.Uncertain;
  return <span className={`status-badge ${meta.tone}`}><span>{meta.icon}</span>{status}</span>;
}

function ConfidenceBar({ value, tone = 'green' }) {
  return <div className="confidence-track"><span className={`confidence-fill ${tone}`} style={{ width: `${value}%` }} /></div>;
}

function VerificationCard({ type, title, status, confidence, detail, icon }) {
  return (
    <article className="verification-card">
      <div className="card-heading">
        <div className={`verification-icon ${type}`}>{icon}</div>
        <div><span className="eyebrow">{type === 'visual' ? '01 / Camera' : '02 / Arduino UNO R4'}</span><h3>{title}</h3></div>
        <span className="signal-dot" />
      </div>
      <div className="verification-result"><StatusBadge status={status} /><strong>{confidence}%</strong></div>
      <ConfidenceBar value={confidence} tone={type === 'visual' ? 'green' : 'cyan'} />
      <p>{detail}</p>
    </article>
  );
}

function InventoryCard({ item }) {
  const stateLabel = item.state === 'expiring' ? 'Consume soon' : item.state === 'low' ? 'Running low' : 'In stock';
  return (
    <div className="inventory-item">
      <div className={`inventory-icon ${item.state === 'expiring' ? 'recent' : item.state}`}>{item.icon}</div>
      <div className="inventory-item-copy"><strong>{item.name}</strong><span>{item.quantity} · {item.location}</span></div>
      <span className={`inventory-state ${item.state === 'expiring' ? 'recent' : item.state}`}>{stateLabel}</span>
    </div>
  );
}

function NotificationsPanel({ notifications }) {
  return (
    <article className="notifications-panel panel">
      <div className="section-heading"><div><span className="eyebrow">Smart reminders</span><h2>Restock alerts</h2></div><span className="notification-count">{notifications.length} new</span></div>
      <div className="notification-list">
        {notifications.map((notification) => (
          <div className={`notification-item ${notification.priority}`} key={`${notification.title}-${notification.age}`}>
            <div className="notification-icon">{notification.icon}</div>
            <div><strong>{notification.title}</strong><p>{notification.detail}</p></div>
            <span className="notification-age">{notification.age}</span>
          </div>
        ))}
      </div>
      <button className="notification-button" type="button">Manage grocery list <span>→</span></button>
    </article>
  );
}

function InventoryPanel({ inventory, notifications }) {
  return (
    <section className="inventory-section">
      <div className="section-heading section-heading-wide"><div><span className="eyebrow">Shelf awareness</span><h2>Fridge inventory</h2></div><span className="inventory-summary">{inventory.length} tracked items</span></div>
      <div className="inventory-layout"><article className="inventory-panel panel"><div className="inventory-list">{inventory.map((item) => <InventoryCard item={item} key={item.name} />)}</div><div className="inventory-footer"><span><span className="live-pulse" /> Camera updates automatically</span><span>Last scan: 12 min ago</span></div></article><NotificationsPanel notifications={notifications} /></div>
    </section>
  );
}

function HistoryChart({ history }) {
  const points = useMemo(() => {
    const width = 680;
    const height = 190;
    const max = Math.max(...history.map((point) => point.voc), 30);
    return history.map((point, index) => {
      const x = history.length === 1 ? width / 2 : (index / (history.length - 1)) * width;
      const y = height - (point.voc / max) * 140 - 10;
      return { ...point, x, y };
    });
  }, [history]);
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `0,190 ${line} 680,190`;

  return (
    <article className="history-panel panel">
      <div className="section-heading">
        <div><span className="eyebrow">Signal timeline</span><h2>Freshness history</h2></div>
        <div className="chart-legend"><span><i className="legend-line" /> VOC level</span><span><i className="legend-dot" /> Freshness</span></div>
      </div>
      <div className="chart-wrap">
        <div className="chart-y-labels"><span>30</span><span>20</span><span>10</span><span>0</span></div>
        <svg className="history-chart" viewBox="0 0 680 190" role="img" aria-label="VOC level history chart">
          <defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#28c7bd" stopOpacity=".24" /><stop offset="100%" stopColor="#28c7bd" stopOpacity="0" /></linearGradient></defs>
          {[35, 82, 129, 176].map((y) => <line key={y} x1="0" x2="680" y1={y} y2={y} className="chart-grid" />)}
          <polygon points={area} fill="url(#areaFill)" />
          <polyline points={line} className="chart-line" />
          {points.map((point) => <circle key={point.time} cx={point.x} cy={point.y} r="4.5" className="chart-point" />)}
        </svg>
      </div>
      <div className="chart-x-labels">{history.map((point) => <span key={point.time}>{point.time}</span>)}</div>
      <div className="history-footnote"><span className="live-pulse" /> Updating every {API_CONFIG.refreshIntervalMs / 1000}s <span className="history-note">Last 8 readings from Jetson</span></div>
    </article>
  );
}

export default function App() {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState('');
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const next = await fetchFridgeSnapshot();
        if (active) { setSnapshot(next); setLastSync(new Date()); setError(''); }
      } catch (requestError) {
        if (active) setError(requestError.message);
      }
    };
    load();
    const interval = window.setInterval(load, API_CONFIG.refreshIntervalMs);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  if (!snapshot) return <main className="loading-screen"><div className="loader-mark">A</div><p>Waking up AmSung Fridge...</p></main>;

  const { status, vision, sensor, decision, history, inventory, notifications } = snapshot;
  const uncertain = status.freshness === 'Uncertain';
  const meta = statusMeta[status.freshness] ?? statusMeta.Uncertain;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark">A</div><div><strong>AmSung</strong><span>FRIDGE / EDGE AI</span></div></div>
        <div className="connection"><span className="connection-dot" /><span>{API_CONFIG.useMockData ? 'Demo data' : 'Jetson connected'}</span><button className="icon-button" aria-label="Settings">•••</button></div>
      </header>
      <main className="dashboard">
        <div className="intro-row"><div><span className="eyebrow">Kitchen intelligence</span><h1>Good morning, Amna.</h1><p className="intro-copy">Your fridge is keeping an eye on what matters.</p></div><div className="sync-time"><span>Last updated</span><strong>{lastSync ? formatUpdatedAt(lastSync) : '—'}</strong></div></div>
        {error && <div className="error-banner">Connection issue: {error}</div>}
        {uncertain && <div className="warning-banner"><span className="warning-icon">!</span><div><strong>Signals disagree</strong><p>Visual AI and the VOC sensor are reporting different stories. Check this item before eating.</p></div><span className="warning-arrow">→</span></div>}
        {status.freshness === 'Spoiling' && <div className="warning-banner consume-banner"><span className="warning-icon">!</span><div><strong>Consume this first</strong><p>{vision.item} is starting to spoil. Move it to the front of the fridge and eat it today.</p></div><span className="warning-arrow">→</span></div>}
        <section className="hero-grid">
          <article className={`status-panel panel ${meta.tone}`}>
            <div className="status-top"><span className="eyebrow">Current item / Camera 01</span><span className="scan-label"><span className="live-pulse" /> Live scan</span></div>
            <div className="food-visual"><div className="food-orbit orbit-one" /><div className="food-orbit orbit-two" /><div className="food-icon">🍓</div></div>
            <div className="food-copy"><span className="eyebrow">Item to consume next</span><h2>{vision.item}</h2><p>Identified in the upper shelf</p></div>
            <div className="status-divider" />
            <div className="freshness-row"><div><span className="eyebrow">Freshness status</span><div className="freshness-value"><span className="status-symbol">{meta.icon}</span><strong>{status.freshness}</strong></div><span className="status-detail">{meta.detail}</span></div><div className="freshness-score"><strong>{status.confidence}</strong><span>% confidence</span></div></div>
          </article>
          <div className="right-rail">
            <article className="sensor-panel panel"><div className="section-heading"><div><span className="eyebrow">Ambient chemistry</span><h2>VOC reading</h2></div><span className="trend-chip">↗ {sensor.trend}</span></div><div className="sensor-reading"><strong>{sensor.value}</strong><span>{sensor.unit}</span></div><div className="sensor-meter"><span style={{ width: `${Math.min(sensor.value * 2.5, 100)}%` }} /></div><p>Volatile organic compounds detected around the item</p></article>
            <article className="decision-panel panel"><div className="section-heading"><div><span className="eyebrow">Transformer synthesis</span><h2>Final AI decision</h2></div><div className="ai-badge">AI</div></div><div className="decision-result"><StatusBadge status={decision.label} /><strong>{decision.confidence}%</strong></div><p>{decision.explanation}</p><div className="decision-footer"><span>Jetson Orin Nano</span><span>Transformer v1.2</span></div></article>
          </div>
        </section>
        <section className="verification-section"><div className="section-heading section-heading-wide"><div><span className="eyebrow">Two-factor freshness check</span><h2>Verification factors</h2></div><span className="verified-label">✓ Both signals received</span></div><div className="verification-grid"><VerificationCard type="visual" title="Visual AI" status={vision.freshness} confidence={vision.confidence} icon="◉" detail="Camera model recognises shape, colour, and surface texture." /><VerificationCard type="sensor" title="VOC Sensor" status={sensor.trend === 'stable' ? 'Fresh' : 'Spoiling'} confidence={sensor.trend === 'stable' ? 91 : 72} icon="⌁" detail={`VOC levels are ${sensor.trend}. Sensor connected via Arduino UNO R4 WiFi.`} /></div></section>
        <InventoryPanel inventory={inventory} notifications={notifications} />
        <HistoryChart history={history} />
      </main>
      <footer className="footer"><span>AmSung Fridge / Edge AI freshness monitor</span><span>Built for the kitchen of tomorrow</span></footer>
    </div>
  );
}
