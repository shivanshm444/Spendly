import { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, StatusBar, Platform, AppState, Modal, TextInput, KeyboardAvoidingView } from 'react-native';
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
  const refMatch = message.match(/[Rr]ef\.?\s*(?:[Nn]o\.?)?\s*([A-Za-z0-9]+)/);
  const ref = refMatch ? `Txn #${refMatch[1]}` : '';
  const merchant = merchantMatch ? merchantMatch[1].trim().substring(0, 30) : ref || 'Bank Transaction';
  return { amount, merchant, date, message, category: '', notes: '' };
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'Food': return '#FF6B6B';
    case 'Shopping': return '#4ECDC4';
    case 'Entertainment': return '#9B59B6';
    case 'Fuel': return '#F39C12';
    case 'Groceries': return '#2ECC71';
    case 'Travel': return '#45B7D1';
    case 'Health': return '#E74C3C';
    case 'Rent': return '#3498DB';
    case 'Education': return '#1ABC9C';
    default: return '#7C3AED';
  }
};

const getCategoryEmoji = (category: string) => {
  switch (category) {
    case 'Food': return '🍕';
    case 'Shopping': return '🛒';
    case 'Entertainment': return '🎬';
    case 'Fuel': return '⛽';
    case 'Groceries': return '🏪';
    case 'Travel': return '✈️';
    case 'Health': return '💊';
    case 'Rent': return '🏠';
    case 'Education': return '📚';
    default: return '💳';
  }
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

const getSmsId = (date: string, amount: number, merchant: string) =>
  `${date}-${amount}-${merchant}`;

const mergeSmsWithExisting = (parsed: any[], existing: any[]): any[] => {
  const combined = [...existing];
  const existingIds = new Set(existing.map(t => getSmsId(t.date, t.amount, t.merchant)));
  parsed.forEach(t => {
    const id = getSmsId(t.date, t.amount, t.merchant);
    if (!existingIds.has(id)) {
      combined.push(t);
    }
  });
  return combined.sort((a, b) => parseInt(b.date) - parseInt(a.date));
};

export default function HomeScreen() {
  const router = useRouter();
  const { transactions, setTransactions, setPendingTransaction, addTransaction, isLoaded } = useTransactions();
  const [fetched, setFetched] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState = useRef(AppState.currentState);
  const knownSmsIdsRef = useRef<Set<string>>(new Set());
  const initialFetchDone = useRef(false);
  const transactionsRef = useRef(transactions);
  const isLoadedRef = useRef(isLoaded);

  // Manual entry state
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualMerchant, setManualMerchant] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualPayMode, setManualPayMode] = useState('Cash');

  useEffect(() => { transactionsRef.current = transactions; }, [transactions]);
  useEffect(() => { isLoadedRef.current = isLoaded; }, [isLoaded]);

  // Seed known IDs from Firebase loaded transactions
  useEffect(() => {
    if (isLoaded && transactions.length > 0 && knownSmsIdsRef.current.size === 0) {
      transactions.forEach(t => {
        knownSmsIdsRef.current.add(getSmsId(t.date, t.amount, t.merchant));
      });
    }
  }, [isLoaded, transactions.length]);

  const monthOptions = generateMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].key);
  const currentMonthData = monthOptions.find(m => m.key === selectedMonth)!;

  const filteredTransactions = transactions.filter(t => {
    const tDate = parseInt(t.date);
    return !isNaN(tDate) && tDate >= currentMonthData.start && tDate <= currentMonthData.end;
  });
  const totalSpentMonth = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);

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

  const fetchAndDetectNew = useCallback(async (silent: boolean = true) => {
    if (!isLoadedRef.current) return;

    const parsed = await fetchAndParseSms();
    if (parsed.length === 0 && silent) return;

    const currentTransactions = transactionsRef.current;

    // First fetch — seed known IDs, merge without triggering annotation
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      parsed.forEach(t => {
        knownSmsIdsRef.current.add(getSmsId(t.date, t.amount, t.merchant));
      });
      const merged = mergeSmsWithExisting(parsed, currentTransactions);
      if (merged.length > currentTransactions.length) {
        setTransactions([...merged]);
      }
      setFetched(true);
      return;
    }

    // Find truly new transactions
    const newTxns = parsed.filter(t => !knownSmsIdsRef.current.has(getSmsId(t.date, t.amount, t.merchant)));

    // Add to known IDs
    parsed.forEach(t => knownSmsIdsRef.current.add(getSmsId(t.date, t.amount, t.merchant)));

    // Only update if genuinely new
    if (newTxns.length > 0) {
      const merged = mergeSmsWithExisting(newTxns, currentTransactions);
      setTransactions([...merged]);
      setFetched(true);

      const newest = newTxns[0];
      setPendingTransaction({
        amount: newest.amount,
        merchant: newest.merchant,
        date: newest.date,
        message: newest.message || '',
        category: '',
        notes: '',
      });
      router.push('/annotation');
    }
  }, [fetchAndParseSms, setTransactions, setPendingTransaction, router]);

  const manualFetch = useCallback(async () => {
    const parsed = await fetchAndParseSms();
    if (parsed.length === 0) {
      Alert.alert('No SMS', 'Could not read SMS. Make sure permissions are granted.');
      return;
    }
    parsed.forEach(t => knownSmsIdsRef.current.add(getSmsId(t.date, t.amount, t.merchant)));
    const merged = mergeSmsWithExisting(parsed, transactionsRef.current);
    setTransactions([...merged]);
    setFetched(true);
    Alert.alert('✅ Done!', `Found ${parsed.length} transactions`);
  }, [fetchAndParseSms, setTransactions]);

  // Auto fetch after Firebase loads
  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(() => { fetchAndDetectNew(true); }, 2000);
    return () => clearTimeout(timer);
  }, [isLoaded]);

  // Poll every 5 seconds
  useEffect(() => {
    const startPolling = () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(() => { fetchAndDetectNew(true); }, 5000);
    };
    const stopPolling = () => {
      if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    };
    if (isLoaded) startPolling();
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        fetchAndDetectNew(true);
        if (isLoadedRef.current) startPolling();
      } else if (nextAppState.match(/inactive|background/)) {
        stopPolling();
      }
      appState.current = nextAppState;
    });
    return () => { stopPolling(); subscription.remove(); };
  }, [isLoaded, fetchAndDetectNew]);

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await signOut(auth); router.replace('/login'); } }
    ]);
  };

  const handleManualSave = () => {
    const amt = parseFloat(manualAmount);
    if (!manualMerchant.trim()) {
      Alert.alert('Please enter a description');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Please enter a valid amount');
      return;
    }
    const now = Date.now();
    const newTxn = {
      amount: amt,
      merchant: manualMerchant.trim(),
      date: String(now),
      message: `Manual ${manualPayMode} payment: ${manualMerchant.trim()} ₹${amt}`,
      category: '',
      notes: '',
    };
    addTransaction(newTxn);
    setShowManualEntry(false);
    setManualMerchant('');
    setManualAmount('');
    setManualPayMode('Cash');
    // Navigate to annotation for categorization
    setPendingTransaction(newTxn);
    router.push('/annotation');
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Good day 👋</Text>
            <Text style={styles.headerTitle}>Spendly</Text>
          </View>
          <TouchableOpacity style={styles.dashboardIconBtn} onPress={() => router.push('/profile')}>
            <Text style={styles.dashboardIcon}>👤</Text>
          </TouchableOpacity>
        </View>
        <LinearGradient colors={['#7C3AED', '#4F46E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Spent in {MONTHS[currentMonthData.month]} {currentMonthData.year}</Text>
          <Text style={styles.balanceAmount}>₹{totalSpentMonth.toFixed(2)}</Text>
          <View style={styles.balanceFooter}>
            <Text style={styles.transactionCount}>📋 {filteredTransactions.length} transactions</Text>
            <Text style={styles.categorizedCount}>📊 {transactions.length} total</Text>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.monthPickerContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthPickerScroll}>
          {monthOptions.map((m) => {
            const isSelected = m.key === selectedMonth;
            return (
              <TouchableOpacity key={m.key} style={[styles.monthChip, isSelected && styles.monthChipSelected]} onPress={() => setSelectedMonth(m.key)}>
                <Text style={[styles.monthChipText, isSelected && styles.monthChipTextSelected]}>{m.label}</Text>
                <Text style={[styles.monthChipYear, isSelected && styles.monthChipYearSelected]}>{m.yearLabel}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

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

      {/* Add Manual Transaction Button */}
      <TouchableOpacity style={styles.addManualBtn} onPress={() => setShowManualEntry(true)} activeOpacity={0.85}>
        <LinearGradient colors={['#10B981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.addManualGradient}>
          <Text style={styles.addManualIcon}>＋</Text>
          <Text style={styles.addManualText}>Add Cash / Manual Transaction</Text>
        </LinearGradient>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>{MONTHS[currentMonthData.month]} {currentMonthData.year} Transactions</Text>

      {filteredTransactions.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No transactions for {MONTHS[currentMonthData.month]}</Text>
          <Text style={styles.emptySubText}>Try selecting a different month above</Text>
        </View>
      ) : (
        filteredTransactions.map((t, index) => {
          const globalIndex = transactions.indexOf(t);
          const catColor = getCategoryColor(t.category);
          const catEmoji = getCategoryEmoji(t.category);
          return (
            <TouchableOpacity
              key={`${t.date}-${t.amount}-${index}`}
              style={styles.transactionCard}
              onPress={() => router.push({
                pathname: '/annotation',
                params: {
                  merchant: t.merchant,
                  amount: String(t.amount),
                  date: t.date,
                  index: String(globalIndex),
                  id: getSmsId(t.date, t.amount, t.merchant)
                }
              })}>
              <View style={[styles.categoryDot, { backgroundColor: catColor + '30' }]}>
                <Text style={styles.categoryEmoji}>{catEmoji}</Text>
              </View>
              <View style={styles.transactionLeft}>
                <Text style={styles.merchantName}>{t.merchant}</Text>
                <Text style={styles.transactionDate}>{new Date(parseInt(t.date)).toLocaleDateString('en-IN')}</Text>
                {t.category === 'Split' && t.splits ? (
                  <View style={styles.splitBadge}>
                    <Text style={styles.splitBadgeText}>✂️ {t.splits.length} items split</Text>
                  </View>
                ) : t.category ? (
                  <View style={[styles.categoryBadge, { backgroundColor: catColor + '20' }]}>
                    <Text style={[styles.categoryBadgeText, { color: catColor }]}>🏷️ {t.category}{t.subCategory ? ` › ${t.subCategory}` : ''}</Text>
                  </View>
                ) : (
                  <Text style={styles.tapToAnnotate}>Tap to categorize</Text>
                )}
                {t.splits && t.splits.length > 0 && (
                  <View style={styles.splitPreview}>
                    {t.splits.slice(0, 2).map((s, i) => (
                      <Text key={i} style={styles.splitPreviewItem}>₹{s.amount} — {s.description}</Text>
                    ))}
                    {t.splits.length > 2 && <Text style={styles.splitPreviewMore}>+{t.splits.length - 2} more...</Text>}
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

      {/* Manual Entry Modal */}
      <Modal visible={showManualEntry} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowManualEntry(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>💸 Add Cash Transaction</Text>
            <Text style={styles.modalSubtitle}>For payments made by cash, UPI, or any manual entry</Text>

            {/* Payment Mode */}
            <Text style={styles.modalLabel}>Payment Mode</Text>
            <View style={styles.payModeRow}>
              {['Cash', 'UPI', 'Card', 'Other'].map(mode => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.payModeChip, manualPayMode === mode && styles.payModeChipActive]}
                  onPress={() => setManualPayMode(mode)}>
                  <Text style={styles.payModeEmoji}>
                    {mode === 'Cash' ? '💵' : mode === 'UPI' ? '📱' : mode === 'Card' ? '💳' : '🔄'}
                  </Text>
                  <Text style={[styles.payModeText, manualPayMode === mode && styles.payModeTextActive]}>{mode}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Description */}
            <Text style={styles.modalLabel}>What did you pay for? *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Kurkure, Auto ride, Chai..."
              placeholderTextColor="#9CA3AF"
              value={manualMerchant}
              onChangeText={setManualMerchant}
              autoFocus
            />

            {/* Amount */}
            <Text style={styles.modalLabel}>Amount (₹) *</Text>
            <TextInput
              style={[styles.modalInput, styles.amountInput]}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              value={manualAmount}
              onChangeText={setManualAmount}
              keyboardType="numeric"
            />

            {/* Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowManualEntry(false); setManualMerchant(''); setManualAmount(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleManualSave} style={styles.modalSaveContainer}>
                <LinearGradient colors={['#7C3AED', '#4F46E5']} style={styles.modalSave}>
                  <Text style={styles.modalSaveText}>Save</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: '#FFFFFF', paddingBottom: 20, paddingHorizontal: 20, paddingTop: 55, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 20 },
  greeting: { fontSize: 14, color: '#9CA3AF', marginBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#7C3AED' },
  dashboardIconBtn: { backgroundColor: '#F5F3FF', width: 45, height: 45, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DDD6FE' },
  dashboardIcon: { fontSize: 22 },
  balanceCard: { marginHorizontal: 20, padding: 25, borderRadius: 24, elevation: 10 },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  balanceAmount: { fontSize: 42, fontWeight: 'bold', color: 'white', marginTop: 5 },
  balanceFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  transactionCount: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  categorizedCount: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  monthPickerContainer: { marginTop: 15, marginBottom: 5 },
  monthPickerScroll: { paddingHorizontal: 16, gap: 8 },
  monthChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', minWidth: 65 },
  monthChipSelected: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  monthChipText: { fontSize: 14, fontWeight: 'bold', color: '#6B7280' },
  monthChipTextSelected: { color: 'white' },
  monthChipYear: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  monthChipYearSelected: { color: 'rgba(255,255,255,0.8)' },
  listenIndicator: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 10, backgroundColor: '#F0FDF4', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#BBF7D0' },
  listenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D1D5DB', marginRight: 8 },
  listenDotActive: { backgroundColor: '#22C55E' },
  listenText: { flex: 1, fontSize: 12, color: '#15803D' },
  buttonsRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 12, gap: 10 },
  fetchButton: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  fetchButtonGradient: { paddingVertical: 14, alignItems: 'center' },
  fetchButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  dashboardButton: { flex: 1, backgroundColor: '#F5F3FF', paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#DDD6FE' },
  dashboardButtonText: { color: '#7C3AED', fontSize: 14, fontWeight: 'bold' },
  budgetButton: { flex: 1, backgroundColor: '#FFF1F2', paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FECDD3' },
  budgetButtonText: { color: '#E11D48', fontSize: 14, fontWeight: 'bold' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginHorizontal: 20, marginTop: 25, marginBottom: 12, color: '#1A1A1A' },
  emptyBox: { backgroundColor: '#FFFFFF', marginHorizontal: 20, padding: 40, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { color: '#6B7280', fontSize: 16, fontWeight: 'bold' },
  emptySubText: { color: '#9CA3AF', fontSize: 13, marginTop: 5, textAlign: 'center' },
  transactionCard: { backgroundColor: '#FFFFFF', marginHorizontal: 20, marginBottom: 10, padding: 15, borderRadius: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  categoryDot: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  categoryEmoji: { fontSize: 22 },
  transactionLeft: { flex: 1 },
  merchantName: { fontSize: 15, fontWeight: 'bold', color: '#1A1A1A' },
  transactionDate: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4, alignSelf: 'flex-start' },
  categoryBadgeText: { fontSize: 11 },
  splitBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4, alignSelf: 'flex-start' },
  splitBadgeText: { fontSize: 11, color: '#059669', fontWeight: 'bold' },
  splitPreview: { marginTop: 4 },
  splitPreviewItem: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  splitPreviewMore: { fontSize: 10, color: '#9CA3AF', fontStyle: 'italic', marginTop: 1 },
  tapToAnnotate: { fontSize: 11, color: '#D1D5DB', marginTop: 3, fontStyle: 'italic' },
  notesPreview: { fontSize: 11, color: '#9CA3AF', marginTop: 2, fontStyle: 'italic' },
  amountContainer: { alignItems: 'flex-end' },
  transactionAmount: { fontSize: 16, fontWeight: 'bold', color: '#EF4444' },
  arrow: { fontSize: 20, color: '#D1D5DB', marginTop: 2 },

  // Add Manual Transaction Button (inline)
  addManualBtn: { marginHorizontal: 20, marginTop: 10, borderRadius: 14, overflow: 'hidden', elevation: 3, shadowColor: '#059669', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6 },
  addManualGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  addManualIcon: { fontSize: 20, color: 'white', fontWeight: 'bold' },
  addManualText: { color: 'white', fontSize: 14, fontWeight: 'bold' },

  // Manual Entry Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A', textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 4, marginBottom: 20 },
  modalLabel: { fontSize: 13, color: '#6B7280', fontWeight: '600', marginBottom: 8, marginTop: 12 },
  modalInput: { backgroundColor: '#F9FAFB', color: '#1A1A1A', padding: 15, borderRadius: 14, fontSize: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  amountInput: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', paddingVertical: 18 },
  payModeRow: { flexDirection: 'row', gap: 8 },
  payModeChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#F9FAFB', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  payModeChipActive: { backgroundColor: '#F5F3FF', borderColor: '#7C3AED', borderWidth: 1.5 },
  payModeEmoji: { fontSize: 16 },
  payModeText: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  payModeTextActive: { color: '#7C3AED' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalCancel: { flex: 1, backgroundColor: '#F9FAFB', padding: 16, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  modalCancelText: { color: '#6B7280', fontWeight: 'bold', fontSize: 15 },
  modalSaveContainer: { flex: 2, borderRadius: 14, overflow: 'hidden', elevation: 4, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
  modalSave: { padding: 16, alignItems: 'center' },
  modalSaveText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
});