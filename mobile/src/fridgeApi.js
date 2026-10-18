export const MOBILE_API_CONFIG = {
  baseUrl: 'http://192.168.1.100:8000',
  useMockData: true,
  refreshIntervalMs: 8000,
};

const mockSnapshot = {
  status: { freshness: 'Spoiling', confidence: 91 },
  vision: { item: 'Strawberries', confidence: 93 },
  sensor: { value: 38, unit: 'ppm', trend: 'increasing' },
  decision: { confidence: 91, explanation: 'VOC levels are rising around the detected item' },
  inventory: [
    { name: 'Greek yogurt', quantity: '1 tub', state: 'low', location: 'Top shelf', icon: '◒' },
    { name: 'Strawberries', quantity: '1 punnet', state: 'expiring', location: 'Upper shelf', icon: '●' },
    { name: 'Baby spinach', quantity: '1 bag', state: 'good', location: 'Crisper drawer', icon: '✣' },
    { name: 'Eggs', quantity: '9 remaining', state: 'good', location: 'Door shelf', icon: '○' },
  ],
  notifications: [
    { title: 'Eat strawberries today', detail: 'VOC levels are rising. Consume soon.', age: 'Just now', icon: '!' },
    { title: 'Restock Greek yogurt', detail: 'Only 1 tub left', age: '12 min ago', icon: '+' },
  ],
};

const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

async function getJson(path) {
  const response = await fetch(`${MOBILE_API_CONFIG.baseUrl}${path}`);
  if (!response.ok) throw new Error(`Jetson request failed: ${response.status}`);
  return response.json();
}

export async function registerPushToken(token) {
  if (MOBILE_API_CONFIG.useMockData) return;
  const response = await fetch(`${MOBILE_API_CONFIG.baseUrl}/notifications/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, platform: 'expo' }),
  });
  if (!response.ok) throw new Error(`Push token registration failed: ${response.status}`);
}

export async function fetchFridgeSnapshot() {
  if (MOBILE_API_CONFIG.useMockData) {
    await wait(250);
    return {
      ...mockSnapshot,
      sensor: { ...mockSnapshot.sensor, value: mockSnapshot.sensor.value + Math.round(Math.sin(Date.now() / 60000) * 2) },
    };
  }

  const [status, vision, sensor, history, inventory, notifications] = await Promise.all([
    getJson('/status'),
    getJson('/vision'),
    getJson('/sensor'),
    getJson('/history'),
    getJson('/inventory'),
    getJson('/notifications'),
  ]);

  return { status, vision, sensor, decision: status.decision ?? status, history, inventory, notifications };
}
