import { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, StatusBar, Platform, NativeModules, AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { useTransactions } from '../../context/TransactionContext';
import { LinearGradient } from 'expo-linear-gradient';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase.config';
import SmsAndroid from 'react-native-get-sms-android';

const parseBankSMS = (message: string, date: string) => {
  const amountMatch = message.match(/Rs\.?\s*([\d,]+(?:\.\d{1,2})?)/i) ||
    message.match(/INR\s*([\d,]+(?:\.\d{1,2})?)/i) ||
    message.match(/(?:debited|deducted|spent|paid)\s*(?:Rs\.?|INR)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  const isDebit = /debit|debited|spent|paid|deducted|withdrawn|purchase/i.test(message);
  if (!isDebit) return null;
  if (amount <= 0 || amount > 10000000) return null;
  const merchantMatch = message.match(/at\s+([A-Za-z][A-Za-z\s.\-&']+?)(?:\.|,|\s+Avl|\s+on|\s+Ref)/i) ||
    message.match(/to\s+([A-Za-z][A-Za-z\s.\-&']+?)(?:\s+Ref|\s+on|\.|,)/i) ||
    message.match(/(?:at|to|for)\s+([A-Za-z0-9][A-Za-z0-9\s]+)/i);
  const merchant = merchantMatch ? merchantMatch[1].trim().substring(0, 30) : 'Unknown';
  return { amount, merchant, date, message, category: '', notes: '' };
};

const getCategoryColor = (merchant: string) => {
  const m = merchant.toLowerCase();
  if (m.includes('swiggy') || m.includes('zomato') || m.includes('cafe')) return '#FF6B6B';
  if (m.includes('amazon') || m.includes('flipkart')) return '#4ECDC4';
  if (m.includes('netflix') || m.includes('spotify')) return '#9B59B6';
  if (m.includes('petrol') || m.includes('fuel')) return '#F39C12';
  if (m.includes('bazaar') || m.includes('mart')) return '#2ECC71';
  return '#7C3AED';
};

const getCategoryEmoji = (merchant: string) => {
  const m = merchant.toLowerCase();
  if (m.includes('swiggy') || m.includes('zomato') || m.includes('cafe')) return '🍕';
  if (m.includes('amazon') || m.includes('flipkart')) return '🛒';
  if (m.includes('netflix') || m.includes('spotify')) return '🎬';
  if (m.includes('petrol') || m.includes('fuel')) return '⛽';
  if (m.includes('bazaar') || m.includes('mart')) return '🏪';
  return '💳';
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const generateMonthOptions = () => {
  const now = new Date();
  const options = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      month: d.getMonth(),
      year: d.getFullYear(),
      label: MONTHS[d.getMonth()],
      yearLabel: d.getFullYear().toString(),
      start: d.getTime(),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime(),
    });
  }
  return options;
};

export default function HomeScreen() {
  const router = useRouter();
  const { transactions, setTransactions, setPendingTransaction } = useTransactions();
  const [fetched, setFetched] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState = useRef(AppState.currentState);
  const knownSmsIdsRef = useRef<Set<string>>(new Set());
  const initialFetchDone = useRef(false);

  const monthOptions = generateMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].key);
  const currentMonthData = monthOptions.find(m => m.key === selectedMonth)!;

  const filteredTransactions = transactions.filter(t => {
    const tDate = parseInt(t.date);
    return !isNaN(tDate) && tDate >= currentMonthData.start && tDate <= currentMonthData.end;
  });
  const totalSpentMonth = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);

  // Build a unique ID for an SMS to track what we've seen
  const getSmsId = (date: string, amount: number, merchant: string) =>
    `${date}-${amount}-${merchant}`;

  // Core SMS fetch — returns parsed transactions
  const fetchAndParseSms = useCallback((): Promise<any[]> => {
    return new Promise((resolve) => {
      if (Platform.OS !== 'android' || !SmsAndroid || !SmsAndroid.list) {
        resolve([]);
        return;
      }

      SmsAndroid.list(
        JSON.stringify({ box: 'inbox', maxCount: 500 }),
        (_fail: string) => { resolve([]); },
        (_count: number, smsList: string) => {
          try {
            const messages = JSON.parse(smsList);
            const parsed: any[] = [];
            messages.forEach((sms: any) => {
              const body = sms.body || '';
              if (/debit|debited|spent|paid|deducted|withdrawn|purchase/i.test(body) &&
                /Rs\.?|INR|₹/i.test(body)) {
                const result = parseBankSMS(body, String(sms.date || Date.now()));
                if (result) parsed.push(result);
              }
            });
            parsed.sort((a, b) => parseInt(b.date) - parseInt(a.date));
            resolve(parsed);
          } catch (e) {
            resolve([]);
          }
        }
      );
    });
  }, []);

  // Fetch and detect new transactions — auto-pop annotation for new ones
  const fetchAndDetectNew = useCallback(async (silent: boolean = true) => {
    const parsed = await fetchAndParseSms();
    if (parsed.length === 0 && silent) return;

    // On first fetch, just record all known IDs
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      parsed.forEach(t => {
        knownSmsIdsRef.current.add(getSmsId(t.date, t.amount, t.merchant));
      });
      setTransactions([...parsed]);
      setFetched(true);
      return;
    }

    // Find truly new transactions
    const newTxns = parsed.filter(t => {
      const id = getSmsId(t.date, t.amount, t.merchant);
      return !knownSmsIdsRef.current.has(id);
    });

    // Update known IDs
    parsed.forEach(t => {
      knownSmsIdsRef.current.add(getSmsId(t.date, t.amount, t.merchant));
    });

    // Update transaction list
    if (parsed.length !== transactions.length) {
      setTransactions([...parsed]);
    }
    setFetched(true);

    // Auto-pop annotation for the NEWEST transaction
    if (newTxns.length > 0) {
      const newest = newTxns[0]; // Most recent new transaction
      console.log('🔔 New transaction detected:', newest.merchant, '₹' + newest.amount);

      // Set as pending transaction and navigate to annotation
      setPendingTransaction({
        amount: newest.amount,
        merchant: newest.merchant,
        date: newest.date,
        message: newest.message || '',
        category: '',
        notes: '',
      });

      // Navigate to annotation screen
      router.push('/annotation');
    }
  }, [fetchAndParseSms, transactions.length, setTransactions, setPendingTransaction, router]);

  // Manual fetch button
  const manualFetch = useCallback(async () => {
    const parsed = await fetchAndParseSms();
    if (parsed.length === 0) {
      Alert.alert('No SMS', 'Could not read SMS. Make sure permissions are granted.');
      return;
    }
    parsed.forEach(t => {
      knownSmsIdsRef.current.add(getSmsId(t.date, t.amount, t.merchant));
    });
    setTransactions([...parsed]);
    setFetched(true);
    Alert.alert('✅ Done!', `Found ${parsed.length} transactions`);
  }, [fetchAndParseSms, setTransactions]);

  // Auto-fetch on mount (2s delay for permissions)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAndDetectNew(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Poll every 5 seconds for new SMS (faster detection)
  useEffect(() => {
    const startPolling = () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(() => {
        fetchAndDetectNew(true);
      }, 5000); // Every 5 seconds for fast detection
    };

    const stopPolling = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };

    startPolling();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        fetchAndDetectNew(true);
        startPolling();
      } else if (nextAppState.match(/inactive|background/)) {
        stopPolling();
      }
      appState.current = nextAppState;
    });

    return () => {
      stopPolling();
      subscription.remove();
    };
  }, [fetchAndDetectNew]);

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive', onPress: async () => {
          await signOut(auth);
          router.replace('/login');
        }
      }
    ]);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />

      <LinearGradient colors={['#1a0533', '#0A0A0F']} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Good day 👋</Text>
            <Text style={styles.headerTitle}>Spendly</Text>
          </View>
          <TouchableOpacity style={styles.dashboardIconBtn} onPress={() => router.push('/profile')}>
            <Text style={styles.dashboardIcon}>👤</Text>
          </TouchableOpacity>
        </View>

        <LinearGradient
          colors={['#7C3AED', '#4F46E5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>
            Spent in {MONTHS[currentMonthData.month]} {currentMonthData.year}
          </Text>
          <Text style={styles.balanceAmount}>₹{totalSpentMonth.toFixed(2)}</Text>
          <View style={styles.balanceFooter}>
            <Text style={styles.transactionCount}>📋 {filteredTransactions.length} transactions</Text>
            <Text style={styles.categorizedCount}>📊 {transactions.length} total</Text>
          </View>
        </LinearGradient>
      </LinearGradient>

      {/* Month Picker */}
      <View style={styles.monthPickerContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthPickerScroll}>
          {monthOptions.map((m) => {
            const isSelected = m.key === selectedMonth;
            return (
              <TouchableOpacity
                key={m.key}
                style={[styles.monthChip, isSelected && styles.monthChipSelected]}
                onPress={() => setSelectedMonth(m.key)}>
                <Text style={[styles.monthChipText, isSelected && styles.monthChipTextSelected]}>
                  {m.label}
                </Text>
                <Text style={[styles.monthChipYear, isSelected && styles.monthChipYearSelected]}>
                  {m.yearLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Auto-listen indicator */}
      <View style={styles.listenIndicator}>
        <View style={[styles.listenDot, styles.listenDotActive]} />
        <Text style={styles.listenText}>🟢 Scanning every 5s — new transactions pop up automatically</Text>
      </View>

      <View style={styles.buttonsRow}>
        <TouchableOpacity style={styles.fetchButton} onPress={manualFetch}>
          <LinearGradient colors={['#7C3AED', '#4F46E5']} style={styles.fetchButtonGradient}>
            <Text style={styles.fetchButtonText}>🔄 Refresh</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dashboardButton} onPress={() => router.push('/dashboard')}>
          <Text style={styles.dashboardButtonText}>📊 Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.budgetButton} onPress={() => router.push('/budget')}>
          <Text style={styles.budgetButtonText}>🎯 Budget</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>
        {MONTHS[currentMonthData.month]} {currentMonthData.year} Transactions
      </Text>

      {filteredTransactions.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No transactions for {MONTHS[currentMonthData.month]}</Text>
          <Text style={styles.emptySubText}>Try selecting a different month above</Text>
        </View>
      ) : (
        filteredTransactions.map((t, index) => {
          const globalIndex = transactions.indexOf(t);
          return (
            <TouchableOpacity
              key={index}
              style={styles.transactionCard}
              onPress={() => router.push({
                pathname: '/annotation',
                params: {
                  merchant: t.merchant,
                  amount: String(t.amount),
                  date: t.date,
                  index: String(globalIndex)
                }
              })}>
              <View style={[styles.categoryDot, { backgroundColor: getCategoryColor(t.merchant) + '30' }]}>
                <Text style={styles.categoryEmoji}>{getCategoryEmoji(t.merchant)}</Text>
              </View>
              <View style={styles.transactionLeft}>
                <Text style={styles.merchantName}>{t.merchant}</Text>
                <Text style={styles.transactionDate}>
                  {new Date(parseInt(t.date)).toLocaleDateString('en-IN')}
                </Text>
                {t.category === 'Split' && t.splits ? (
                  <View style={styles.splitBadge}>
                    <Text style={styles.splitBadgeText}>✂️ {t.splits.length} items split</Text>
                  </View>
                ) : t.category ? (
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>🏷️ {t.category}</Text>
                  </View>
                ) : (
                  <Text style={styles.tapToAnnotate}>Tap to categorize</Text>
                )}
                {t.splits && t.splits.length > 0 && (
                  <View style={styles.splitPreview}>
                    {t.splits.slice(0, 2).map((s, i) => (
                      <Text key={i} style={styles.splitPreviewItem}>₹{s.amount} — {s.description}</Text>
                    ))}
                    {t.splits.length > 2 && (
                      <Text style={styles.splitPreviewMore}>+{t.splits.length - 2} more...</Text>
                    )}
                  </View>
                )}
                {t.notes && !t.splits ? <Text style={styles.notesPreview}>📝 {t.notes}</Text> : null}
              </View>
              <View style={styles.amountContainer}>
                <Text style={styles.transactionAmount}>₹{t.amount.toFixed(0)}</Text>
                <Text style={styles.arrow}>›</Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: { paddingBottom: 25 },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 55,
    paddingBottom: 20,
  },
  greeting: { fontSize: 14, color: '#888', marginBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: 'white' },
  dashboardIconBtn: {
    backgroundColor: '#1a1a2e',
    width: 45,
    height: 45,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FF6B6B30',
  },
  dashboardIcon: { fontSize: 22 },
  balanceCard: {
    marginHorizontal: 20,
    padding: 25,
    borderRadius: 24,
    elevation: 10,
  },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  balanceAmount: { fontSize: 42, fontWeight: 'bold', color: 'white', marginTop: 5 },
  balanceFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  transactionCount: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  categorizedCount: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  monthPickerContainer: { marginTop: 15, marginBottom: 5 },
  monthPickerScroll: { paddingHorizontal: 16, gap: 8 },
  monthChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#ffffff10',
    alignItems: 'center',
    minWidth: 65,
  },
  monthChipSelected: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  monthChipText: { fontSize: 14, fontWeight: 'bold', color: '#888' },
  monthChipTextSelected: { color: 'white' },
  monthChipYear: { fontSize: 10, color: '#555', marginTop: 1 },
  monthChipYearSelected: { color: 'rgba(255,255,255,0.7)' },
  listenIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: '#1a1a2e',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffffff08',
  },
  listenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#555', marginRight: 8 },
  listenDotActive: { backgroundColor: '#2ECC71' },
  listenText: { flex: 1, fontSize: 12, color: '#888' },
  buttonsRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 12, gap: 12 },
  fetchButton: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  fetchButtonGradient: { padding: 15, alignItems: 'center' },
  fetchButtonText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
  dashboardButton: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 15,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7C3AED50',
  },
  dashboardButtonText: { color: '#7C3AED', fontSize: 15, fontWeight: 'bold' },
  budgetButton: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 15,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF6B6B50',
  },
  budgetButtonText: { color: '#FF6B6B', fontSize: 15, fontWeight: 'bold' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 20,
    marginTop: 25,
    marginBottom: 12,
    color: 'white',
  },
  emptyBox: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 20,
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7C3AED20',
  },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { color: '#888', fontSize: 16, fontWeight: 'bold' },
  emptySubText: { color: '#555', fontSize: 13, marginTop: 5, textAlign: 'center' },
  transactionCard: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 15,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffffff08',
  },
  categoryDot: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryEmoji: { fontSize: 22 },
  transactionLeft: { flex: 1 },
  merchantName: { fontSize: 15, fontWeight: 'bold', color: 'white' },
  transactionDate: { fontSize: 12, color: '#555', marginTop: 2 },
  categoryBadge: {
    backgroundColor: '#7C3AED20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  categoryBadgeText: { fontSize: 11, color: '#7C3AED' },
  splitBadge: {
    backgroundColor: '#4ECDC420',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  splitBadgeText: { fontSize: 11, color: '#4ECDC4', fontWeight: 'bold' },
  splitPreview: { marginTop: 4 },
  splitPreviewItem: { fontSize: 11, color: '#666', marginTop: 1 },
  splitPreviewMore: { fontSize: 10, color: '#555', fontStyle: 'italic', marginTop: 1 },
  tapToAnnotate: { fontSize: 11, color: '#444', marginTop: 3, fontStyle: 'italic' },
  notesPreview: { fontSize: 11, color: '#666', marginTop: 2, fontStyle: 'italic' },
  amountContainer: { alignItems: 'flex-end' },
  transactionAmount: { fontSize: 16, fontWeight: 'bold', color: '#FF6B6B' },
  arrow: { fontSize: 20, color: '#333', marginTop: 2 },
});