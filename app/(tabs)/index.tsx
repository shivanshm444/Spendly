import { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, StatusBar, Platform, AppState, Modal, TextInput, KeyboardAvoidingView, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useTransactions } from '../../context/TransactionContext';
import { LinearGradient } from 'expo-linear-gradient';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase.config';
import SmsAndroid from 'react-native-get-sms-android';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

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

// ── Category Styling Map ──
const CATEGORY_META: { [key: string]: { icon: string; iconSet: 'ion' | 'mci'; color: string; gradient: readonly [string, string] } } = {
  Food:          { icon: 'restaurant',       iconSet: 'ion', color: '#FF6B6B', gradient: ['#FF6B6B', '#EE5A24'] },
  Shopping:      { icon: 'cart',             iconSet: 'ion', color: '#4ECDC4', gradient: ['#4ECDC4', '#2AB7A9'] },
  Entertainment: { icon: 'film',             iconSet: 'ion', color: '#9B59B6', gradient: ['#A855F7', '#7C3AED'] },
  Fuel:          { icon: 'car-sport',        iconSet: 'ion', color: '#F39C12', gradient: ['#F39C12', '#E67E22'] },
  Groceries:     { icon: 'storefront',       iconSet: 'ion', color: '#2ECC71', gradient: ['#2ECC71', '#27AE60'] },
  Travel:        { icon: 'airplane',         iconSet: 'ion', color: '#45B7D1', gradient: ['#45B7D1', '#2980B9'] },
  Health:        { icon: 'medkit',           iconSet: 'ion', color: '#E74C3C', gradient: ['#E74C3C', '#C0392B'] },
  Rent:          { icon: 'home',             iconSet: 'ion', color: '#3498DB', gradient: ['#3498DB', '#2471A3'] },
  Education:     { icon: 'school',           iconSet: 'ion', color: '#1ABC9C', gradient: ['#1ABC9C', '#16A085'] },
  Snacks:        { icon: 'fast-food',        iconSet: 'ion', color: '#F97316', gradient: ['#F97316', '#EA580C'] },
  Dairy:         { icon: 'water',            iconSet: 'ion', color: '#06B6D4', gradient: ['#06B6D4', '#0891B2'] },
  Split:         { icon: 'cut',              iconSet: 'ion', color: '#10B981', gradient: ['#10B981', '#059669'] },
  Other:         { icon: 'wallet',           iconSet: 'ion', color: '#7C3AED', gradient: ['#7C3AED', '#6D28D9'] },
};

const getCategoryMeta = (category: string) => CATEGORY_META[category] || CATEGORY_META['Other'];

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

