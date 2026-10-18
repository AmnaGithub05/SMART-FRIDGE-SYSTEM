import { useCallback, useEffect, useRef, useState } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchFridgeSnapshot, MOBILE_API_CONFIG, registerPushToken } from './src/fridgeApi';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const colors = {
  ink: '#182c2d',
  muted: '#70807e',
  green: '#166b4d',
  mint: '#dff2e8',
  cyan: '#28c7bd',
  amber: '#df8d3e',
  red: '#ce5c56',
  background: '#edf3f1',
  white: '#ffffff',
  line: '#dce7e3',
};

function StatusPill({ status }) {
  const warning = status === 'Spoiling';
  return (
    <View style={[styles.statusPill, { backgroundColor: warning ? '#fff0dc' : colors.mint }]}>
      <Text style={[styles.statusPillText, { color: warning ? '#a4652c' : colors.green }]}>
        {warning ? '!' : '✓'} {status}
      </Text>
    </View>
  );
}

function Panel({ children, style }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

function MetricCard({ label, value, unit, detail }) {
  return (
    <Panel style={styles.metricCard}>
      <Text style={styles.eyebrow}>{label}</Text>
      <View style={styles.metricRow}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricUnit}>{unit}</Text></View>
      <Text style={styles.mutedText}>{detail}</Text>
    </Panel>
  );
}

