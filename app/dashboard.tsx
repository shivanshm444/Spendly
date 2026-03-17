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
  Snacks: '#F97316',
  Dairy: '#60A5FA',
};

const CATEGORY_EMOJIS: { [key: string]: string } = {
  Food: '🍕', Shopping: '🛒', Travel: '✈️', Fuel: '⛽',
  Entertainment: '🎬', Groceries: '🏪', Health: '💊',
  Rent: '🏠', Education: '📚', Other: '💳',
  Snacks: '🍟', Dairy: '🥛',
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
  const { transactions, budgets } = useTransactions();

  const monthOptions = generateMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].key);
  const [selectedDashCat, setSelectedDashCat] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedSubCategory, setExpandedSubCategory] = useState<string | null>(null);
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

      {/* ── Predictive Budget Forecast ─────────────────── */}
      {isCurrentMonth && Object.keys(budgets).length > 0 && (() => {
        const daysInMonth = new Date(currentMonthData.year, currentMonthData.month + 1, 0).getDate();
        const daysLeft = daysInMonth - daysElapsed;

        // Build forecast for each budgeted category
        const forecasts = Object.entries(budgets)
          .map(([cat, budgetStr]) => {
            const budget = parseFloat(budgetStr);
            if (!budget || budget <= 0) return null;
            const spent = categoryTotals[cat] || 0;
            const dailyBurn = daysElapsed > 0 ? spent / daysElapsed : 0;
            const predicted = spent + (dailyBurn * daysLeft);
            const pctUsed = (spent / budget) * 100;
            const pctPredicted = (predicted / budget) * 100;
            const overshoot = predicted - budget;
            const safeDailyLimit = daysLeft > 0 ? (budget - spent) / daysLeft : 0;

            let status: 'safe' | 'warning' | 'danger';
            if (pctPredicted <= 80) status = 'safe';
            else if (pctPredicted <= 100) status = 'warning';
            else status = 'danger';

            return {
              cat, budget, spent, dailyBurn, predicted, pctUsed, pctPredicted,
              overshoot, safeDailyLimit, status,
              emoji: CATEGORY_EMOJIS[cat] || '💳',
              color: CATEGORY_COLORS[cat] || '#95A5A6',
            };
          })
          .filter(Boolean) as Array<{
            cat: string; budget: number; spent: number; dailyBurn: number;
            predicted: number; pctUsed: number; pctPredicted: number;
            overshoot: number; safeDailyLimit: number; status: 'safe' | 'warning' | 'danger';
            emoji: string; color: string;
          }>;

        if (forecasts.length === 0) return null;

        const dangerCount = forecasts.filter(f => f.status === 'danger').length;
        const warningCount = forecasts.filter(f => f.status === 'warning').length;

        return (
          <View style={styles.forecastSection}>
            <View style={styles.forecastHeader}>
              <Text style={styles.forecastHeaderIcon}>🔮</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.forecastHeaderTitle}>Budget Forecast</Text>
                <Text style={styles.forecastHeaderSub}>
                  {dangerCount > 0
                    ? `⚠️ ${dangerCount} categor${dangerCount > 1 ? 'ies' : 'y'} will exceed budget!`
                    : warningCount > 0
                      ? `${warningCount} categor${warningCount > 1 ? 'ies' : 'y'} approaching limit`
                      : '✅ All budgets looking healthy!'}
                </Text>
              </View>
              <Text style={styles.forecastDaysLeft}>{daysLeft}d left</Text>
            </View>

            {forecasts
              .sort((a, b) => b.pctPredicted - a.pctPredicted)
              .map(f => {
                const statusColors = {
                  safe: { bg: '#ECFDF5', border: '#A7F3D0', text: '#059669', icon: '✅' },
                  warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#D97706', icon: '⚠️' },
                  danger: { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626', icon: '🚨' },
                };
                const sc = statusColors[f.status];
                const barPct = Math.min(f.pctUsed, 100);
                const predictedBarPct = Math.min(f.pctPredicted, 100);

                return (
                  <View key={f.cat} style={[styles.forecastCard, { backgroundColor: sc.bg, borderColor: sc.border }]}>
                    <View style={styles.forecastCardTop}>
                      <Text style={styles.forecastCardEmoji}>{f.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.forecastCardName}>{f.cat}</Text>
                        <Text style={[styles.forecastCardStatus, { color: sc.text }]}>
                          {f.status === 'danger'
                            ? `Will exceed by ₹${f.overshoot.toFixed(0)}`
                            : f.status === 'warning'
                              ? `Approaching limit — ${f.pctPredicted.toFixed(0)}% predicted`
                              : `On track — ${f.pctPredicted.toFixed(0)}% predicted`}
                        </Text>
                      </View>
                      <Text style={styles.forecastStatusIcon}>{sc.icon}</Text>
                    </View>

                    {/* Dual progress bar: current (solid) + predicted (striped/translucent) */}
                    <View style={styles.forecastBarOuter}>
                      <View style={[styles.forecastBarCurrent, { width: `${barPct}%`, backgroundColor: f.color }]} />
                      <View style={[styles.forecastBarPredicted, { width: `${predictedBarPct}%`, backgroundColor: f.color + '25', borderColor: f.color + '40' }]} />
                    </View>
                    <View style={styles.forecastBarLabels}>
                      <Text style={styles.forecastBarLabel}>₹{f.spent.toFixed(0)} spent</Text>
                      <Text style={[styles.forecastBarLabel, { color: sc.text }]}>₹{f.budget.toFixed(0)} budget</Text>
                    </View>

                    {/* Actionable advice */}
                    <View style={[styles.forecastAdvice, { backgroundColor: sc.border + '40' }]}>
                      <Text style={[styles.forecastAdviceText, { color: sc.text }]}>
                        {f.status === 'danger'
                          ? `💡 Limit daily ${f.cat} spend to ₹${Math.max(0, f.safeDailyLimit).toFixed(0)} to stay on budget`
                          : f.status === 'warning'
                            ? `💡 Safe daily limit: ₹${f.safeDailyLimit.toFixed(0)} for remaining ${daysLeft} days`
                            : `💡 You can spend ₹${f.safeDailyLimit.toFixed(0)}/day and stay within budget`}
                      </Text>
                    </View>
                  </View>
                );
              })}
          </View>
        );
      })()}


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

      {/* Category Breakdown — Tap to drill down */}
      <Text style={styles.sectionTitle}>📊 Category Breakdown</Text>
      <Text style={styles.sectionHint}>Tap a category to drill down into subcategories & items</Text>
      {Object.entries(categoryTotals).length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No categories yet</Text>
          <Text style={styles.emptySubText}>Go back and categorize your transactions!</Text>
        </View>
      ) : (
        <View style={styles.drillDownContainer}>
          {Object.entries(categoryTotals)
            .sort((a, b) => b[1] - a[1])
            .map(([category, catAmount]) => {
              const catColor = CATEGORY_COLORS[category] || '#95A5A6';
              const catEmoji = CATEGORY_EMOJIS[category] || '💳';
              const pct = totalSpent > 0 ? ((catAmount / totalSpent) * 100).toFixed(1) : '0';
              const isExpanded = expandedCategory === category;
              const catTxns = filteredTransactions.filter(t => t.category === category);
              const progressWidth = totalSpent > 0 ? ((catAmount / totalSpent) * 100) : 0;

              // Build subcategory grouping
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
                  {/* Category Row */}
                  <TouchableOpacity
                    style={[styles.drillCatRow, isExpanded && { backgroundColor: catColor + '08', borderColor: catColor + '30' }]}
                    onPress={() => {
                      setExpandedCategory(isExpanded ? null : category);
                      setExpandedSubCategory(null);
                    }}
                    activeOpacity={0.7}>
                    <Text style={styles.drillCatEmoji}>{catEmoji}</Text>
                    <View style={styles.drillCatInfo}>
                      <View style={styles.drillCatTopRow}>
                        <Text style={styles.drillCatName}>{category}</Text>
                        <Text style={[styles.drillCatAmount, { color: catColor }]}>₹{catAmount.toFixed(0)}</Text>
                      </View>
                      <View style={styles.drillCatBarOuter}>
                        <View style={[styles.drillCatBarInner, { width: `${progressWidth}%`, backgroundColor: catColor }]} />
                      </View>
                      <View style={styles.drillCatBottomRow}>
                        <Text style={styles.drillCatMeta}>{catTxns.length} transaction{catTxns.length !== 1 ? 's' : ''}</Text>
                        <Text style={[styles.drillCatPct, { color: catColor }]}>{pct}%</Text>
                      </View>
                    </View>
                    <Text style={[styles.drillArrow, { color: catColor }]}>{isExpanded ? '▲' : '▼'}</Text>
                  </TouchableOpacity>

                  {/* Expanded Subcategories */}
                  {isExpanded && (
                    <View style={[styles.drillSubContainer, { borderLeftColor: catColor + '40' }]}>
                      {sortedSubs.map(([subName, subData]) => {
                        const isSubExpanded = expandedSubCategory === `${category}-${subName}`;
                        const subPct = catAmount > 0 ? ((subData.amount / catAmount) * 100).toFixed(0) : '0';
                        const subBarWidth = catAmount > 0 ? ((subData.amount / catAmount) * 100) : 0;

                        // Gather individual items from transactions in this subcategory
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
                            // No items — show merchant or notes as the item
                            const key = t.notes || t.merchant || 'Transaction';
                            if (!itemMap[key]) itemMap[key] = { amount: 0, count: 0, price: 0 };
                            itemMap[key].amount += t.amount;
                            itemMap[key].count += 1;
                          }
                        });
                        const sortedItemEntries = Object.entries(itemMap).sort((a, b) => b[1].amount - a[1].amount);

                        return (
                          <View key={subName}>
                            {/* Subcategory Row */}
                            <TouchableOpacity
                              style={[styles.drillSubRow, isSubExpanded && { backgroundColor: catColor + '06' }]}
                              onPress={() => setExpandedSubCategory(isSubExpanded ? null : `${category}-${subName}`)}
                              activeOpacity={0.7}>
                              <View style={[styles.drillSubDot, { backgroundColor: catColor }]} />
                              <View style={styles.drillSubInfo}>
                                <View style={styles.drillSubTopRow}>
                                  <Text style={styles.drillSubName}>{subName}</Text>
                                  <Text style={[styles.drillSubAmount, { color: catColor }]}>₹{subData.amount.toFixed(0)}</Text>
                                </View>
                                <View style={styles.drillSubBarOuter}>
                                  <View style={[styles.drillSubBarInner, { width: `${subBarWidth}%`, backgroundColor: catColor + '50' }]} />
                                </View>
                                <Text style={styles.drillSubMeta}>
                                  {subData.count} transaction{subData.count !== 1 ? 's' : ''} · {subPct}% of {category}
                                </Text>
                              </View>
                              <Text style={[styles.drillArrowSmall, { color: catColor }]}>{isSubExpanded ? '▲' : '▼'}</Text>
                            </TouchableOpacity>

                            {/* Expanded Individual Items */}
                            {isSubExpanded && sortedItemEntries.length > 0 && (
                              <View style={[styles.drillItemContainer, { borderLeftColor: catColor + '25' }]}>
                                {sortedItemEntries.map(([itemName, itemData]) => (
                                  <View key={itemName} style={styles.drillItemRow}>
                                    <View style={[styles.drillItemDot, { backgroundColor: catColor + '60' }]} />
                                    <Text style={styles.drillItemName} numberOfLines={1}>{itemName}</Text>
                                    {itemData.price > 0 && (
                                      <Text style={styles.drillItemUnit}>₹{itemData.price} × {itemData.count}</Text>
                                    )}
                                    <Text style={[styles.drillItemAmount, { color: catColor }]}>₹{itemData.amount.toFixed(0)}</Text>
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

      {/* Top Merchants */}
      <Text style={styles.sectionTitle}>🏪 Top Merchants</Text>
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
          const sortedMerchants = Object.entries(merchantTotals).sort((a, b) => b[1].amount - a[1].amount).slice(0, 5);
          const topMerchantAmount = sortedMerchants.length > 0 ? sortedMerchants[0][1].amount : 1;
          return sortedMerchants.map(([merchant, data], idx) => (
            <View key={merchant} style={styles.merchantRow}>
              <View style={styles.merchantRank}>
                <Text style={styles.merchantRankText}>{idx + 1}</Text>
              </View>
              <View style={styles.merchantInfo}>
                <Text style={styles.merchantName}>{merchant}</Text>
                <View style={styles.merchantBarContainer}>
                  <View style={[styles.merchantBar, { width: `${(data.amount / topMerchantAmount) * 100}%` }]} />
                </View>
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
          <Text style={styles.emptySubText}>Add items when categorizing to see per-product spending</Text>
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
            const catEmoji = CATEGORY_EMOJIS[data.category] || '💳';
            const pctOfTotal = totalSpent > 0 ? ((data.amount / totalSpent) * 100).toFixed(1) : '0';
            const barWidth = topProductAmount > 0 ? ((data.amount / topProductAmount) * 100) : 0;
            return (
              <View key={product} style={styles.productRow}>
                <View style={[styles.productRank, { backgroundColor: catColor + '15' }]}>
                  <Text style={[styles.productRankText, { color: catColor }]}>{idx + 1}</Text>
                </View>
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={1}>{product}</Text>
                  <View style={styles.productBarOuter}>
                    <View style={[styles.productBarInner, { width: `${barWidth}%`, backgroundColor: catColor + '40' }]} />
                  </View>
                  <View style={styles.productMeta}>
                    <View style={[styles.productCatBadge, { backgroundColor: catColor + '15' }]}>
                      <Text style={[styles.productCatText, { color: catColor }]}>{catEmoji} {data.category}</Text>
                    </View>
                    <Text style={styles.productCount}>{data.count}×</Text>
                    {data.pricePerUnit > 0 && (
                      <Text style={styles.productPerItem}>₹{data.pricePerUnit}/each</Text>
                    )}
                    <Text style={[styles.productPct, { color: catColor }]}>{pctOfTotal}%</Text>
                  </View>
                </View>
                <Text style={[styles.productAmount, { color: catColor }]}>₹{data.amount.toFixed(0)}</Text>
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

  // Predictive Budget Forecast
  forecastSection: { marginHorizontal: 20, marginTop: 10, marginBottom: 10, gap: 10 },
  forecastHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: '#E9D5FF', gap: 10, elevation: 2 },
  forecastHeaderIcon: { fontSize: 28 },
  forecastHeaderTitle: { fontSize: 16, fontWeight: 'bold', color: '#7C3AED' },
  forecastHeaderSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  forecastDaysLeft: { fontSize: 12, fontWeight: 'bold', color: '#7C3AED', backgroundColor: '#F5F3FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  forecastCard: { padding: 14, borderRadius: 16, borderWidth: 1.5, gap: 8 },
  forecastCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  forecastCardEmoji: { fontSize: 24 },
  forecastCardName: { fontSize: 14, fontWeight: 'bold', color: '#1A1A1A' },
  forecastCardStatus: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  forecastStatusIcon: { fontSize: 20 },
  forecastBarOuter: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', position: 'relative' as const },
  forecastBarCurrent: { height: 8, borderRadius: 4, position: 'absolute' as const, left: 0, top: 0, zIndex: 2 },
  forecastBarPredicted: { height: 8, borderRadius: 4, position: 'absolute' as const, left: 0, top: 0, zIndex: 1, borderWidth: 1, borderStyle: 'dashed' as const },
  forecastBarLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  forecastBarLabel: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  forecastAdvice: { padding: 8, borderRadius: 10 },
  forecastAdviceText: { fontSize: 11, fontWeight: '600', textAlign: 'center' as const },

  chartCard: { backgroundColor: '#FFFFFF', marginHorizontal: 20, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#F3F4F6', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  chartTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 10 },
  emptyChart: { backgroundColor: '#FFFFFF', marginHorizontal: 20, padding: 30, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  emptyChartEmoji: { fontSize: 40, marginBottom: 10 },
  emptyChartText: { color: '#9CA3AF', fontSize: 14 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginHorizontal: 20, marginTop: 25, marginBottom: 8, color: '#1A1A1A' },
  sectionHint: { fontSize: 12, color: '#9CA3AF', marginHorizontal: 20, marginBottom: 12 },
  emptyBox: { backgroundColor: '#FFFFFF', marginHorizontal: 20, padding: 30, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  emptyText: { color: '#6B7280', fontSize: 16, fontWeight: 'bold' },
  emptySubText: { color: '#9CA3AF', fontSize: 13, marginTop: 5 },

  // Drill-down category breakdown
  drillDownContainer: { marginHorizontal: 20, gap: 8 },
  drillCatRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: '#F3F4F6', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, gap: 12 },
  drillCatEmoji: { fontSize: 28 },
  drillCatInfo: { flex: 1 },
  drillCatTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  drillCatName: { fontSize: 15, fontWeight: 'bold', color: '#1A1A1A' },
  drillCatAmount: { fontSize: 16, fontWeight: 'bold' },
  drillCatBarOuter: { height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, marginTop: 8, marginBottom: 6, overflow: 'hidden' },
  drillCatBarInner: { height: 4, borderRadius: 2 },
  drillCatBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  drillCatMeta: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  drillCatPct: { fontSize: 12, fontWeight: 'bold' },
  drillArrow: { fontSize: 14, fontWeight: 'bold' },

  // Subcategory drill-down
  drillSubContainer: { marginLeft: 20, borderLeftWidth: 2, paddingLeft: 12, marginTop: 4, marginBottom: 4, gap: 4 },
  drillSubRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6', gap: 10, elevation: 1 },
  drillSubDot: { width: 8, height: 8, borderRadius: 4 },
  drillSubInfo: { flex: 1 },
  drillSubTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  drillSubName: { fontSize: 14, fontWeight: '600', color: '#374151' },
  drillSubAmount: { fontSize: 14, fontWeight: 'bold' },
  drillSubBarOuter: { height: 3, backgroundColor: '#E5E7EB', borderRadius: 2, marginTop: 6, marginBottom: 4, overflow: 'hidden' },
  drillSubBarInner: { height: 3, borderRadius: 2 },
  drillSubMeta: { fontSize: 11, color: '#9CA3AF' },
  drillArrowSmall: { fontSize: 11, fontWeight: 'bold' },

  // Individual item drill-down
  drillItemContainer: { marginLeft: 28, borderLeftWidth: 2, paddingLeft: 10, marginTop: 2, marginBottom: 4, gap: 2 },
  drillItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#FAFAFA', borderRadius: 10, gap: 8 },
  drillItemDot: { width: 6, height: 6, borderRadius: 3 },
  drillItemName: { flex: 1, fontSize: 13, color: '#4B5563', fontWeight: '500' },
  drillItemUnit: { fontSize: 11, color: '#9CA3AF' },
  drillItemAmount: { fontSize: 13, fontWeight: 'bold', minWidth: 50, textAlign: 'right' },

  // Top Merchants
  merchantRow: { backgroundColor: '#FFFFFF', marginHorizontal: 20, marginBottom: 10, padding: 15, borderRadius: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  merchantRank: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  merchantRankText: { fontSize: 14, fontWeight: 'bold', color: '#7C3AED' },
  merchantInfo: { flex: 1 },
  merchantName: { fontSize: 14, fontWeight: 'bold', color: '#1A1A1A' },
  merchantBarContainer: { height: 4, backgroundColor: '#F3F4F6', borderRadius: 2, marginTop: 6, marginBottom: 4, overflow: 'hidden' },
  merchantBar: { height: 4, borderRadius: 2, backgroundColor: '#7C3AED40' },
  merchantCount: { fontSize: 11, color: '#9CA3AF', marginTop: 0 },
  merchantAmount: { fontSize: 14, fontWeight: 'bold', color: '#EF4444' },

  // Product-wise Spending
  productRow: { backgroundColor: '#FFFFFF', marginHorizontal: 20, marginBottom: 10, padding: 15, borderRadius: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  productRank: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  productRankText: { fontSize: 15, fontWeight: 'bold' },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: 'bold', color: '#1A1A1A' },
  productBarOuter: { height: 4, backgroundColor: '#F3F4F6', borderRadius: 2, marginTop: 6, marginBottom: 4, overflow: 'hidden' },
  productBarInner: { height: 4, borderRadius: 2 },
  productMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  productCatBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  productCatText: { fontSize: 10, fontWeight: '700' },
  productCount: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  productPerItem: { fontSize: 11, color: '#7C3AED', fontWeight: '600' },
  productPct: { fontSize: 11, fontWeight: 'bold' },
  productAmount: { fontSize: 15, fontWeight: 'bold' },
});