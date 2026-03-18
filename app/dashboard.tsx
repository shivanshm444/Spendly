import { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Dimensions, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { useTransactions } from '../context/TransactionContext';
import { PieChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const screenWidth = Dimensions.get('window').width;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CATEGORY_COLORS: { [key: string]: string } = {
  Food: '#FF6B6B', Shopping: '#4ECDC4', Travel: '#45B7D1', Fuel: '#F39C12',
  Entertainment: '#9B59B6', Groceries: '#2ECC71', Health: '#E74C3C',
  Rent: '#3498DB', Education: '#1ABC9C', Other: '#95A5A6',
  Snacks: '#F97316', Dairy: '#60A5FA',
};

const CATEGORY_ICONS: { [key: string]: string } = {
  Food: 'restaurant', Shopping: 'cart', Travel: 'airplane', Fuel: 'car-sport',
  Entertainment: 'film', Groceries: 'storefront', Health: 'medkit',
  Rent: 'home', Education: 'school', Other: 'wallet',
  Snacks: 'fast-food', Dairy: 'water',
};

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
  if (sorted.length === 0) return { title: 'Mystery Spender', icon: 'help-circle' as const, desc: 'Categorize transactions to reveal your spending personality!' };
  const top = sorted[0][0];
  if (top === 'Food') return { title: 'Foodie', icon: 'restaurant' as const, desc: 'You love food! Most of your spending goes to eating out.' };
  if (top === 'Shopping') return { title: 'Shopaholic', icon: 'cart' as const, desc: 'Retail therapy is your thing! You spend most on shopping.' };
  if (top === 'Entertainment') return { title: 'Entertainment Lover', icon: 'film' as const, desc: 'Movies, music and fun — that is your life!' };
  if (top === 'Fuel') return { title: 'Road Warrior', icon: 'car-sport' as const, desc: 'Always on the move! Fuel is your biggest expense.' };
  if (top === 'Groceries') return { title: 'Home Chef', icon: 'storefront' as const, desc: 'You prefer cooking at home. Smart spender!' };
  if (top === 'Rent') return { title: 'Homebody', icon: 'home' as const, desc: 'Home is where the heart is — and most of your money!' };
  return { title: 'Balanced Spender', icon: 'wallet' as const, desc: 'You spend wisely across different categories!' };
};

export default function DashboardScreen() {
  const router = useRouter();
  const { transactions, budgets } = useTransactions();

  const monthOptions = generateMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].key);
  const [selectedDashCat, setSelectedDashCat] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedSubCategory, setExpandedSubCategory] = useState<string | null>(null);
  const currentMonthData = monthOptions.find(m => m.key === selectedMonth)!;

  const filteredTransactions = transactions.filter(t => {
    const tDate = parseInt(t.date);
    return !isNaN(tDate) && tDate >= currentMonthData.start && tDate <= currentMonthData.end;
  });

  const totalSpent = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
  const annotated = filteredTransactions.filter(t => t.category).length;
  const avgPerTransaction = filteredTransactions.length > 0 ? totalSpent / filteredTransactions.length : 0;

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
    legendFontColor: '#6B7280',
    legendFontSize: 11,
  }));

  const personality = getSpendingPersonality(categoryTotals);

  return (
    <ScrollView style={st.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" backgroundColor="#1E1B4B" />

      {/* ── Premium Header ── */}
      <LinearGradient colors={['#1E1B4B', '#312E81']} style={st.header}>
        <View style={st.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
            <Ionicons name="chevron-back" size={20} color="#C4B5FD" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={st.headerTitle}>Dashboard</Text>
            <Text style={st.headerSub}>{MONTHS[currentMonthData.month]} {currentMonthData.year} Overview</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/calendar')} style={st.calBtn}>
            <Ionicons name="calendar" size={18} color="#C4B5FD" />
          </TouchableOpacity>
        </View>

        {/* Summary Stats */}
        <View style={st.summaryRow}>
          <View style={st.summaryCard}>
            <View style={st.summaryIconWrap}><Ionicons name="trending-down" size={16} color="#F87171" /></View>
            <Text style={st.summaryAmount}>₹{totalSpent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
            <Text style={st.summaryLabel}>Total Spent</Text>
          </View>
          <View style={st.summaryCard}>
            <View style={st.summaryIconWrap}><Ionicons name="pricetag" size={16} color="#A78BFA" /></View>
            <Text style={st.summaryAmount}>{annotated}/{filteredTransactions.length}</Text>
            <Text style={st.summaryLabel}>Categorized</Text>
          </View>
          <View style={st.summaryCard}>
            <View style={st.summaryIconWrap}><Ionicons name="trending-up" size={16} color="#34D399" /></View>
            <Text style={st.summaryAmount}>₹{dailyAvg.toFixed(0)}</Text>
            <Text style={st.summaryLabel}>Daily Avg</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Body with rounded top */}
      <View style={st.body}>

        {/* Month Picker */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.monthScroll} style={st.monthWrap}>
          {monthOptions.map((m) => {
            const isSel = m.key === selectedMonth;
            return (
              <TouchableOpacity key={m.key} style={[st.monthChip, isSel && st.monthChipSel]} onPress={() => setSelectedMonth(m.key)}>
                <Text style={[st.monthText, isSel && st.monthTextSel]}>{m.label}</Text>
                <Text style={[st.monthYear, isSel && st.monthYearSel]}>{m.yearLabel}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Extra Stats Row */}
        <View style={st.extraRow}>
          <View style={st.extraCard}>
            <Ionicons name="receipt-outline" size={16} color="#7C3AED" />
            <Text style={st.extraValue}>₹{avgPerTransaction.toFixed(0)}</Text>
            <Text style={st.extraLabel}>Avg/Txn</Text>
          </View>
          <View style={st.extraCard}>
            <Ionicons name="grid-outline" size={16} color="#7C3AED" />
            <Text style={st.extraValue}>{Object.keys(categoryTotals).length}</Text>
            <Text style={st.extraLabel}>Categories</Text>
          </View>
          <View style={st.extraCard}>
            <Ionicons name="calendar-outline" size={16} color="#7C3AED" />
            <Text style={st.extraValue}>{daysElapsed}</Text>
            <Text style={st.extraLabel}>Days</Text>
          </View>
        </View>

        {/* Spending Personality */}
        <LinearGradient colors={['#7C3AED', '#4F46E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.personalityCard}>
          <View style={st.personalityHeader}>
            <View style={st.personalityIconWrap}>
              <Ionicons name={personality.icon} size={24} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.personalityLabel}>{MONTHS[currentMonthData.month]} Spending Personality</Text>
              <Text style={st.personalityTitle}>{personality.title}</Text>
            </View>
          </View>
          <Text style={st.personalityDesc}>{personality.desc}</Text>
        </LinearGradient>

        {/* Pie Chart */}
        {pieData.length > 0 ? (
          <View style={st.chartCard}>
            <View style={st.sectionHeaderRow}>
              <Ionicons name="pie-chart" size={18} color="#6D28D9" />
              <Text style={st.sectionTitle}>Spending by Category</Text>
            </View>
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
          <View style={st.emptyChart}>
            <Ionicons name="pie-chart-outline" size={48} color="#D1D5DB" />
            <Text style={st.emptyChartText}>
              {filteredTransactions.length === 0
                ? `No transactions in ${MONTHS[currentMonthData.month]}`
                : 'Categorize transactions to see chart!'}
            </Text>
          </View>
        )}

        {/* ── Category Breakdown ── */}
        <View style={st.sectionHeaderRow2}>
          <Ionicons name="layers" size={18} color="#6D28D9" />
          <Text style={st.sectionTitle}>Category Breakdown</Text>
          <View style={st.countBadge}><Text style={st.countBadgeText}>{Object.keys(categoryTotals).length}</Text></View>
        </View>
        <Text style={st.sectionHint}>Tap to drill down into subcategories & items</Text>

        {Object.entries(categoryTotals).length === 0 ? (
          <View style={st.emptyBox}>
            <Ionicons name="folder-open-outline" size={40} color="#D1D5DB" />
            <Text style={st.emptyText}>No categories yet</Text>
            <Text style={st.emptySubText}>Go back and categorize your transactions!</Text>
          </View>
        ) : (
          <View style={st.drillContainer}>
            {Object.entries(categoryTotals)
              .sort((a, b) => b[1] - a[1])
              .map(([category, catAmount]) => {
                const catColor = CATEGORY_COLORS[category] || '#95A5A6';
                const catIcon = CATEGORY_ICONS[category] || 'wallet';
                const pct = totalSpent > 0 ? ((catAmount / totalSpent) * 100).toFixed(1) : '0';
                const isExpanded = expandedCategory === category;
                const catTxns = filteredTransactions.filter(t => t.category === category);
                const progressWidth = totalSpent > 0 ? ((catAmount / totalSpent) * 100) : 0;

                const subCatMap: { [sub: string]: { amount: number; count: number; transactions: typeof catTxns } } = {};
                catTxns.forEach(t => {
                  const sub = t.subCategory || t.merchant || 'Other';
                  if (!subCatMap[sub]) subCatMap[sub] = { amount: 0, count: 0, transactions: [] };
                  subCatMap[sub].amount += t.amount;
                  subCatMap[sub].count += 1;
                  subCatMap[sub].transactions.push(t);
                });
                const sortedSubs = Object.entries(subCatMap).sort((a, b) => b[1].amount - a[1].amount);

                return (
                  <View key={category}>
                    <TouchableOpacity
                      style={[st.drillCatRow, isExpanded && { backgroundColor: catColor + '08', borderColor: catColor + '30' }]}
                      onPress={() => { setExpandedCategory(isExpanded ? null : category); setExpandedSubCategory(null); }}
                      activeOpacity={0.7}>
                      <LinearGradient colors={[catColor, catColor + 'CC']} style={st.drillCatIcon}>
                        <Ionicons name={catIcon as any} size={18} color="#fff" />
                      </LinearGradient>
                      <View style={st.drillCatInfo}>
                        <View style={st.drillCatTopRow}>
                          <Text style={st.drillCatName}>{category}</Text>
                          <Text style={[st.drillCatAmount, { color: catColor }]}>₹{catAmount.toFixed(0)}</Text>
                        </View>
                        <View style={st.drillCatBarOuter}>
                          <View style={[st.drillCatBarInner, { width: `${progressWidth}%`, backgroundColor: catColor }]} />
                        </View>
                        <View style={st.drillCatBottomRow}>
                          <Text style={st.drillCatMeta}>{catTxns.length} transaction{catTxns.length !== 1 ? 's' : ''}</Text>
                          <Text style={[st.drillCatPct, { color: catColor }]}>{pct}%</Text>
                        </View>
                      </View>
                      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={catColor} />
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={[st.drillSubContainer, { borderLeftColor: catColor + '40' }]}>
                        {sortedSubs.map(([subName, subData]) => {
                          const isSubExpanded = expandedSubCategory === `${category}-${subName}`;
                          const subPct = catAmount > 0 ? ((subData.amount / catAmount) * 100).toFixed(0) : '0';
                          const subBarWidth = catAmount > 0 ? ((subData.amount / catAmount) * 100) : 0;

                          const itemMap: { [name: string]: { amount: number; count: number; price: number } } = {};
                          subData.transactions.forEach(t => {
                            if (t.items && t.items.length > 0) {
                              t.items.forEach(item => {
                                const key = item.name;
                                if (!itemMap[key]) itemMap[key] = { amount: 0, count: 0, price: item.price };
                                itemMap[key].amount += item.qty * item.price;
                                itemMap[key].count += item.qty;
                                itemMap[key].price = item.price;
                              });
                            } else {
                              const key = t.notes || t.merchant || 'Transaction';
                              if (!itemMap[key]) itemMap[key] = { amount: 0, count: 0, price: 0 };
                              itemMap[key].amount += t.amount;
                              itemMap[key].count += 1;
                            }
                          });
                          const sortedItemEntries = Object.entries(itemMap).sort((a, b) => b[1].amount - a[1].amount);

                          return (
                            <View key={subName}>
                              <TouchableOpacity
                                style={[st.drillSubRow, isSubExpanded && { backgroundColor: catColor + '06' }]}
                                onPress={() => setExpandedSubCategory(isSubExpanded ? null : `${category}-${subName}`)}
                                activeOpacity={0.7}>
                                <View style={[st.drillSubDot, { backgroundColor: catColor }]} />
                                <View style={st.drillSubInfo}>
                                  <View style={st.drillSubTopRow}>
                                    <Text style={st.drillSubName}>{subName}</Text>
                                    <Text style={[st.drillSubAmount, { color: catColor }]}>₹{subData.amount.toFixed(0)}</Text>
                                  </View>
                                  <View style={st.drillSubBarOuter}>
                                    <View style={[st.drillSubBarInner, { width: `${subBarWidth}%`, backgroundColor: catColor + '50' }]} />
                                  </View>
                                  <Text style={st.drillSubMeta}>
                                    {subData.count} transaction{subData.count !== 1 ? 's' : ''} · {subPct}% of {category}
                                  </Text>
                                </View>
                                <Ionicons name={isSubExpanded ? 'chevron-up' : 'chevron-down'} size={12} color={catColor} />
                              </TouchableOpacity>

                              {isSubExpanded && sortedItemEntries.length > 0 && (
                                <View style={[st.drillItemContainer, { borderLeftColor: catColor + '25' }]}>
                                  {sortedItemEntries.map(([itemName, itemData]) => (
                                    <View key={itemName} style={st.drillItemRow}>
                                      <View style={[st.drillItemDot, { backgroundColor: catColor + '60' }]} />
                                      <Text style={st.drillItemName} numberOfLines={1}>{itemName}</Text>
                                      {itemData.price > 0 && (
                                        <Text style={st.drillItemUnit}>₹{itemData.price} × {itemData.count}</Text>
                                      )}
                                      <Text style={[st.drillItemAmount, { color: catColor }]}>₹{itemData.amount.toFixed(0)}</Text>
                                    </View>
                                  ))}
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
          </View>
        )}

        {/* ── Top Merchants ── */}
        <View style={st.sectionHeaderRow2}>
          <Ionicons name="storefront" size={18} color="#6D28D9" />
          <Text style={st.sectionTitle}>Top Merchants</Text>
        </View>
        {filteredTransactions.length === 0 ? (
          <View style={st.emptyBox}>
            <Ionicons name="business-outline" size={40} color="#D1D5DB" />
            <Text style={st.emptyText}>No transactions</Text>
          </View>
        ) : (
          (() => {
            const merchantTotals: { [key: string]: { amount: number; count: number } } = {};
            filteredTransactions.forEach(t => {
              if (!merchantTotals[t.merchant]) merchantTotals[t.merchant] = { amount: 0, count: 0 };
              merchantTotals[t.merchant].amount += t.amount;
              merchantTotals[t.merchant].count += 1;
            });
            const sortedMerchants = Object.entries(merchantTotals).sort((a, b) => b[1].amount - a[1].amount).slice(0, 5);
            const topMerchantAmount = sortedMerchants.length > 0 ? sortedMerchants[0][1].amount : 1;
            return sortedMerchants.map(([merchant, data], idx) => (
              <View key={merchant} style={st.merchantRow}>
                <LinearGradient
                  colors={idx === 0 ? ['#7C3AED', '#6D28D9'] : idx === 1 ? ['#A78BFA', '#7C3AED'] : ['#EDE9FE', '#DDD6FE']}
                  style={st.merchantRank}>
                  <Text style={[st.merchantRankText, idx >= 2 && { color: '#7C3AED' }]}>#{idx + 1}</Text>
                </LinearGradient>
                <View style={st.merchantInfo}>
                  <Text style={st.merchantName}>{merchant}</Text>
                  <View style={st.merchantBarContainer}>
                    <LinearGradient colors={['#7C3AED40', '#7C3AED15']} style={[st.merchantBar, { width: `${(data.amount / topMerchantAmount) * 100}%` }]} />
                  </View>
                  <Text style={st.merchantCount}>{data.count} transaction{data.count > 1 ? 's' : ''}</Text>
                </View>
                <Text style={st.merchantAmount}>₹{data.amount.toFixed(0)}</Text>
              </View>
            ));
          })()
        )}

        {/* ── Product-wise Spending ── */}
        <View style={st.sectionHeaderRow2}>
          <Ionicons name="bag-handle" size={18} color="#6D28D9" />
          <Text style={st.sectionTitle}>Product-wise Spending</Text>
        </View>
        {filteredTransactions.length === 0 ? (
          <View style={st.emptyBox}>
            <Ionicons name="cube-outline" size={40} color="#D1D5DB" />
            <Text style={st.emptyText}>No products tracked yet</Text>
            <Text style={st.emptySubText}>Add items when categorizing to see per-product spending</Text>
          </View>
        ) : (
          (() => {
            const productMap: { [key: string]: { amount: number; count: number; category: string; subCategory: string; pricePerUnit: number } } = {};
            filteredTransactions.forEach(t => {
              if (t.items && t.items.length > 0) {
                t.items.forEach(item => {
                  const key = item.name;
                  if (!productMap[key]) productMap[key] = { amount: 0, count: 0, category: t.category || '', subCategory: t.subCategory || '', pricePerUnit: item.price };
                  productMap[key].amount += item.qty * item.price;
                  productMap[key].count += item.qty;
                  productMap[key].pricePerUnit = item.price;
                });
              } else if (t.splits && t.splits.length > 0) {
                t.splits.forEach(s => {
                  const key = s.description || 'Unnamed item';
                  if (!productMap[key]) productMap[key] = { amount: 0, count: 0, category: s.category, subCategory: '', pricePerUnit: 0 };
                  productMap[key].amount += s.amount;
                  productMap[key].count += 1;
                });
              } else {
                const key = t.merchant;
                if (!productMap[key]) productMap[key] = { amount: 0, count: 0, category: t.category || '', subCategory: t.subCategory || '', pricePerUnit: 0 };
                productMap[key].amount += t.amount;
                productMap[key].count += 1;
              }
            });
            const sortedProducts = Object.entries(productMap).sort((a, b) => b[1].amount - a[1].amount);
            const topProductAmount = sortedProducts.length > 0 ? sortedProducts[0][1].amount : 1;
            return sortedProducts.map(([product, data], idx) => {
              const catColor = CATEGORY_COLORS[data.category] || '#95A5A6';
              const catIcon = CATEGORY_ICONS[data.category] || 'wallet';
              const pctOfTotal = totalSpent > 0 ? ((data.amount / totalSpent) * 100).toFixed(1) : '0';
              const barWidth = topProductAmount > 0 ? ((data.amount / topProductAmount) * 100) : 0;
              return (
                <View key={product} style={st.productRow}>
                  <LinearGradient colors={[catColor + '20', catColor + '08']} style={st.productRank}>
                    <Ionicons name={catIcon as any} size={16} color={catColor} />
                  </LinearGradient>
                  <View style={st.productInfo}>
                    <Text style={st.productName} numberOfLines={1}>{product}</Text>
                    <View style={st.productBarOuter}>
                      <View style={[st.productBarInner, { width: `${barWidth}%`, backgroundColor: catColor + '40' }]} />
                    </View>
                    <View style={st.productMeta}>
                      <View style={[st.productCatBadge, { backgroundColor: catColor + '12' }]}>
                        <Text style={[st.productCatText, { color: catColor }]}>{data.category}</Text>
                      </View>
                      <Text style={st.productCount}>{data.count}×</Text>
                      {data.pricePerUnit > 0 && (
                        <Text style={st.productPerItem}>₹{data.pricePerUnit}/each</Text>
                      )}
                      <Text style={[st.productPct, { color: catColor }]}>{pctOfTotal}%</Text>
                    </View>
                  </View>
                  <Text style={[st.productAmount, { color: catColor }]}>₹{data.amount.toFixed(0)}</Text>
                </View>
              );
            });
          })()
        )}

        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F7FF' },

  // Header
  header: { paddingTop: 52, paddingBottom: 24, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: '#A5B4FC', fontWeight: '500', marginTop: 2 },
  calBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },

  // Summary in header
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 18, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  summaryIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  summaryAmount: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  summaryLabel: { fontSize: 10, color: '#A5B4FC', marginTop: 4, fontWeight: '600' },

  // Body
  body: { backgroundColor: '#F8F7FF', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -1 },

  // Month Picker
  monthWrap: { marginTop: 16 },
  monthScroll: { paddingHorizontal: 16, gap: 8 },
  monthChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#EDE9FE', alignItems: 'center', minWidth: 65 },
  monthChipSel: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  monthText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  monthTextSel: { color: '#FFFFFF' },
  monthYear: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  monthYearSel: { color: 'rgba(255,255,255,0.7)' },

  // Extra stats
  extraRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 14, gap: 10 },
  extraCard: { flex: 1, backgroundColor: '#FFFFFF', padding: 12, borderRadius: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#EDE9FE', gap: 4 },
  extraValue: { fontSize: 16, fontWeight: '800', color: '#1E1B4B' },
  extraLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '600' },

  // Personality
  personalityCard: { marginHorizontal: 20, marginTop: 16, padding: 22, borderRadius: 24, elevation: 8, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12 },
  personalityHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  personalityIconWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  personalityLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  personalityTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },
  personalityDesc: { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 20 },

  // Pie Chart
  chartCard: { backgroundColor: '#FFFFFF', marginHorizontal: 20, marginTop: 16, padding: 20, borderRadius: 24, borderWidth: 1.5, borderColor: '#EDE9FE', elevation: 2 },
  emptyChart: { backgroundColor: '#FFFFFF', marginHorizontal: 20, marginTop: 16, padding: 36, borderRadius: 24, alignItems: 'center', borderWidth: 1.5, borderColor: '#EDE9FE' },
  emptyChartText: { color: '#9CA3AF', fontSize: 14, marginTop: 12, fontWeight: '500' },

  // Section Headers
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionHeaderRow2: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 24, marginBottom: 6, gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1E1B4B', flex: 1 },
  sectionHint: { fontSize: 12, color: '#9CA3AF', marginHorizontal: 20, marginBottom: 12, fontWeight: '500' },
  countBadge: { backgroundColor: '#EDE9FE', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },

  // Empty
  emptyBox: { backgroundColor: '#FFFFFF', marginHorizontal: 20, padding: 30, borderRadius: 24, alignItems: 'center', borderWidth: 1.5, borderColor: '#EDE9FE' },
  emptyText: { color: '#6B7280', fontSize: 15, fontWeight: '700', marginTop: 10 },
  emptySubText: { color: '#9CA3AF', fontSize: 13, marginTop: 4, textAlign: 'center' },

  // Category Drill-down
  drillContainer: { marginHorizontal: 20, gap: 8 },
  drillCatRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 18, borderWidth: 1.5, borderColor: '#F3F4F6', elevation: 2, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, gap: 12 },
  drillCatIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  drillCatInfo: { flex: 1 },
  drillCatTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  drillCatName: { fontSize: 15, fontWeight: '700', color: '#1E1B4B' },
  drillCatAmount: { fontSize: 16, fontWeight: '800' },
  drillCatBarOuter: { height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, marginTop: 8, marginBottom: 6, overflow: 'hidden' },
  drillCatBarInner: { height: 5, borderRadius: 3 },
  drillCatBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  drillCatMeta: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  drillCatPct: { fontSize: 12, fontWeight: '700' },

  // Subcategory
  drillSubContainer: { marginLeft: 22, borderLeftWidth: 2, paddingLeft: 12, marginTop: 4, marginBottom: 4, gap: 4 },
  drillSubRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#F3F4F6', gap: 10, elevation: 1 },
  drillSubDot: { width: 8, height: 8, borderRadius: 4 },
  drillSubInfo: { flex: 1 },
  drillSubTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  drillSubName: { fontSize: 14, fontWeight: '600', color: '#374151' },
  drillSubAmount: { fontSize: 14, fontWeight: '700' },
  drillSubBarOuter: { height: 3, backgroundColor: '#E5E7EB', borderRadius: 2, marginTop: 6, marginBottom: 4, overflow: 'hidden' },
  drillSubBarInner: { height: 3, borderRadius: 2 },
  drillSubMeta: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },

  // Item drill-down
  drillItemContainer: { marginLeft: 28, borderLeftWidth: 2, paddingLeft: 10, marginTop: 2, marginBottom: 4, gap: 2 },
  drillItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#FAFAFA', borderRadius: 12, gap: 8 },
  drillItemDot: { width: 6, height: 6, borderRadius: 3 },
  drillItemName: { flex: 1, fontSize: 13, color: '#4B5563', fontWeight: '500' },
  drillItemUnit: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  drillItemAmount: { fontSize: 13, fontWeight: '700', minWidth: 50, textAlign: 'right' as const },

  // Merchants
  merchantRow: { backgroundColor: '#FFFFFF', marginHorizontal: 20, marginBottom: 10, padding: 15, borderRadius: 18, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#EDE9FE', elevation: 2, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 },
  merchantRank: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  merchantRankText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  merchantInfo: { flex: 1 },
  merchantName: { fontSize: 14, fontWeight: '700', color: '#1E1B4B' },
  merchantBarContainer: { height: 4, backgroundColor: '#F3F4F6', borderRadius: 2, marginTop: 6, marginBottom: 4, overflow: 'hidden' },
  merchantBar: { height: 4, borderRadius: 2 },
  merchantCount: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  merchantAmount: { fontSize: 15, fontWeight: '800', color: '#EF4444' },

  // Products
  productRow: { backgroundColor: '#FFFFFF', marginHorizontal: 20, marginBottom: 10, padding: 15, borderRadius: 18, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#EDE9FE', elevation: 2, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 },
  productRank: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: '700', color: '#1E1B4B' },
  productBarOuter: { height: 4, backgroundColor: '#F3F4F6', borderRadius: 2, marginTop: 6, marginBottom: 4, overflow: 'hidden' },
  productBarInner: { height: 4, borderRadius: 2 },
  productMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  productCatBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  productCatText: { fontSize: 10, fontWeight: '700' },
  productCount: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  productPerItem: { fontSize: 11, color: '#7C3AED', fontWeight: '600' },
  productPct: { fontSize: 11, fontWeight: '700' },
  productAmount: { fontSize: 16, fontWeight: '800' },
});