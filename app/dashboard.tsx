import { StyleSheet, Text, View, ScrollView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { useTransactions } from '../context/TransactionContext';
import { PieChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width;

const CATEGORY_COLORS: { [key: string]: string } = {
  Food: '#FF6B6B',
  Shopping: '#4ECDC4',
  Travel: '#45B7D1',
  Fuel: '#F39C12',
  Entertainment: '#9B59B6',
  Groceries: '#2ECC71',
  Health: '#E74C3C',
  Rent: '#3498DB',
  Education: '#1ABC9C',
  Other: '#95A5A6',
};

const getSpendingPersonality = (categories: { [key: string]: number }) => {
  const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return { title: 'Mystery Spender 🕵️', desc: 'We could not figure out your spending style yet!' };
  const top = sorted[0][0];
  if (top === 'Food') return { title: 'Foodie 🍕', desc: 'You love food! 60% of your spending goes to eating out.' };
  if (top === 'Shopping') return { title: 'Shopaholic 🛒', desc: 'Retail therapy is your thing! You spend most on shopping.' };
  if (top === 'Entertainment') return { title: 'Entertainment Lover 🎬', desc: 'Movies, music and fun — that is your life!' };
  if (top === 'Fuel') return { title: 'Road Warrior ⛽', desc: 'Always on the move! Fuel is your biggest expense.' };
  if (top === 'Groceries') return { title: 'Home Chef 🏪', desc: 'You prefer cooking at home. Smart spender!' };
  if (top === 'Rent') return { title: 'Homebody 🏠', desc: 'Home is where the heart is — and most of your money!' };
  return { title: 'Balanced Spender 💳', desc: 'You spend wisely across different categories!' };
};

export default function DashboardScreen() {
  const router = useRouter();
  const { transactions } = useTransactions();

  const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
  const annotated = transactions.filter(t => t.category).length;

  // Build category wise totals
  const categoryTotals: { [key: string]: number } = {};
  transactions.forEach(t => {
    if (t.category) {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    }
  });

  // Build pie chart data
  const pieData = Object.entries(categoryTotals).map(([name, amount]) => ({
    name,
    amount,
    color: CATEGORY_COLORS[name] || '#95A5A6',
    legendFontColor: '#333',
    legendFontSize: 12,
  }));

  const personality = getSpendingPersonality(categoryTotals);

  return (
    <ScrollView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dashboard 📊</Text>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryEmoji}>💸</Text>
          <Text style={styles.summaryAmount}>₹{totalSpent.toFixed(0)}</Text>
          <Text style={styles.summaryLabel}>Total Spent</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryEmoji}>🏷️</Text>
          <Text style={styles.summaryAmount}>{annotated}/{transactions.length}</Text>
          <Text style={styles.summaryLabel}>Categorized</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryEmoji}>📅</Text>
          <Text style={styles.summaryAmount}>{new Date().toLocaleString('en-IN', { month: 'short' })}</Text>
          <Text style={styles.summaryLabel}>This Month</Text>
        </View>
      </View>

      {/* Spending Personality */}
      <View style={styles.personalityCard}>
        <Text style={styles.personalityTitle}>Your Spending Personality</Text>
        <Text style={styles.personalityName}>{personality.title}</Text>
        <Text style={styles.personalityDesc}>{personality.desc}</Text>
      </View>

      {/* Pie Chart */}
      {pieData.length > 0 ? (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Spending by Category</Text>
          <PieChart
            data={pieData}
            width={screenWidth - 40}
            height={200}
            chartConfig={{
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            }}
            accessor="amount"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute={false}
          />
        </View>
      ) : (
        <View style={styles.emptyChart}>
          <Text style={styles.emptyChartText}>📊 Categorize transactions to see chart!</Text>
        </View>
      )}

      {/* Category Breakdown */}
      <Text style={styles.sectionTitle}>Category Breakdown</Text>
      {Object.entries(categoryTotals).length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No categories yet.</Text>
          <Text style={styles.emptySubText}>Go back and categorize your transactions!</Text>
        </View>
      ) : (
        Object.entries(categoryTotals)
          .sort((a, b) => b[1] - a[1])
          .map(([category, amount]) => (
            <View key={category} style={styles.categoryRow}>
              <View style={[styles.categoryDot, { backgroundColor: CATEGORY_COLORS[category] || '#95A5A6' }]} />
              <Text style={styles.categoryName}>{category}</Text>
              <View style={styles.categoryBarContainer}>
                <View style={[styles.categoryBar, {
                  width: `${(amount / totalSpent) * 100}%`,
                  backgroundColor: CATEGORY_COLORS[category] || '#95A5A6'
                }]} />
              </View>
              <Text style={styles.categoryAmount}>₹{amount.toFixed(0)}</Text>
            </View>
          ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: {
    backgroundColor: '#2E86AB',
    padding: 20,
    paddingTop: 55,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: { marginRight: 15 },
  backText: { color: 'white', fontSize: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  summaryRow: {
    flexDirection: 'row',
    marginHorizontal: 15,
    marginTop: 20,
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 3,
  },
  summaryEmoji: { fontSize: 24 },
  summaryAmount: { fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 5 },
  summaryLabel: { fontSize: 11, color: '#aaa', marginTop: 3 },
  personalityCard: {
    backgroundColor: '#2E86AB',
    margin: 20,
    padding: 20,
    borderRadius: 20,
    elevation: 5,
  },
  personalityTitle: { fontSize: 13, color: '#d0eaf5' },
  personalityName: { fontSize: 24, fontWeight: 'bold', color: 'white', marginTop: 5 },
  personalityDesc: { fontSize: 13, color: '#d0eaf5', marginTop: 8, lineHeight: 20 },
  chartCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 20,
    elevation: 3,
  },
  chartTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  emptyChart: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    elevation: 2,
  },
  emptyChartText: { color: '#aaa', fontSize: 14 },
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
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    elevation: 2,
  },
  emptyText: { color: '#555', fontSize: 16, fontWeight: 'bold' },
  emptySubText: { color: '#aaa', fontSize: 13, marginTop: 5 },
  categoryRow: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
  },
  categoryDot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  categoryName: { fontSize: 14, fontWeight: 'bold', color: '#333', width: 100 },
  categoryBarContainer: { flex: 1, height: 8, backgroundColor: '#f0f0f0', borderRadius: 4, marginHorizontal: 10 },
  categoryBar: { height: 8, borderRadius: 4 },
  categoryAmount: { fontSize: 13, fontWeight: 'bold', color: '#333' },
});