export default function App() {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const notifiedKeys = useRef(new Set());

  useEffect(() => {
    let active = true;
    const register = async () => {
      if (!Device.isDevice) return;
      const permissions = await Notifications.getPermissionsAsync();
      let status = permissions.status;
      if (status !== 'granted') {
        status = (await Notifications.requestPermissionsAsync()).status;
      }
      if (status !== 'granted' || !active) return;
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      try {
        await registerPushToken(token);
      } catch (registrationError) {
        if (active) setError(registrationError.message);
      }
    };
    register();
    return () => { active = false; };
  }, []);

  const load = useCallback(async () => {
    try {
      const next = await fetchFridgeSnapshot();
      setSnapshot(next);
      setError('');
      const alerts = [
        ...next.inventory
          .filter((item) => item.state === 'low')
          .map((item) => ({ key: `low:${item.name}`, title: `Restock ${item.name}`, body: `${item.quantity} left · ${item.location}` })),
        ...next.inventory
          .filter((item) => item.state === 'expiring')
          .map((item) => ({ key: `expiring:${item.name}`, title: `Consume ${item.name} soon`, body: `Freshness is declining · ${item.location}` })),
      ];
      for (const alert of alerts) {
        if (notifiedKeys.current.has(alert.key)) continue;
        notifiedKeys.current.add(alert.key);
        await Notifications.scheduleNotificationAsync({
          content: { title: alert.title, body: alert.body, sound: 'default' },
          trigger: null,
        });
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, MOBILE_API_CONFIG.refreshIntervalMs);
    return () => clearInterval(interval);
  }, [load]);

  if (!snapshot) {
    return <View style={styles.loading}><ActivityIndicator color={colors.green} size="large" /><Text style={styles.mutedText}>Waking up AmSung Fridge...</Text></View>;
  }

  const { status, vision, sensor, decision, inventory, notifications } = snapshot;
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.green} />}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}><View style={styles.brandMark}><Text style={styles.brandMarkText}>A</Text></View><View><Text style={styles.brand}>AmSung</Text><Text style={styles.brandSub}>FRIDGE / EDGE AI</Text></View></View>
          <View style={styles.connection}><View style={styles.connectionDot} /><Text style={styles.mutedText}>{MOBILE_API_CONFIG.useMockData ? 'Demo data' : 'Jetson connected'}</Text></View>
        </View>

        <Text style={styles.eyebrow}>KITCHEN INTELLIGENCE</Text>
        <Text style={styles.title}>Good morning, Amna.</Text>
        <Text style={styles.subtitle}>Your fridge is keeping an eye on what matters.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Panel style={styles.hero}>
          <Text style={styles.eyebrow}>ITEM TO CONSUME NEXT</Text>
          <Text style={styles.foodEmoji}>🍓</Text>
          <Text style={styles.foodName}>{vision.item}</Text>
          <Text style={styles.mutedText}>Identified in the upper shelf</Text>
          <View style={styles.heroFooter}><StatusPill status={status.freshness} /><Text style={styles.confidence}>{status.confidence}% confidence</Text></View>
        </Panel>

        <View style={styles.twoColumn}><MetricCard label="AMBIENT CHEMISTRY" value={sensor.value} unit={sensor.unit} detail={`↗ ${sensor.trend}`} /><MetricCard label="FINAL AI DECISION" value={decision.confidence} unit="%" detail={decision.explanation} /></View>

        <Text style={styles.sectionTitle}>Fridge inventory</Text>
        <Text style={styles.mutedText}>{inventory.length} tracked items</Text>
        <Panel>
          {inventory.map((item, index) => (
            <View key={item.name} style={[styles.inventoryItem, index === inventory.length - 1 && styles.lastItem]}>
              <Text style={styles.inventoryIcon}>{item.icon}</Text>
              <View style={styles.inventoryCopy}><Text style={styles.itemName}>{item.name}</Text><Text style={styles.mutedText}>{item.quantity} · {item.location}</Text></View>
              <Text style={[styles.itemState, item.state === 'low' || item.state === 'expiring' ? styles.warningText : null]}>{item.state === 'expiring' ? 'Consume soon' : item.state === 'low' ? 'Running low' : 'In stock'}</Text>
            </View>
          ))}
        </Panel>

        <Text style={styles.sectionTitle}>Restock alerts</Text>
        <Panel>
          {notifications.map((notification, index) => (
            <View key={`${notification.title}-${notification.age}`} style={[styles.notification, index === notifications.length - 1 && styles.lastItem]}>
              <Text style={styles.alertIcon}>{notification.icon}</Text>
              <View style={styles.notificationCopy}><Text style={styles.itemName}>{notification.title}</Text><Text style={styles.mutedText}>{notification.detail}</Text></View>
              <Text style={styles.age}>{notification.age}</Text>
            </View>
          ))}
        </Panel>

        <Text style={styles.footer}>Updates every {MOBILE_API_CONFIG.refreshIntervalMs / 1000}s · Push alerts enabled</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 36 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 34 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  brandMarkText: { color: colors.white, fontSize: 22, fontWeight: '800' },
  brand: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  brandSub: { color: colors.muted, fontSize: 9, letterSpacing: 1.2 },
  connection: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  connectionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#35ad79' },
  eyebrow: { color: '#879591', fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '800', letterSpacing: -1.3, marginTop: 8 },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 5, marginBottom: 24 },
  panel: { backgroundColor: 'rgba(255,255,255,.86)', borderColor: colors.line, borderRadius: 18, borderWidth: 1, padding: 18, marginTop: 14 },
  hero: { backgroundColor: '#fff2df', minHeight: 230 },
  foodEmoji: { fontSize: 62, marginVertical: 16 },
  foodName: { color: colors.ink, fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  heroFooter: { alignItems: 'center', borderTopColor: '#f0d7b1', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 22, paddingTop: 14 },
  statusPill: { borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7 },
  statusPillText: { fontSize: 12, fontWeight: '800' },
  confidence: { color: colors.muted, fontSize: 12 },
  twoColumn: { flexDirection: 'row', gap: 12 },
  metricCard: { flex: 1, minHeight: 142 },
  metricRow: { alignItems: 'baseline', flexDirection: 'row', marginVertical: 14 },
  metricValue: { color: colors.ink, fontSize: 32, fontWeight: '800' },
  metricUnit: { color: colors.muted, fontSize: 12, marginLeft: 5 },
  mutedText: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  sectionTitle: { color: colors.ink, fontSize: 22, fontWeight: '800', marginTop: 28, marginBottom: 3 },
  inventoryItem: { alignItems: 'center', borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row', gap: 11, minHeight: 67 },
  lastItem: { borderBottomWidth: 0 },
  inventoryIcon: { fontSize: 22, width: 34 },
  inventoryCopy: { flex: 1 },
  itemName: { color: colors.ink, fontSize: 12, fontWeight: '800', marginBottom: 3 },
  itemState: { color: colors.green, fontSize: 10, fontWeight: '700' },
  warningText: { color: '#a4652c' },
  notification: { alignItems: 'flex-start', borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row', gap: 10, paddingVertical: 12 },
  alertIcon: { color: colors.amber, fontSize: 16, width: 20 },
  notificationCopy: { flex: 1 },
  age: { color: colors.muted, fontSize: 9 },
  error: { backgroundColor: '#fff0ef', borderRadius: 10, color: '#a3423c', fontSize: 12, marginBottom: 4, padding: 12 },
  footer: { color: colors.muted, fontSize: 10, marginTop: 24, textAlign: 'center' },
});