// ── Pulse animation for live indicator ──
const PulsingDot = () => {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[s.pulseDot, { opacity: anim }]} />;
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

  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualMerchant, setManualMerchant] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualPayMode, setManualPayMode] = useState('Cash');

  useEffect(() => { transactionsRef.current = transactions; }, [transactions]);
  useEffect(() => { isLoadedRef.current = isLoaded; }, [isLoaded]);

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
  const categorizedCount = filteredTransactions.filter(t => t.category && t.category !== '').length;

  // Quick stats
  const now = new Date();
  const isCurrentMonth = currentMonthData.month === now.getMonth() && currentMonthData.year === now.getFullYear();
  const daysElapsed = isCurrentMonth ? Math.max(now.getDate(), 1) : new Date(currentMonthData.year, currentMonthData.month + 1, 0).getDate();
  const dailyAvg = daysElapsed > 0 ? totalSpentMonth / daysElapsed : 0;

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
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      parsed.forEach(t => { knownSmsIdsRef.current.add(getSmsId(t.date, t.amount, t.merchant)); });
      const merged = mergeSmsWithExisting(parsed, currentTransactions);
      if (merged.length > currentTransactions.length) { setTransactions([...merged]); }
      setFetched(true);
      return;
    }
    const newTxns = parsed.filter(t => !knownSmsIdsRef.current.has(getSmsId(t.date, t.amount, t.merchant)));
    parsed.forEach(t => knownSmsIdsRef.current.add(getSmsId(t.date, t.amount, t.merchant)));
    if (newTxns.length > 0) {
      const merged = mergeSmsWithExisting(newTxns, currentTransactions);
      setTransactions([...merged]);
      setFetched(true);
      const newest = newTxns[0];
      setPendingTransaction({ amount: newest.amount, merchant: newest.merchant, date: newest.date, message: newest.message || '', category: '', notes: '' });
      router.push('/annotation');
    }
  }, [fetchAndParseSms, setTransactions, setPendingTransaction, router]);

  const manualFetch = useCallback(async () => {
    const parsed = await fetchAndParseSms();
    if (parsed.length === 0) { Alert.alert('No SMS', 'Could not read SMS. Make sure permissions are granted.'); return; }
    parsed.forEach(t => knownSmsIdsRef.current.add(getSmsId(t.date, t.amount, t.merchant)));
    const merged = mergeSmsWithExisting(parsed, transactionsRef.current);
    setTransactions([...merged]);
    setFetched(true);
    Alert.alert('✅ Done!', `Found ${parsed.length} transactions`);
  }, [fetchAndParseSms, setTransactions]);

  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(() => { fetchAndDetectNew(true); }, 2000);
    return () => clearTimeout(timer);
  }, [isLoaded]);

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
      } else if (nextAppState.match(/inactive|background/)) { stopPolling(); }
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
    if (!manualMerchant.trim()) { Alert.alert('Please enter a description'); return; }
    if (isNaN(amt) || amt <= 0) { Alert.alert('Please enter a valid amount'); return; }
    const nowMs = Date.now();
    const newTxn = { amount: amt, merchant: manualMerchant.trim(), date: String(nowMs), message: `Manual ${manualPayMode} payment: ${manualMerchant.trim()} ₹${amt}`, category: '', notes: '' };
    addTransaction(newTxn);
    setShowManualEntry(false);
    setManualMerchant('');
    setManualAmount('');
    setManualPayMode('Cash');
    setPendingTransaction(newTxn);
    router.push('/annotation');
  };

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" backgroundColor="#1E1B4B" />

      {/* ── Premium Header ── */}
      <LinearGradient colors={['#1E1B4B', '#312E81']} style={s.header}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.greeting}>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'} 👋</Text>
            <Text style={s.headerTitle}>Spendly</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/profile')} style={s.avatarBtn}>
            <Ionicons name="person" size={20} color="#C4B5FD" />
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        <View style={s.balanceCard}>
          <Text style={s.balanceLabel}>Spent in {MONTHS[currentMonthData.month]} {currentMonthData.year}</Text>
          <Text style={s.balanceAmount}>₹{totalSpentMonth.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>

          {/* Quick Stats Row */}
          <View style={s.statsRow}>
            <View style={s.statBox}>
              <View style={s.statIconWrap}>
                <Ionicons name="trending-up" size={14} color="#A78BFA" />
              </View>
              <View>
                <Text style={s.statValue}>₹{dailyAvg.toFixed(0)}</Text>
                <Text style={s.statLabel}>Avg/day</Text>
              </View>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBox}>
              <View style={s.statIconWrap}>
                <Ionicons name="receipt" size={14} color="#A78BFA" />
              </View>
              <View>
                <Text style={s.statValue}>{filteredTransactions.length}</Text>
                <Text style={s.statLabel}>Transactions</Text>
              </View>
            </View>
            <View style={s.statDivider} />
            <View style={s.statBox}>
              <View style={s.statIconWrap}>
                <Ionicons name="checkmark-circle" size={14} color="#A78BFA" />
              </View>
              <View>
                <Text style={s.statValue}>{categorizedCount}</Text>
                <Text style={s.statLabel}>Categorized</Text>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* ── Month Picker ── */}
      <View style={s.monthPickerWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.monthPickerScroll}>
          {monthOptions.map((m) => {
            const isSel = m.key === selectedMonth;
            return (
              <TouchableOpacity key={m.key} style={[s.monthChip, isSel && s.monthChipSel]} onPress={() => setSelectedMonth(m.key)}>
                <Text style={[s.monthChipText, isSel && s.monthChipTextSel]}>{m.label}</Text>
                <Text style={[s.monthChipYear, isSel && s.monthChipYearSel]}>{m.yearLabel}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Live Scanning Indicator ── */}
      <View style={s.liveBar}>
        <PulsingDot />
        <Text style={s.liveText}>Live scanning — new transactions appear automatically</Text>
      </View>

      {/* ── Action Buttons ── */}
      <View style={s.actionRow}>
        <TouchableOpacity style={s.actionBtn} onPress={manualFetch}>
          <LinearGradient colors={['#7C3AED', '#6D28D9']} style={s.actionGradient}>
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={s.actionText}>Refresh</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => router.push('/dashboard')}>
          <View style={[s.actionOutlined, { borderColor: '#DDD6FE' }]}>
            <Ionicons name="stats-chart" size={16} color="#7C3AED" />
            <Text style={[s.actionOutlinedText, { color: '#7C3AED' }]}>Dashboard</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={() => router.push('/budget')}>
          <View style={[s.actionOutlined, { borderColor: '#FECDD3' }]}>
            <Ionicons name="shield-checkmark" size={16} color="#E11D48" />
            <Text style={[s.actionOutlinedText, { color: '#E11D48' }]}>Budget</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Quick Actions Row ── */}
      <View style={s.quickActionsRow}>
        <TouchableOpacity style={s.quickActionBtn} onPress={() => setShowManualEntry(true)} activeOpacity={0.85}>
          <LinearGradient colors={['#10B981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.quickActionGrad}>
            <View style={s.quickActionIconWrap}>
              <Ionicons name="add-circle" size={24} color="#fff" />
            </View>
            <Text style={s.quickActionTitle}>Add Manual</Text>
            <Text style={s.quickActionSub}>Cash / UPI</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={s.quickActionBtn} onPress={() => router.push({ pathname: '/annotation', params: { scanReceipt: 'true' } })} activeOpacity={0.85}>
          <LinearGradient colors={['#7C3AED', '#6D28D9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.quickActionGrad}>
            <View style={s.quickActionIconWrap}>
              <Ionicons name="scan" size={24} color="#fff" />
            </View>
            <Text style={s.quickActionTitle}>Scan Receipt</Text>
            <Text style={s.quickActionSub}>Auto-fill items</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── Section Title ── */}
      <View style={s.sectionHeaderRow}>
        <Ionicons name="list" size={18} color="#6D28D9" />
        <Text style={s.sectionTitle}>{MONTHS[currentMonthData.month]} {currentMonthData.year} Transactions</Text>
        <View style={s.countBadge}><Text style={s.countBadgeText}>{filteredTransactions.length}</Text></View>
      </View>

      {/* ── Transaction List ── */}
      {filteredTransactions.length === 0 ? (
        <View style={s.emptyBox}>
          <Ionicons name="mail-open-outline" size={48} color="#D1D5DB" />
          <Text style={s.emptyText}>No transactions for {MONTHS[currentMonthData.month]}</Text>
          <Text style={s.emptySubText}>Try selecting a different month above</Text>
        </View>
      ) : (
        filteredTransactions.map((t, index) => {
          const globalIndex = transactions.indexOf(t);
          const meta = getCategoryMeta(t.category);
          return (
            <TouchableOpacity
              key={`${t.date}-${t.amount}-${index}`}
              style={[s.txnCard, { borderLeftColor: t.category ? meta.color : '#E5E7EB' }]}
              onPress={() => router.push({
                pathname: '/annotation',
                params: { merchant: t.merchant, amount: String(t.amount), date: t.date, index: String(globalIndex), id: getSmsId(t.date, t.amount, t.merchant) }
              })}>
              <LinearGradient colors={meta.gradient} style={s.txnIconBadge}>
                <Ionicons name={meta.icon as any} size={18} color="#fff" />
              </LinearGradient>
              <View style={s.txnLeft}>
                <Text style={s.txnMerchant} numberOfLines={1}>{t.merchant}</Text>
                <Text style={s.txnDate}>{new Date(parseInt(t.date)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                {t.category === 'Split' && t.splits ? (
                  <View style={s.splitBadge}>
                    <Ionicons name="cut" size={10} color="#059669" />
                    <Text style={s.splitBadgeText}>{t.splits.length} items split</Text>
                  </View>
                ) : t.category ? (
                  <View style={[s.catBadge, { backgroundColor: meta.color + '15' }]}>
                    <Text style={[s.catBadgeText, { color: meta.color }]}>{t.category}{t.subCategory ? ` › ${t.subCategory}` : ''}</Text>
                  </View>
                ) : (
                  <Text style={s.tapLabel}>Tap to categorize</Text>
                )}
                {t.splits && t.splits.length > 0 && (
                  <View style={s.splitPreview}>
                    {t.splits.slice(0, 2).map((sp, i) => (
                      <Text key={i} style={s.splitPreviewItem}>₹{sp.amount} — {sp.description}</Text>
                    ))}
                    {t.splits.length > 2 && <Text style={s.splitPreviewMore}>+{t.splits.length - 2} more…</Text>}
                  </View>
                )}
                {t.notes && !t.splits ? <Text style={s.notesPreview}>📝 {t.notes}</Text> : null}
              </View>
              <View style={s.txnRight}>
                <Text style={s.txnAmount}>₹{t.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
              </View>
            </TouchableOpacity>
          );
        })
      )}
      <View style={{ height: 40 }} />

      {/* ── Manual Entry Modal ── */}
      <Modal visible={showManualEntry} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setShowManualEntry(false)} />
          <View style={s.modalCard}>
            <View style={s.modalHandle} />
            <View style={s.modalHeaderRow}>
              <Ionicons name="cash" size={24} color="#10B981" />
              <Text style={s.modalTitle}>Add Transaction</Text>
            </View>
            <Text style={s.modalSubtitle}>For cash, UPI, or any manual payment</Text>

            <Text style={s.modalLabel}>Payment Mode</Text>
            <View style={s.payModeRow}>
              {([
                { mode: 'Cash', icon: 'cash' as const },
                { mode: 'UPI', icon: 'phone-portrait' as const },
                { mode: 'Card', icon: 'card' as const },
                { mode: 'Other', icon: 'swap-horizontal' as const },
              ]).map(({ mode, icon }) => (
                <TouchableOpacity key={mode} style={[s.payModeChip, manualPayMode === mode && s.payModeChipActive]} onPress={() => setManualPayMode(mode)}>
                  <Ionicons name={icon} size={16} color={manualPayMode === mode ? '#7C3AED' : '#9CA3AF'} />
                  <Text style={[s.payModeText, manualPayMode === mode && s.payModeTextActive]}>{mode}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.modalLabel}>What did you pay for?</Text>
            <TextInput style={s.modalInput} placeholder="e.g. Kurkure, Auto ride, Chai…" placeholderTextColor="#9CA3AF" value={manualMerchant} onChangeText={setManualMerchant} autoFocus />

            <Text style={s.modalLabel}>Amount (₹)</Text>
            <TextInput style={[s.modalInput, s.amountInput]} placeholder="0" placeholderTextColor="#9CA3AF" value={manualAmount} onChangeText={setManualAmount} keyboardType="numeric" />

            <View style={s.modalButtons}>
              <TouchableOpacity style={s.modalCancel} onPress={() => { setShowManualEntry(false); setManualMerchant(''); setManualAmount(''); }}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleManualSave} style={s.modalSaveWrap}>
                <LinearGradient colors={['#7C3AED', '#6D28D9']} style={s.modalSave}>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={s.modalSaveText}>Save</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

// ── Premium Styles ──
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F7FF' },

  // Header
  header: { paddingBottom: 24, paddingHorizontal: 20, paddingTop: 52 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 13, color: '#A5B4FC', letterSpacing: 0.5 },
  headerTitle: { fontSize: 30, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  avatarBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },

  // Balance Card
  balanceCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  balanceLabel: { fontSize: 12, color: '#C4B5FD', fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  balanceAmount: { fontSize: 44, fontWeight: '800', color: '#FFFFFF', marginTop: 4, letterSpacing: -1 },

  // Stats Row
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 16, padding: 12 },
  statBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statIconWrap: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(167,139,250,0.15)', alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  statLabel: { fontSize: 10, color: '#A5B4FC', marginTop: 1 },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 4 },

  // Month Picker
  monthPickerWrap: { marginTop: -1, backgroundColor: '#F8F7FF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16 },
  monthPickerScroll: { paddingHorizontal: 16, gap: 8 },
  monthChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#EDE9FE', alignItems: 'center', minWidth: 65 },
  monthChipSel: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  monthChipText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  monthChipTextSel: { color: '#FFFFFF' },
  monthChipYear: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  monthChipYearSel: { color: 'rgba(255,255,255,0.7)' },

  // Live Scanning
  liveBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 12, backgroundColor: '#F0FDF4', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#BBF7D0', gap: 10 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  liveText: { flex: 1, fontSize: 12, color: '#15803D', fontWeight: '500' },

  // Action Buttons
  actionRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 14, gap: 10 },
  actionBtn: { flex: 1 },
  actionGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 14 },
  actionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  actionOutlined: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1.5 },
  actionOutlinedText: { fontSize: 13, fontWeight: '700' },

  // Quick Actions (Add Manual + Scan Receipt)
  quickActionsRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 12, gap: 10 },
  quickActionBtn: { flex: 1, borderRadius: 18, overflow: 'hidden', elevation: 4, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 8 },
  quickActionGrad: { alignItems: 'center', paddingVertical: 18, paddingHorizontal: 12, gap: 6 },
  quickActionIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  quickActionTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  quickActionSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '500' },

  // Section Header
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 24, marginBottom: 14, gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1E1B4B', flex: 1 },
  countBadge: { backgroundColor: '#EDE9FE', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },

  // Empty
  emptyBox: { backgroundColor: '#FFFFFF', marginHorizontal: 20, padding: 40, borderRadius: 24, alignItems: 'center', borderWidth: 1, borderColor: '#EDE9FE' },
  emptyText: { color: '#6B7280', fontSize: 15, fontWeight: '600', marginTop: 12 },
  emptySubText: { color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' },

  // Transaction Card
  txnCard: { backgroundColor: '#FFFFFF', marginHorizontal: 20, marginBottom: 10, padding: 14, borderRadius: 18, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6', borderLeftWidth: 4, elevation: 2, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 },
  txnIconBadge: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txnLeft: { flex: 1 },
  txnMerchant: { fontSize: 15, fontWeight: '700', color: '#1E1B4B' },
  txnDate: { fontSize: 11, color: '#9CA3AF', marginTop: 2, fontWeight: '500' },
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 5, alignSelf: 'flex-start' },
  catBadgeText: { fontSize: 11, fontWeight: '600' },
  splitBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 5, alignSelf: 'flex-start' },
  splitBadgeText: { fontSize: 11, color: '#059669', fontWeight: '600' },
  splitPreview: { marginTop: 4 },
  splitPreviewItem: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  splitPreviewMore: { fontSize: 10, color: '#9CA3AF', fontStyle: 'italic', marginTop: 1 },
  tapLabel: { fontSize: 11, color: '#C4B5FD', marginTop: 4, fontWeight: '500', fontStyle: 'italic' },
  notesPreview: { fontSize: 11, color: '#9CA3AF', marginTop: 3, fontStyle: 'italic' },
  txnRight: { alignItems: 'flex-end', gap: 4 },
  txnAmount: { fontSize: 16, fontWeight: '800', color: '#EF4444' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 16 },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 4 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1E1B4B' },
  modalSubtitle: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginBottom: 20 },
  modalLabel: { fontSize: 13, color: '#6B7280', fontWeight: '700', marginBottom: 8, marginTop: 14 },
  modalInput: { backgroundColor: '#F9FAFB', color: '#1E1B4B', padding: 15, borderRadius: 14, fontSize: 16, borderWidth: 1.5, borderColor: '#EDE9FE' },
  amountInput: { fontSize: 28, fontWeight: '800', textAlign: 'center', paddingVertical: 18 },
  payModeRow: { flexDirection: 'row', gap: 8 },
  payModeChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F9FAFB', paddingVertical: 11, borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB' },
  payModeChipActive: { backgroundColor: '#F5F3FF', borderColor: '#7C3AED' },
  payModeText: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  payModeTextActive: { color: '#7C3AED' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalCancel: { flex: 1, backgroundColor: '#F9FAFB', padding: 16, borderRadius: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB' },
  modalCancelText: { color: '#6B7280', fontWeight: '700', fontSize: 15 },
  modalSaveWrap: { flex: 2, borderRadius: 14, overflow: 'hidden', elevation: 4 },
  modalSave: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  modalSaveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});