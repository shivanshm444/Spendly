import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTransactions } from '../../context/TransactionContext';

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
  return '#2E86AB';
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
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>BankTracker 💰</Text>
        <Text style={styles.headerSubtitle}>Your Smart Expense Manager</Text>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Total Spent This Month</Text>
        <Text style={styles.balanceAmount}>₹{totalSpent.toFixed(2)}</Text>
        {fetched && <Text style={styles.transactionCount}>{transactions.length} transactions</Text>}
      </View>

      <TouchableOpacity style={styles.button} onPress={fetchMessages}>
        <Text style={styles.buttonText}>📩 Fetch Bank Messages</Text>
      </TouchableOpacity>
<TouchableOpacity style={styles.dashboardButton} onPress={() => router.push('/dashboard')}>
  <Text style={styles.dashboardButtonText}>📊 View Dashboard</Text>
</TouchableOpacity>
      <Text style={styles.sectionTitle}>Recent Transactions</Text>

      {transactions.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No transactions yet.</Text>
          <Text style={styles.emptySubText}>Tap "Fetch Bank Messages" to start!</Text>
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
            <View style={[styles.categoryDot, { backgroundColor: getCategoryColor(t.merchant) }]}>
              <Text style={styles.categoryEmoji}>{getCategoryEmoji(t.merchant)}</Text>
            </View>
            <View style={styles.transactionLeft}>
              <Text style={styles.merchantName}>{t.merchant}</Text>
              <Text style={styles.transactionDate}>
                {new Date(parseInt(t.date)).toLocaleDateString('en-IN')}
              </Text>
             {t.category ? (
  <Text style={styles.categoryTag}>🏷️ {t.category}</Text>
) : (
  <Text style={styles.tapToAnnotate}>Tap to add category</Text>
)}
{t.notes ? (
  <Text style={styles.notesPreview}>📝 {t.notes}</Text>
) : null}
            </View>
            <Text style={styles.transactionAmount}>₹{t.amount.toFixed(2)}</Text>
          </TouchableOpacity>
        ))
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: {
    backgroundColor: '#2E86AB',
    padding: 30,
    paddingTop: 60,
    alignItems: 'center',
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: 'white' },
  headerSubtitle: { fontSize: 14, color: '#d0eaf5', marginTop: 5 },
  balanceCard: {
    backgroundColor: 'white',
    margin: 20,
    padding: 25,
    borderRadius: 20,
    alignItems: 'center',
    elevation: 5,
  },
  balanceLabel: { fontSize: 14, color: '#888' },
  balanceAmount: { fontSize: 40, fontWeight: 'bold', color: '#2E86AB', marginTop: 5 },
  transactionCount: { fontSize: 12, color: '#aaa', marginTop: 5 },
  button: {
    backgroundColor: '#2E86AB',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
  },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 20,
    marginTop: 25,
    marginBottom: 10,
    color: '#333',
  },
  emptyBox: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    elevation: 2,
  },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { color: '#555', fontSize: 16, fontWeight: 'bold' },
  emptySubText: { color: '#aaa', fontSize: 13, marginTop: 5 },
  transactionCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 15,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
  },
  categoryDot: {
    width: 45,
    height: 45,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryEmoji: { fontSize: 20 },
  transactionLeft: { flex: 1 },
  merchantName: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  transactionDate: { fontSize: 12, color: '#aaa', marginTop: 2 },
  categoryTag: { fontSize: 12, color: '#2E86AB', marginTop: 3 },
  tapToAnnotate: { fontSize: 11, color: '#ccc', marginTop: 3, fontStyle: 'italic' },
  transactionAmount: { fontSize: 16, fontWeight: 'bold', color: '#e74c3c' },
  notesPreview: { fontSize: 11, color: '#888', marginTop: 2, fontStyle: 'italic' },
  dashboardButton: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 10,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    borderWidth: 1,
    borderColor: '#2E86AB',
  },
  dashboardButtonText: { color: '#2E86AB', fontSize: 16, fontWeight: 'bold' },
});

