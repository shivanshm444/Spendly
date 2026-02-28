import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useTransactions } from '../../context/TransactionContext';
import { LinearGradient } from 'expo-linear-gradient';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase.config';

const MOCK_SMS = [
  { body: "Your A/c XX1234 debited Rs.450.00 on 27-Feb-26 at SWIGGY. Avl Bal Rs.12,500", date: "1740614400000" },
  { body: "Your A/c XX1234 debited Rs.1200.00 on 26-Feb-26 at AMAZON. Avl Bal Rs.13,700", date: "1740528000000" },
  { body: "Your A/c XX1234 debited Rs.800.00 on 25-Feb-26 at ZOMATO. Avl Bal Rs.14,500", date: "1740441600000" },
  { body: "Your A/c XX1234 debited Rs.2500.00 on 24-Feb-26 at RELIANCE PETROL. Avl Bal Rs.17,000", date: "1740355200000" },
  { body: "Your A/c XX1234 debited Rs.350.00 on 23-Feb-26 at CAFE COFFEE DAY. Avl Bal Rs.17,350", date: "1740268800000" },
  { body: "Your A/c XX1234 debited Rs.999.00 on 22-Feb-26 at NETFLIX. Avl Bal Rs.18,349", date: "1740182400000" },
  { body: "Your A/c XX1234 debited Rs.3200.00 on 21-Feb-26 at BIG BAZAAR. Avl Bal Rs.21,549", date: "1740096000000" },
];

const parseBankSMS = (message: string, date: string) => {
  const amountMatch = message.match(/Rs\.?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  const isDebit = /debited/i.test(message);
  if (!isDebit) return null;
  const merchantMatch = message.match(/at\s+([A-Z][A-Z\s]+?)(?:\.|,|\s+Avl)/);
  const merchant = merchantMatch ? merchantMatch[1].trim() : 'Unknown';
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

export default function HomeScreen() {
  const router = useRouter();
  const { transactions, setTransactions } = useTransactions();
  const [fetched, setFetched] = useState(false);

  const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);

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

  const fetchMessages = () => {
    const parsed: any[] = [];
    MOCK_SMS.forEach((sms) => {
      const result = parseBankSMS(sms.body, sms.date);
      if (result) parsed.push(result);
    });
    setTransactions([...parsed]);
    setFetched(true);
    Alert.alert('✅ Done!', `Found ${parsed.length} transactions!`);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />

      <LinearGradient colors={['#1a0533', '#0A0A0F']} style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Good day 👋</Text>
            <Text style={styles.headerTitle}>BankTracker</Text>
          </View>
          <TouchableOpacity style={styles.dashboardIconBtn} onPress={handleLogout}>
            <Text style={styles.dashboardIcon}>🚪</Text>
          </TouchableOpacity>
        </View>

        <LinearGradient
          colors={['#7C3AED', '#4F46E5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Spent This Month</Text>
          <Text style={styles.balanceAmount}>₹{totalSpent.toFixed(2)}</Text>
          {fetched && (
            <View style={styles.balanceFooter}>
              <Text style={styles.transactionCount}>📋 {transactions.length} transactions</Text>
              <Text style={styles.categorizedCount}>
                ✅ {transactions.filter(t => t.category).length} categorized
              </Text>
            </View>
          )}
        </LinearGradient>
      </LinearGradient>

      <View style={styles.buttonsRow}>
        <TouchableOpacity style={styles.fetchButton} onPress={fetchMessages}>
          <LinearGradient colors={['#7C3AED', '#4F46E5']} style={styles.fetchButtonGradient}>
            <Text style={styles.fetchButtonText}>📩 Fetch SMS</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dashboardButton} onPress={() => router.push('/dashboard')}>
          <Text style={styles.dashboardButtonText}>📊 Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.budgetButton} onPress={() => router.push('/budget')}>
          <Text style={styles.budgetButtonText}>🎯 Budget</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Recent Transactions</Text>

      {transactions.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No transactions yet</Text>
          <Text style={styles.emptySubText}>Tap "Fetch SMS" to get started</Text>
        </View>
      ) : (
        transactions.map((t, index) => (
          <TouchableOpacity
            key={index}
            style={styles.transactionCard}
            onPress={() => router.push({
              pathname: '/annotation',
              params: {
                merchant: t.merchant,
                amount: String(t.amount),
                date: t.date,
                index: String(index)
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
              {t.category ? (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>🏷️ {t.category}</Text>
                </View>
              ) : (
                <Text style={styles.tapToAnnotate}>Tap to categorize</Text>
              )}
              {t.notes ? <Text style={styles.notesPreview}>📝 {t.notes}</Text> : null}
            </View>
            <View style={styles.amountContainer}>
              <Text style={styles.transactionAmount}>₹{t.amount.toFixed(0)}</Text>
              <Text style={styles.arrow}>›</Text>
            </View>
          </TouchableOpacity>
        ))
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
  buttonsRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 20, gap: 12 },
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
  emptySubText: { color: '#555', fontSize: 13, marginTop: 5 },
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
  tapToAnnotate: { fontSize: 11, color: '#444', marginTop: 3, fontStyle: 'italic' },
  notesPreview: { fontSize: 11, color: '#666', marginTop: 2, fontStyle: 'italic' },
  amountContainer: { alignItems: 'flex-end' },
  transactionAmount: { fontSize: 16, fontWeight: 'bold', color: '#FF6B6B' },
  arrow: { fontSize: 20, color: '#333', marginTop: 2 },
});