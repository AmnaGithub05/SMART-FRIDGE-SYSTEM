import cors from 'cors';
import express from 'express';
import { Expo } from 'expo-server-sdk';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const port = Number(process.env.PORT || 8001);
const storePath = process.env.NOTIFICATION_STORE_PATH || path.join(process.cwd(), 'data', 'notification-tokens.json');
const apiKey = process.env.NOTIFICATION_API_KEY;
const expo = new Expo();
const app = express();

app.use(cors());
app.use(express.json({ limit: '32kb' }));

async function readTokens() {
  try {
    const contents = await readFile(storePath, 'utf8');
    const parsed = JSON.parse(contents);
    if (!Array.isArray(parsed)) throw new Error('Notification token store must contain an array');
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeTokens(tokens) {
  await mkdir(path.dirname(storePath), { recursive: true });
  const temporaryPath = `${storePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(tokens, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, storePath);
}

function requireApiKey(request, response, next) {
  if (!apiKey || request.get('x-api-key') === apiKey) return next();
  return response.status(401).json({ error: 'Missing or invalid API key' });
}

function requireExpoToken(token) {
  if (typeof token !== 'string' || !Expo.isExpoPushToken(token)) {
    throw new Error('token must be a valid Expo push token');
  }
}

function buildAlerts(inventory = []) {
  return inventory.flatMap((item) => {
    if (!item || typeof item.name !== 'string') return [];
    if (item.state === 'low') {
      return [{ key: `low:${item.name}`, title: `Restock ${item.name}`, body: `${item.quantity || 'Limited quantity'} left · ${item.location || 'Fridge'}` }];
    }
    if (item.state === 'expiring') {
      return [{ key: `expiring:${item.name}`, title: `Consume ${item.name} soon`, body: `Freshness is declining · ${item.location || 'Fridge'}` }];
    }
    return [];
  });
}

async function sendAlerts(alerts) {
  const tokens = await readTokens();
  const messages = [];
  for (const tokenRecord of tokens) {
    for (const alert of alerts) {
      messages.push({
        to: tokenRecord.token,
        title: alert.title,
        body: alert.body,
        sound: 'default',
        data: { alertKey: alert.key },
      });
    }
  }

  const tickets = [];
  for (const chunk of expo.chunkPushNotifications(messages)) {
    tickets.push(...await expo.sendPushNotificationsAsync(chunk));
  }
  return { recipients: tokens.length, messages: messages.length, tickets };
}

app.get('/health', (_request, response) => {
  response.json({ ok: true, service: 'smart-fridge-notifications' });
});

app.post('/notifications/register', async (request, response, next) => {
  try {
    const { token, platform = 'expo' } = request.body;
    requireExpoToken(token);
    const tokens = await readTokens();
    const nextTokens = tokens.filter((record) => record.token !== token);
    nextTokens.push({ token, platform, registeredAt: new Date().toISOString() });
    await writeTokens(nextTokens);
    response.status(201).json({ registered: true });
  } catch (error) {
    next(error);
  }
});

app.post('/notifications/evaluate', requireApiKey, async (request, response, next) => {
  try {
    const alerts = buildAlerts(request.body.inventory);
    const result = await sendAlerts(alerts);
    response.json({ alerts, ...result });
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  const status = error.message.startsWith('token must be') ? 400 : 500;
  response.status(status).json({ error: error.message });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Notification service listening on port ${port}`);
});
