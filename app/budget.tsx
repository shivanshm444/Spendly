import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTransactions } from '../context/TransactionContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const CATEGORIES = [
  { name: 'Food', emoji: '🍕', color: '#FF6B6B' },
  { name: 'Shopping', emoji: '🛒', color: '#4ECDC4' },
  { name: 'Travel', emoji: '✈️', color: '#45B7D1' },
  { name: 'Fuel', emoji: '⛽', color: '#F39C12' },
  { name: 'Entertainment', emoji: '🎬', color: '#9B59B6' },
  { name: 'Groceries', emoji: '🏪', color: '#2ECC71' },
  { name: 'Health', emoji: '💊', color: '#E74C3C' },
  { name: 'Rent', emoji: '🏠', color: '#3498DB' },
  { name: 'Education', emoji: '📚', color: '#1ABC9C' },
  { name: 'Other', emoji: '💳', color: '#95A5A6' },
];

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

const getPrediction = (spent: number, budget: number) => {
  if (spent === 0 || budget === 0) return null;
  const today = new Date();
  const daysPassed = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - daysPassed;
  if (daysPassed === 0) return null;
  const dailyAvg = spent / daysPassed;
  const projectedTotal = dailyAvg * daysInMonth;
  const overspend = projectedTotal - budget;
  const daysUntilBudgetFinished = budget / dailyAvg;
  return {
    projectedTotal,
    overspend,
    dailyAvg,
    daysRemaining,
    daysUntilBudgetFinished,
    daysPassed,
    daysInMonth
  };
};

