import { API_CONFIG } from '../config';

const mockHistory = [
  { time: '08:00', voc: 18, freshness: 92 },
  { time: '09:00', voc: 21, freshness: 90 },
  { time: '10:00', voc: 24, freshness: 87 },
  { time: '11:00', voc: 27, freshness: 82 },
  { time: '12:00', voc: 31, freshness: 76 },
  { time: '13:00', voc: 34, freshness: 71 },
  { time: '14:00', voc: 36, freshness: 67 },
  { time: '15:00', voc: 38, freshness: 63 },
];

const mockSnapshot = {
  status: { freshness: 'Spoiling', confidence: 91, updatedAt: new Date().toISOString() },
  vision: { item: 'Strawberries', confidence: 93, freshness: 'Spoiling' },
  sensor: { value: 38, unit: 'ppm', trend: 'increasing' },
  decision: { label: 'Spoiling', confidence: 91, explanation: 'VOC levels are rising around the detected item' },
  history: mockHistory,
  inventory: [
    { name: 'Greek yogurt', quantity: '1 tub', state: 'low', location: 'Top shelf', icon: '◒' },
    { name: 'Strawberries', quantity: '1 punnet', state: 'expiring', location: 'Upper shelf', icon: '●' },
    { name: 'Baby spinach', quantity: '1 bag', state: 'good', location: 'Crisper drawer', icon: '✣' },
    { name: 'Eggs', quantity: '9 remaining', state: 'good', location: 'Door shelf', icon: '○' },
  ],
  notifications: [
    { title: 'Eat strawberries today', detail: 'VOC levels are rising. Consume soon.', age: 'Just now', priority: 'high', icon: '!' },
    { title: 'Restock Greek yogurt', detail: 'Only 1 tub left', age: '12 min ago', priority: 'info', icon: '+' },
  ],
};

const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

async function getJson(path) {
  const response = await fetch(`${API_CONFIG.baseUrl}${path}`);
  if (!response.ok) throw new Error(`Jetson request failed: ${response.status}`);
  return response.json();
}

function getMockSnapshot() {
  const variation = Math.round(Math.sin(Date.now() / 60000) * 2);
  return {
    ...mockSnapshot,
    status: { ...mockSnapshot.status, updatedAt: new Date().toISOString() },
    sensor: { ...mockSnapshot.sensor, value: mockSnapshot.sensor.value + variation },
    history: mockHistory,
    inventory: mockSnapshot.inventory,
    notifications: mockSnapshot.notifications,
  };
}

export async function fetchFridgeSnapshot() {
  if (API_CONFIG.useMockData) {
    await wait(250);
    return getMockSnapshot();
  }

  const [status, vision, sensor, history, inventory, notifications] = await Promise.all([
    getJson('/status'),
    getJson('/vision'),
    getJson('/sensor'),
    getJson('/history'),
    getJson('/inventory'),
    getJson('/notifications'),
  ]);

  return {
    status,
    vision,
    sensor,
    decision: status.decision ?? status,
    history,
    inventory,
    notifications,
  };
}
