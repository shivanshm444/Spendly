import { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Dimensions, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { useTransactions } from '../context/TransactionContext';
import { PieChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';

const screenWidth = Dimensions.get('window').width;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

// Generate last 12 months for picker
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

const getSpendingPersonality = (categories: { [key: string]: number }) => {
  const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return { title: 'Mystery Spender 🕵️', desc: 'Categorize transactions to reveal your spending personality!' };
  const top = sorted[0][0];
  if (top === 'Food') return { title: 'Foodie 🍕', desc: 'You love food! Most of your spending goes to eating out.' };
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

  const monthOptions = generateMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].key);
  const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({});
  const currentMonthData = monthOptions.find(m => m.key === selectedMonth)!;

  // Filter transactions to selected month
  const filteredTransactions = transactions.filter(t => {
    const tDate = parseInt(t.date);
    return !isNaN(tDate) && tDate >= currentMonthData.start && tDate <= currentMonthData.end;
  });

  const totalSpent = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
  const annotated = filteredTransactions.filter(t => t.category).length;
  const avgPerTransaction = filteredTransactions.length > 0 ? totalSpent / filteredTransactions.length : 0;

  // Days in selected month that have passed
  const now = new Date();
  const isCurrentMonth = currentMonthData.month === now.getMonth() && currentMonthData.year === now.getFullYear();
  const daysElapsed = isCurrentMonth ? now.getDate() : new Date(currentMonthData.year, currentMonthData.month + 1, 0).getDate();
  const dailyAvg = daysElapsed > 0 ? totalSpent / daysElapsed : 0;

  const categoryTotals: { [key: string]: number } = {};
  filteredTransactions.forEach(t => {
    if (t.category) {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    }
  });

  const pieData = Object.entries(categoryTotals).map(([name, amount]) => ({
    name,
    amount,
    color: CATEGORY_COLORS[name] || '#95A5A6',
    legendFontColor: '#888',
    legendFontSize: 11,
  }));

  const personality = getSpendingPersonality(categoryTotals);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={() => router.push('/calendar')} style={styles.calendarBtn}>
          <Text style={styles.calendarBtnText}>📅</Text>
        </TouchableOpacity>
      </View>

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

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryEmoji}>💸</Text>
          <Text style={styles.summaryAmount}>₹{totalSpent.toFixed(0)}</Text>
          <Text style={styles.summaryLabel}>Total Spent</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryEmoji}>🏷️</Text>
          <Text style={styles.summaryAmount}>{annotated}/{filteredTransactions.length}</Text>
          <Text style={styles.summaryLabel}>Categorized</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryEmoji}>📅</Text>
          <Text style={styles.summaryAmount}>{MONTHS[currentMonthData.month]}</Text>
          <Text style={styles.summaryLabel}>{currentMonthData.year}</Text>
        </View>
      </View>

      {/* Extra Stats Row */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryEmoji}>📊</Text>
          <Text style={styles.summaryAmount}>₹{avgPerTransaction.toFixed(0)}</Text>
          <Text style={styles.summaryLabel}>Avg / Txn</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryEmoji}>📆</Text>
          <Text style={styles.summaryAmount}>₹{dailyAvg.toFixed(0)}</Text>
          <Text style={styles.summaryLabel}>Daily Avg</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryEmoji}>🔢</Text>
          <Text style={styles.summaryAmount}>{Object.keys(categoryTotals).length}</Text>
          <Text style={styles.summaryLabel}>Categories</Text>
        </View>
      </View>

      {/* Spending Personality */}
      <LinearGradient
        colors={['#7C3AED', '#4F46E5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.personalityCard}>
        <Text style={styles.personalityLabel}>
          {MONTHS[currentMonthData.month]} Spending Personality
        </Text>
        <Text style={styles.personalityTitle}>{personality.title}</Text>
        <Text style={styles.personalityDesc}>{personality.desc}</Text>
      </LinearGradient>


      {/* Pie Chart */}
      {pieData.length > 0 ? (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>
            {MONTHS[currentMonthData.month]} Spending by Category
          </Text>
          <PieChart
            data={pieData}
            width={screenWidth - 40}
            height={200}
            chartConfig={{
              color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              backgroundColor: '#1a1a2e',
            }}
            accessor="amount"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute={false}
          />
        </View>
      ) : (
        <View style={styles.emptyChart}>
          <Text style={styles.emptyChartEmoji}>📊</Text>
          <Text style={styles.emptyChartText}>
            {filteredTransactions.length === 0
              ? `No transactions in ${MONTHS[currentMonthData.month]}`
              : 'Categorize transactions to see chart!'}
          </Text>
        </View>
      )}

      {/* Category Breakdown */}
      <Text style={styles.sectionTitle}>Category Breakdown</Text>
      {Object.entries(categoryTotals).length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No categories yet</Text>
          <Text style={styles.emptySubText}>Go back and categorize your transactions!</Text>
        </View>
      ) : (
        Object.entries(categoryTotals)
          .sort((a, b) => b[1] - a[1])
          .map(([category, amount]) => {
            const isExpanded = !!expandedCategories[category];
            // Build subcategory + product breakdown for this category
            const subTotals: { [key: string]: { amount: number; count: number } } = {};
            filteredTransactions.forEach(t => {
              if (t.category === category) {
                // Prefer item-level data
                if (t.items && t.items.length > 0) {
                  t.items.forEach(item => {
                    const key = item.name;
                    if (!subTotals[key]) subTotals[key] = { amount: 0, count: 0 };
                    subTotals[key].amount += item.qty * item.price;
                    subTotals[key].count += item.qty;
                  });
                } else if (t.splits && t.splits.length > 0) {
                  t.splits.forEach(s => {
                    if (s.category === category) {
                      const key = s.description || 'Other';
                      if (!subTotals[key]) subTotals[key] = { amount: 0, count: 0 };
                      subTotals[key].amount += s.amount;
                      subTotals[key].count += 1;
                    }
                  });
                } else {
                  const key = t.subCategory ? `${t.subCategory} › ${t.merchant}` : t.merchant;
                  if (!subTotals[key]) subTotals[key] = { amount: 0, count: 0 };
                  subTotals[key].amount += t.amount;
                  subTotals[key].count += 1;
                }
              }
            });
            const sortedSubs = Object.entries(subTotals).sort((a, b) => b[1].amount - a[1].amount);
            const catColor = CATEGORY_COLORS[category] || '#95A5A6';

            return (
              <View key={category}>
                <TouchableOpacity
                  style={[styles.categoryRow, isExpanded && styles.categoryRowExpanded]}
                  onPress={() => setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }))}
                  activeOpacity={0.7}>
                  <View style={[styles.categoryDot, { backgroundColor: catColor }]} />
                  <Text style={styles.categoryName}>{category}</Text>
                  <View style={styles.categoryBarContainer}>
                    <View style={[styles.categoryBar, {
                      width: `${(amount / totalSpent) * 100}%`,
                      backgroundColor: catColor
                    }]} />
                  </View>
                  <Text style={styles.categoryAmount}>₹{amount.toFixed(0)}</Text>
                  <Text style={styles.expandArrow}>{isExpanded ? '▾' : '▸'}</Text>
                </TouchableOpacity>

                {isExpanded && sortedSubs.length > 0 && (
                  <View style={styles.subBreakdown}>
                    {sortedSubs.map(([name, data]) => {
                      const pct = (data.amount / amount) * 100;
                      return (
                        <View key={name} style={styles.subRow}>
                          <View style={[styles.subDot, { backgroundColor: catColor + '60' }]} />
                          <Text style={styles.subName} numberOfLines={1}>{name}</Text>
                          <View style={styles.subBarContainer}>
                            <View style={[styles.subBar, { width: `${pct}%`, backgroundColor: catColor + '40' }]} />
                          </View>
                          <View style={styles.subRight}>
                            <Text style={[styles.subAmount, { color: catColor }]}>₹{data.amount.toFixed(0)}</Text>
                            {data.count > 1 && (
                              <Text style={styles.subCount}>{data.count}× · ₹{(data.amount / data.count).toFixed(0)}/ea</Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {isExpanded && sortedSubs.length === 0 && (
                  <View style={styles.subBreakdown}>
                    <Text style={styles.subEmptyText}>No detailed breakdown available</Text>
                  </View>
                )}
              </View>
            );
          })
      )}

      {/* Top Merchants */}
      <Text style={styles.sectionTitle}>Top Merchants</Text>
      {filteredTransactions.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No transactions</Text>
          <Text style={styles.emptySubText}>Transactions will appear here after detection</Text>
        </View>
      ) : (
        (() => {
          const merchantTotals: { [key: string]: { amount: number; count: number } } = {};
          filteredTransactions.forEach(t => {
            if (!merchantTotals[t.merchant]) merchantTotals[t.merchant] = { amount: 0, count: 0 };
            merchantTotals[t.merchant].amount += t.amount;
            merchantTotals[t.merchant].count += 1;
          });
          return Object.entries(merchantTotals)
            .sort((a, b) => b[1].amount - a[1].amount)
            .slice(0, 5)
            .map(([merchant, data]) => (
              <View key={merchant} style={styles.merchantRow}>
                <Text style={styles.merchantIcon}>🏪</Text>
                <View style={styles.merchantInfo}>
                  <Text style={styles.merchantName}>{merchant}</Text>
                  <Text style={styles.merchantCount}>{data.count} transaction{data.count > 1 ? 's' : ''}</Text>
                </View>
                <Text style={styles.merchantAmount}>₹{data.amount.toFixed(0)}</Text>
              </View>
            ));
        })()
      )}

      {/* Product-wise Spending */}
      <Text style={styles.sectionTitle}>🛍️ Product-wise Spending</Text>
      {filteredTransactions.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No products tracked yet</Text>
          <Text style={styles.emptySubText}>Add transactions to see per-product spending</Text>
        </View>
      ) : (
        (() => {
          const productMap: { [key: string]: { amount: number; count: number; category: string; subCategory: string } } = {};
          filteredTransactions.forEach(t => {
            // Prefer structured items data
            if (t.items && t.items.length > 0) {
              t.items.forEach(item => {
                const key = item.name;
                if (!productMap[key]) productMap[key] = { amount: 0, count: 0, category: t.category || '', subCategory: t.subCategory || '' };
                productMap[key].amount += item.qty * item.price;
                productMap[key].count += item.qty;
              });
            } else if (t.splits && t.splits.length > 0) {
              t.splits.forEach(s => {
                const key = s.description || 'Unnamed item';
                if (!productMap[key]) productMap[key] = { amount: 0, count: 0, category: s.category, subCategory: '' };
                productMap[key].amount += s.amount;
                productMap[key].count += 1;
              });
            } else {
              const key = t.merchant;
              if (!productMap[key]) productMap[key] = { amount: 0, count: 0, category: t.category || '', subCategory: t.subCategory || '' };
              productMap[key].amount += t.amount;
              productMap[key].count += 1;
            }
          });
          return Object.entries(productMap)
            .sort((a, b) => b[1].amount - a[1].amount)
            .map(([product, data]) => {
              const catColor = CATEGORY_COLORS[data.category] || '#95A5A6';
              const perItem = data.count > 0 ? data.amount / data.count : data.amount;
              return (
                <View key={product} style={styles.productRow}>
                  <View style={[styles.productDot, { backgroundColor: catColor + '25' }]}>
                    <Text style={styles.productDotText}>{product.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={1}>{product}</Text>
                    <View style={styles.productMeta}>
                      {data.category ? (
                        <View style={[styles.productCatBadge, { backgroundColor: catColor + '18' }]}>
                          <Text style={[styles.productCatText, { color: catColor }]}>{data.category}{data.subCategory ? ` › ${data.subCategory}` : ''}</Text>
                        </View>
                      ) : null}
                      <Text style={styles.productCount}>{data.count}×</Text>
                      {data.count > 1 && (
                        <Text style={styles.productPerItem}>₹{perItem.toFixed(0)}/each</Text>
                      )}
                    </View>
                  </View>
                  <Text style={styles.productAmount}>₹{data.amount.toFixed(0)}</Text>
                </View>
              );
            });
        })()
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: '#FFFFFF', padding: 20, paddingTop: 55, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backButton: { marginRight: 15 },
  backText: { color: '#7C3AED', fontSize: 16, fontWeight: 'bold' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A' },
  calendarBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DDD6FE' },
  calendarBtnText: { fontSize: 20 },

  // Month Picker
  monthPickerContainer: { marginTop: 10, marginBottom: 5 },
  monthPickerScroll: { paddingHorizontal: 16, gap: 8 },
  monthChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', minWidth: 65 },
  monthChipSelected: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  monthChipText: { fontSize: 14, fontWeight: 'bold', color: '#6B7280' },
  monthChipTextSelected: { color: 'white' },
  monthChipYear: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  monthChipYearSelected: { color: 'rgba(255,255,255,0.8)' },

  summaryRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 12, gap: 10 },
  summaryCard: { flex: 1, backgroundColor: '#FFFFFF', padding: 15, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  summaryEmoji: { fontSize: 24 },
  summaryAmount: { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A', marginTop: 5 },
  summaryLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 3 },
  personalityCard: { margin: 20, padding: 22, borderRadius: 24, elevation: 10 },
  personalityLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  personalityTitle: { fontSize: 26, fontWeight: 'bold', color: 'white', marginTop: 5 },
  personalityDesc: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 8, lineHeight: 20 },
  chartCard: { backgroundColor: '#FFFFFF', marginHorizontal: 20, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#F3F4F6', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  chartTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 10 },
  emptyChart: { backgroundColor: '#FFFFFF', marginHorizontal: 20, padding: 30, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  emptyChartEmoji: { fontSize: 40, marginBottom: 10 },
  emptyChartText: { color: '#9CA3AF', fontSize: 14 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginHorizontal: 20, marginTop: 25, marginBottom: 12, color: '#1A1A1A' },
  emptyBox: { backgroundColor: '#FFFFFF', marginHorizontal: 20, padding: 30, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  emptyText: { color: '#6B7280', fontSize: 16, fontWeight: 'bold' },
  emptySubText: { color: '#9CA3AF', fontSize: 13, marginTop: 5 },
  categoryRow: { backgroundColor: '#FFFFFF', marginHorizontal: 20, marginBottom: 10, padding: 15, borderRadius: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  categoryDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  categoryName: { fontSize: 14, fontWeight: 'bold', color: '#1A1A1A', width: 100 },
  categoryBarContainer: { flex: 1, height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, marginHorizontal: 10 },
  categoryBar: { height: 6, borderRadius: 3 },
  categoryAmount: { fontSize: 13, fontWeight: 'bold', color: '#7C3AED' },
  expandArrow: { fontSize: 14, color: '#9CA3AF', marginLeft: 6, fontWeight: 'bold' },
  categoryRowExpanded: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 0, borderBottomWidth: 0 },

  // Subcategory breakdown
  subBreakdown: { backgroundColor: '#FAFBFC', marginHorizontal: 20, marginBottom: 10, paddingHorizontal: 15, paddingVertical: 10, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, borderWidth: 1, borderTopWidth: 0, borderColor: '#F3F4F6' },
  subRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F610' },
  subDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  subName: { fontSize: 13, color: '#4B5563', flex: 1, fontWeight: '500' },
  subBarContainer: { width: 50, height: 4, backgroundColor: '#F3F4F6', borderRadius: 2, marginHorizontal: 8, overflow: 'hidden' },
  subBar: { height: 4, borderRadius: 2 },
  subRight: { alignItems: 'flex-end', minWidth: 65 },
  subAmount: { fontSize: 13, fontWeight: 'bold' },
  subCount: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  subEmptyText: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', paddingVertical: 8 },

  // Top Merchants
  merchantRow: { backgroundColor: '#FFFFFF', marginHorizontal: 20, marginBottom: 10, padding: 15, borderRadius: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  merchantIcon: { fontSize: 20, marginRight: 12 },
  merchantInfo: { flex: 1 },
  merchantName: { fontSize: 14, fontWeight: 'bold', color: '#1A1A1A' },
  merchantCount: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  merchantAmount: { fontSize: 14, fontWeight: 'bold', color: '#EF4444' },

  // Product-wise Spending
  productRow: { backgroundColor: '#FFFFFF', marginHorizontal: 20, marginBottom: 10, padding: 15, borderRadius: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  productDot: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  productDotText: { fontSize: 18, fontWeight: 'bold', color: '#6B7280' },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: 'bold', color: '#1A1A1A' },
  productMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  productCatBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  productCatText: { fontSize: 10, fontWeight: '700' },
  productCount: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  productPerItem: { fontSize: 11, color: '#7C3AED', fontWeight: '600' },
  productAmount: { fontSize: 15, fontWeight: 'bold', color: '#EF4444' },
});