export default function BudgetScreen() {
  const router = useRouter();
  const { transactions, budgets, setBudgets } = useTransactions();
  const [editing, setEditing] = useState<string | null>(null);
  const [tempBudgets, setTempBudgets] = useState<{ [key: string]: string }>({});

  const monthOptions = generateMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].key);
  const currentMonthData = monthOptions.find(m => m.key === selectedMonth)!;

  useEffect(() => {
    registerForNotifications();
    setTempBudgets({ ...budgets });
  }, []);

  const registerForNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow notifications for budget alerts!');
    }
  };

  const sendNotification = async (title: string, body: string) => {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  };

  // Filter transactions to selected month
  const filteredTransactionsMonth = transactions.filter(t => {
    const tDate = parseInt(t.date);
    return !isNaN(tDate) && tDate >= currentMonthData.start && tDate <= currentMonthData.end;
  });

  const getCategorySpent = (category: string) => {
    return filteredTransactionsMonth
      .filter(t => t.category === category)
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const getProgressColor = (spent: number, budget: number) => {
    const percent = (spent / budget) * 100;
    if (percent >= 100) return '#FF6B6B';
    if (percent >= 90) return '#F39C12';
    return '#2ECC71';
  };

  const getProgressPercent = (spent: number, budget: number) => {
    return Math.min((spent / budget) * 100, 100);
  };

  const handleSaveBudget = async (category: string) => {
    const budget = parseFloat(tempBudgets[category] || '0');
    if (!budget || budget <= 0) {
      Alert.alert('❌ Invalid', 'Please enter a valid budget amount!');
      return;
    }
    const updatedBudgets = { ...budgets, [category]: String(budget) };
    setBudgets(updatedBudgets);
    const spent = getCategorySpent(category);
    const percent = (spent / budget) * 100;
    if (percent >= 100) {
      Alert.alert('🚨 Over Budget!', `You exceeded your ${category} budget!\n\nSpent: ₹${spent.toFixed(0)}\nBudget: ₹${budget.toFixed(0)}`);
      await sendNotification('🚨 Over Budget!', `You exceeded your ${category} budget! Spent ₹${spent.toFixed(0)} of ₹${budget.toFixed(0)}`);
    } else if (percent >= 90) {
      Alert.alert('⚠️ 90% Alert!', `You used ${percent.toFixed(0)}% of your ${category} budget!\n\nRemaining: ₹${(budget - spent).toFixed(0)}`);
      await sendNotification('⚠️ Budget Warning!', `You used ${percent.toFixed(0)}% of your ${category} budget! Only ₹${(budget - spent).toFixed(0)} remaining.`);
    } else {
      Alert.alert('✅ Budget Set!', `${category} budget set to ₹${budget.toFixed(0)}\n\nRemaining: ₹${(budget - spent).toFixed(0)}`);
      await sendNotification('✅ Budget Set!', `Your ${category} budget is set to ₹${budget.toFixed(0)}`);
    }
    const prediction = getPrediction(spent, budget);
    if (prediction && prediction.overspend > 0) {
      await sendNotification(
        '🔮 Spending Prediction!',
        `At this rate you'll overspend on ${category} by ₹${prediction.overspend.toFixed(0)} this month!`
      );
    }
    setEditing(null);
  };

  const totalBudget = parseFloat(budgets['_total'] || '0');
  const sumOfCategoryBudgets = Object.entries(budgets)
    .filter(([key]) => key !== '_total')
    .reduce((sum, [_, b]) => sum + (parseFloat(b) || 0), 0);

  const totalSpent = filteredTransactionsMonth.reduce((sum, t) => sum + t.amount, 0);
  const remainingTotal = totalBudget > 0 ? totalBudget - totalSpent : sumOfCategoryBudgets - totalSpent;

  const hasPredictions = CATEGORIES.some(cat => {
    const spent = getCategorySpent(cat.name);
    const budget = parseFloat(budgets[cat.name] || '0');
    return getPrediction(spent, budget) !== null;
  });

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />

      <LinearGradient colors={['#1a0533', '#0A0A0F']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Budget Alerts 🎯</Text>
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

      <LinearGradient
        colors={['#7C3AED', '#4F46E5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.totalCard}>
        <View style={styles.totalRow}>
          <View>
            <Text style={styles.totalLabel}>{totalBudget > 0 ? 'Monthly Limit' : 'Total Budget'}</Text>
            <Text style={styles.totalAmount}>₹{(totalBudget > 0 ? totalBudget : sumOfCategoryBudgets).toFixed(0)}</Text>
          </View>
          <View style={styles.divider} />
          <View>
            <Text style={styles.totalLabel}>Total Spent</Text>
            <Text style={styles.totalAmount}>₹{totalSpent.toFixed(0)}</Text>
          </View>
          <View style={styles.divider} />
          <View>
            <Text style={styles.totalLabel}>Remaining</Text>
            <Text style={[styles.totalAmount, { color: remainingTotal < 0 ? '#FF6B6B' : '#2ECC71' }]}>
              ₹{remainingTotal.toFixed(0)}
            </Text>
          </View>
        </View>

        {totalBudget > 0 && (
          <View style={styles.overallProgressContainer}>
            <View style={styles.overallProgressBar}>
              <View style={[styles.overallProgressFill, {
                width: `${Math.min((totalSpent / totalBudget) * 100, 100)}%`,
                backgroundColor: (totalSpent / totalBudget) >= 1 ? '#FF6B6B' : (totalSpent / totalBudget) >= 0.9 ? '#F39C12' : '#2ECC71'
              }]} />
            </View>
            <Text style={styles.overallProgressText}>
              {((totalSpent / totalBudget) * 100).toFixed(0)}% of monthly limit used
            </Text>
          </View>
        )}
      </LinearGradient>

      {/* Set Monthly Limit Section */}
      <View style={styles.budgetCard}>
        <View style={styles.budgetHeader}>
          <View style={styles.budgetLeft}>
            <View style={[styles.categoryDot, { backgroundColor: '#7C3AED30' }]}>
              <Text style={styles.categoryEmoji}>💰</Text>
            </View>
            <View>
              <Text style={styles.categoryName}>Overall Monthly Limit</Text>
              <Text style={styles.spentText}>
                {totalBudget > 0 ? `Limit set to ₹${totalBudget.toFixed(0)}` : 'Set a global limit for the month'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => {
              setTempBudgets({ ...tempBudgets, ['_total']: budgets['_total'] || '' });
              setEditing(editing === '_total' ? null : '_total');
            }}>
            <Text style={styles.editButtonText}>
              {editing === '_total' ? 'Cancel' : totalBudget > 0 ? 'Edit' : 'Set'}
            </Text>
          </TouchableOpacity>
        </View>
        {editing === '_total' && (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.budgetInput}
              placeholder="Enter monthly limit"
              placeholderTextColor="#444"
              keyboardType="numeric"
              value={tempBudgets['_total'] || ''}
              onChangeText={(val) => setTempBudgets({ ...tempBudgets, ['_total']: val })}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveBudget('_total')}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Predictions Section */}
      {hasPredictions && (
        <View style={styles.predictionsSection}>
          <Text style={styles.sectionTitle}>🔮 Spending Predictions</Text>
          {CATEGORIES.map(cat => {
            const spent = getCategorySpent(cat.name);
            const budget = parseFloat(budgets[cat.name] || '0');
            const prediction = getPrediction(spent, budget);
            if (!prediction) return null;
            return (
              <View key={cat.name} style={styles.predictionCard}>
                <Text style={styles.predictionEmoji}>{cat.emoji}</Text>
                <View style={styles.predictionText}>
                  <Text style={styles.predictionTitle}>{cat.name} — End of Month</Text>
                  <Text style={styles.predictionAmount}>
                    📅 Projected: ₹{prediction.projectedTotal.toFixed(0)}
                  </Text>
                  <Text style={[styles.predictionStatus, { color: prediction.overspend > 0 ? '#FF6B6B' : '#2ECC71' }]}>
                    {prediction.overspend > 0
                      ? `⚠️ Will exceed by ₹${prediction.overspend.toFixed(0)}`
                      : `✅ Will save ₹${Math.abs(prediction.overspend).toFixed(0)}`}
                  </Text>
                  <Text style={styles.predictionSub}>
                    📊 Daily avg: ₹{prediction.dailyAvg.toFixed(0)} | {prediction.daysRemaining} days left
                  </Text>
                  {prediction.daysUntilBudgetFinished < prediction.daysInMonth && (
                    <Text style={styles.predictionWarning}>
                      🚨 Budget runs out in {Math.max(0, prediction.daysUntilBudgetFinished - prediction.daysPassed).toFixed(0)} days!
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.sectionTitle}>Set Category Budgets</Text>

      {CATEGORIES.map((cat) => {
        const spent = getCategorySpent(cat.name);
        const budget = parseFloat(budgets[cat.name] || '0');
        const hasbudget = budget > 0;
        const progressPercent = hasbudget ? getProgressPercent(spent, budget) : 0;
        const progressColor = hasbudget ? getProgressColor(spent, budget) : '#333';

        return (
          <View key={cat.name} style={styles.budgetCard}>
            <View style={styles.budgetHeader}>
              <View style={styles.budgetLeft}>
                <View style={[styles.categoryDot, { backgroundColor: cat.color + '30' }]}>
                  <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                </View>
                <View>
                  <Text style={styles.categoryName}>{cat.name}</Text>
                  <Text style={styles.spentText}>
                    Spent: ₹{spent.toFixed(0)}{hasbudget ? ` / ₹${budget.toFixed(0)}` : ''}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => {
                  setTempBudgets({ ...tempBudgets, [cat.name]: budgets[cat.name] || '' });
                  setEditing(editing === cat.name ? null : cat.name);
                }}>
                <Text style={styles.editButtonText}>
                  {editing === cat.name ? 'Cancel' : hasbudget ? 'Edit' : 'Set'}
                </Text>
              </TouchableOpacity>
            </View>

            {editing === cat.name && (
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.budgetInput}
                  placeholder="Enter budget amount"
                  placeholderTextColor="#444"
                  keyboardType="numeric"
                  value={tempBudgets[cat.name] || ''}
                  onChangeText={(val) => setTempBudgets({ ...tempBudgets, [cat.name]: val })}
                />
                <TouchableOpacity style={styles.saveBtn} onPress={() => handleSaveBudget(cat.name)}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            )}

            {hasbudget && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, {
                    width: `${progressPercent}%`,
                    backgroundColor: progressColor
                  }]} />
                </View>
                <View style={styles.progressLabels}>
                  <Text style={styles.progressText}>{progressPercent.toFixed(0)}% used</Text>
                  <Text style={styles.budgetText}>Budget: ₹{budget.toFixed(0)}</Text>
                </View>
                {progressPercent >= 90 && (
                  <View style={styles.alertBadge}>
                    <Text style={styles.alertText}>
                      {progressPercent >= 100 ? '🚨 Over Budget!' : '⚠️ Almost at limit!'}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: {
    padding: 20,
    paddingTop: 55,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: { marginRight: 15 },
  backText: { color: '#7C3AED', fontSize: 16, fontWeight: 'bold' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: 'white' },

  // Month Picker
  monthPickerContainer: { marginTop: 10, marginBottom: 15 },
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
  monthChipSelected: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  monthChipText: { fontSize: 14, fontWeight: 'bold', color: '#888' },
  monthChipTextSelected: { color: 'white' },
  monthChipYear: { fontSize: 10, color: '#555', marginTop: 1 },
  monthChipYearSelected: { color: 'rgba(255,255,255,0.7)' },

  totalCard: {
    marginHorizontal: 20,
    padding: 22,
    borderRadius: 24,
    elevation: 10,
    marginBottom: 5,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  totalAmount: { fontSize: 18, fontWeight: 'bold', color: 'white', textAlign: 'center', marginTop: 4 },
  divider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)' },

  overallProgressContainer: { marginTop: 20 },
  overallProgressBar: { height: 8, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 4, overflow: 'hidden' },
  overallProgressFill: { height: 8, borderRadius: 4 },
  overallProgressText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 6, textAlign: 'center' },

  predictionsSection: { marginTop: 20 },
  predictionCard: {
    backgroundColor: '#1a0a0a',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 15,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#FF6B6B30',
  },
  predictionEmoji: { fontSize: 28, marginRight: 12, marginTop: 2 },
  predictionText: { flex: 1 },
  predictionTitle: { fontSize: 13, color: '#888', fontWeight: 'bold' },
  predictionAmount: { fontSize: 15, fontWeight: 'bold', color: 'white', marginTop: 4 },
  predictionStatus: { fontSize: 13, fontWeight: 'bold', marginTop: 4 },
  predictionSub: { fontSize: 11, color: '#555', marginTop: 4 },
  predictionWarning: { fontSize: 12, color: '#FF6B6B', marginTop: 4, fontWeight: 'bold' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 20,
    marginTop: 25,
    marginBottom: 12,
    color: 'white',
  },
  budgetCard: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ffffff08',
  },
  budgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  categoryDot: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryEmoji: { fontSize: 22 },
  categoryName: { fontSize: 15, fontWeight: 'bold', color: 'white' },
  spentText: { fontSize: 12, color: '#555', marginTop: 2 },
  editButton: {
    backgroundColor: '#7C3AED20',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7C3AED50',
  },
  editButtonText: { color: '#7C3AED', fontSize: 13, fontWeight: 'bold' },
  inputRow: { flexDirection: 'row', marginTop: 12, gap: 10 },
  budgetInput: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    color: 'white',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7C3AED50',
    fontSize: 15,
  },
  saveBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 18,
    borderRadius: 10,
    justifyContent: 'center',
  },
  saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  progressContainer: { marginTop: 12 },
  progressBar: {
    height: 6,
    backgroundColor: '#0A0A0F',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 3 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  progressText: { fontSize: 11, color: '#555' },
  budgetText: { fontSize: 11, color: '#555' },
  alertBadge: {
    backgroundColor: '#FF6B6B20',
    padding: 6,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF6B6B30',
  },
  alertText: { color: '#FF6B6B', fontSize: 12, fontWeight: 'bold' },
});