import { useCallback, useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { TransactionProvider, useTransactions } from '../context/TransactionContext';
import { PermissionsAndroid, Platform, Alert, AppState, NativeModules, Linking } from 'react-native';

const { SmsTransactionModule } = NativeModules;

function PermissionAndTransactionHandler() {
  const router = useRouter();
  const { setPendingTransaction } = useTransactions();
  const appState = useRef(AppState.currentState);
  const isMounted = useRef(true);

  // ─── Permissions ────────────────────────────────────────────────────────────
  useEffect(() => {
    const requestAllPermissions = async () => {
      if (Platform.OS !== 'android') return;
      try {
        const smsRead = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_SMS,
          {
            title: 'SMS Permission Required',
            message: 'Spendly needs to read your SMS messages to automatically detect bank transactions.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Deny',
            buttonPositive: 'Allow',
          }
        );

        const smsReceive = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
          {
            title: 'Receive SMS Permission',
            message: 'Spendly needs to receive SMS notifications to auto-detect new transactions.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Deny',
            buttonPositive: 'Allow',
          }
        );

        // Notification permission (Android 13+)
        if (Number(Platform.Version) >= 33) {
          await PermissionsAndroid.request(
            'android.permission.POST_NOTIFICATIONS' as any,
            {
              title: 'Notification Permission',
              message: 'Spendly needs notification permission to alert you about new transactions.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Deny',
              buttonPositive: 'Allow',
            }
          );
        }

        const smsAllowed =
          smsRead === PermissionsAndroid.RESULTS.GRANTED &&
          smsReceive === PermissionsAndroid.RESULTS.GRANTED;

        if (!smsAllowed) {
          Alert.alert(
            'Permissions Required',
            'Spendly needs SMS permissions. Please grant access in Settings > Apps > Spendly > Permissions.',
            [{ text: 'OK' }]
          );
        }

        // Start the background SMS monitor service (foreground service)
        if (SmsTransactionModule && smsAllowed) {
          try {
            await SmsTransactionModule.startForegroundService();
            console.log('✅ SmsMonitorService started');
          } catch (e) {
            console.warn('Failed to start SmsMonitorService:', e);
          }
        }

        // Request battery optimization exemption
        try {
          await Linking.sendIntent(
            'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
            [{ key: 'package', value: 'package:com.banktracker.app' }]
          ).catch(() => { });
        } catch (e) {
          // Not supported on all devices
        }
      } catch (err) {
        console.warn('Permission request error:', err);
      }
    };

    requestAllPermissions();
    return () => { isMounted.current = false; };
  }, []);

  // ─── Pending Transaction Check ───────────────────────────────────────────────
  // This handles two cases:
  //   1. Notification tap (cold start): intent extras from MainActivity
  //   2. App opened manually after SMS: SharedPreferences from SmsBroadcastReceiver
  const checkPendingTransaction = useCallback(async () => {
    if (Platform.OS !== 'android' || !SmsTransactionModule || !isMounted.current) return;
    try {
      const pending = await SmsTransactionModule.getPendingTransaction();
      if (pending && isMounted.current) {
        console.log('🔔 Pending transaction detected:', pending.merchant, '₹' + pending.amount);
        setPendingTransaction({
          amount: parseFloat(pending.amount) || 0,
          merchant: pending.merchant || 'Unknown',
          date: pending.date || String(Date.now()),
          message: pending.message || '',
          category: '',
          notes: '',
        });
        // Delay navigation slightly so the router stack is fully ready
        setTimeout(() => {
          if (isMounted.current) router.push('/annotation');
        }, 800);
      }
    } catch (e) {
      console.warn('Error checking pending transaction:', e);
    }
  }, [setPendingTransaction, router]);

  // Cold-start check: run immediately + retry a few times (native module may not be
  // fully initialized on the very first call after a cold start from notification tap)
  useEffect(() => {
    let attempts = 0;
    const MAX_ATTEMPTS = 6; // Check for up to 12s after startup
    const INTERVAL_MS = 2000;

    checkPendingTransaction(); // Immediate first check

    const pollInterval = setInterval(() => {
      attempts++;
      checkPendingTransaction();
      if (attempts >= MAX_ATTEMPTS) clearInterval(pollInterval);
    }, INTERVAL_MS);

    return () => clearInterval(pollInterval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Foreground transition check: user taps notification while app is backgrounded
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        checkPendingTransaction();
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, [checkPendingTransaction]);

  // ─── Native Pending Transaction Check (Instant SMS) ─────────────────────────
  useEffect(() => {
    const checkNativePending = async () => {
      if (Platform.OS !== 'android') return;
      try {
        const { SmsTransactionModule } = NativeModules;
        if (SmsTransactionModule) {
          const pending = await SmsTransactionModule.getPendingTransaction();
          if (pending) {
            console.log('✅ Native pending transaction found:', pending.merchant);
            setPendingTransaction({
              amount: parseFloat(pending.amount) || 0,
              merchant: pending.merchant || 'Unknown',
              date: pending.date || String(Date.now()),
              message: pending.message || '',
              category: '',
              notes: '',
            });
            setTimeout(() => router.push('/annotation'), 500);
          }
        }
      } catch (e) {
        console.warn('Native pending check failed:', e);
      }
    };

    // Check on startup
    checkNativePending();

    // Also check when app comes to foreground
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkNativePending();
    });
    return () => sub.remove();
  }, [setPendingTransaction, router]);

  return null;
}

export default function RootLayout() {
  return (
    <TransactionProvider>
      <PermissionAndTransactionHandler />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="annotation" options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="budget" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
      </Stack>
    </TransactionProvider>
  );
}