import { LinearGradient } from 'expo-linear-gradient';
let Notifications: any = null;
try { Notifications = require('expo-notifications'); } catch (e) { /* Expo Go SDK 53 */ }
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useTransactions } from '../context/TransactionContext';

if (Notifications?.setNotificationHandler) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

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
  const targetDailySpend = (budget - spent) / Math.max(daysRemaining, 1);
  const reduceBy = dailyAvg - targetDailySpend;
  return {
    projectedTotal,
    overspend,
    dailyAvg,
    daysRemaining,
    daysUntilBudgetFinished,
    daysPassed,
    daysInMonth,
    targetDailySpend,
    reduceBy,
  };
};

export default function BudgetScreen() {
  const router = useRouter();
  const { transactions, budgets, setBudgets } = useTransactions();
  const [editing, setEditing] = useState<string | null>(null);
  const [tempBudgets, setTempBudgets] = useState<{ [key: string]: string }>({});
  const [showPredictions, setShowPredictions] = useState(false);
  const [predictionsLoading, setPredictionsLoading] = useState(false);

  const monthOptions = generateMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].key);
  const currentMonthData = monthOptions.find(m => m.key === selectedMonth)!;

  useEffect(() => {
    registerForNotifications();
    setTempBudgets({ ...budgets });
  }, []);

  const registerForNotifications = async () => {
    if (!Notifications?.requestPermissionsAsync) return;
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow notifications for budget alerts!');
    }
  };

  const sendNotification = async (title: string, body: string) => {
    if (!Notifications?.scheduleNotificationAsync) return;
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
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Budget Alerts 🎯</Text>
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

      <LinearGradient
        colors={totalSpent > (totalBudget > 0 ? totalBudget : sumOfCategoryBudgets) ? ['#3a0a0a', '#1a0a0a'] as const : ['#7C3AED', '#4F46E5'] as const}
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
              placeholderTextColor="#9CA3AF"
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

      {/* AI Prediction Toggle Button */}
      <TouchableOpacity
        style={[styles.predictionToggleBtn, showPredictions && styles.predictionToggleBtnActive]}
        onPress={() => {
          if (!showPredictions) {
            setPredictionsLoading(true);
            // Simulate AI thinking delay for effect
            setTimeout(() => {
              setPredictionsLoading(false);
              setShowPredictions(true);
            }, 1200);
          } else {
            setShowPredictions(false);
          }
        }}>
        <LinearGradient
          colors={showPredictions ? ['#4F46E5', '#7C3AED'] : ['#F5F3FF', '#EDE9FE']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.predictionToggleGradient}>
          {predictionsLoading ? (
            <View style={styles.predictionToggleContent}>
              <ActivityIndicator size="small" color={showPredictions ? '#FFFFFF' : '#7C3AED'} />
              <Text style={[styles.predictionToggleText, { color: '#7C3AED' }]}>🧠 AI is analyzing your spending...</Text>
            </View>
          ) : (
            <View style={styles.predictionToggleContent}>
              <Text style={styles.predictionToggleEmoji}>{showPredictions ? '🔮' : '🤖'}</Text>
              <View>
                <Text style={[styles.predictionToggleText, showPredictions && { color: '#FFFFFF' }]}>
                  {showPredictions ? 'Hide AI Predictions' : 'Show AI Predictions'}
                </Text>
                <Text style={[styles.predictionToggleSub, showPredictions && { color: 'rgba(255,255,255,0.7)' }]}>
                  {showPredictions ? 'Tap to collapse' : 'Tap to see smart spending advice'}
                </Text>
              </View>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {/* Predictions Section — only shown when toggled */}
      {showPredictions && hasPredictions && (
        <View style={styles.predictionsSection}>
          <View style={styles.predictionHeaderRow}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' }}>🔮 AI Predictions</Text>
            <View style={styles.smartBadge}>
              <Text style={styles.smartBadgeText}>✨ Smart Advice</Text>
            </View>
          </View>
          {CATEGORIES.map(cat => {
            const spent = getCategorySpent(cat.name);
            const budget = parseFloat(budgets[cat.name] || '0');
            const prediction = getPrediction(spent, budget);
            if (!prediction) return null;
            const isOverspending = prediction.overspend > 0;
            const savings = Math.abs(prediction.overspend);
            return (
              <View key={cat.name} style={[styles.predictionCard, isOverspending && styles.predictionCardDanger]}>
                <Text style={styles.predictionEmoji}>{cat.emoji}</Text>
                <View style={styles.predictionText}>
                  <Text style={styles.predictionTitle}>{cat.name} — End of Month</Text>
                  <Text style={styles.predictionAmount}>
                    📅 Projected: ₹{prediction.projectedTotal.toFixed(0)}
                  </Text>
                  <Text style={[styles.predictionStatus, { color: isOverspending ? '#FF6B6B' : '#2ECC71' }]}>
                    {isOverspending
                      ? `⚠️ Will exceed by ₹${prediction.overspend.toFixed(0)}`
                      : `✅ Will save ₹${savings.toFixed(0)}`}
                  </Text>

                  {/* Stats Row */}
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>₹{prediction.projectedTotal.toFixed(0)}</Text>
                      <Text style={styles.statLabel}>Projected</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>₹{prediction.dailyAvg.toFixed(0)}</Text>
                      <Text style={styles.statLabel}>Daily Avg</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{prediction.daysRemaining}</Text>
                      <Text style={styles.statLabel}>Days Left</Text>
                    </View>
                  </View>

                  {prediction.daysUntilBudgetFinished < prediction.daysInMonth && (
                    <Text style={styles.predictionWarning}>
                      🚨 Budget runs out in {Math.max(0, prediction.daysUntilBudgetFinished - prediction.daysPassed).toFixed(0)} days!
                    </Text>
                  )}

                  {/* Advice Box */}
                  <View style={[styles.adviceBox, { borderColor: isOverspending ? '#FF6B6B30' : '#2ECC7130', backgroundColor: isOverspending ? '#FF6B6B08' : '#2ECC7108' }]}>
                    <Text style={[styles.adviceText, { color: isOverspending ? '#FF8A8A' : '#5DEBB5' }]}>
                      {isOverspending
                        ? `💡 Reduce ${cat.name} spending by ₹${Math.max(0, prediction.reduceBy).toFixed(0)}/day to stay within budget. Target: ₹${Math.max(0, prediction.targetDailySpend).toFixed(0)}/day for remaining ${prediction.daysRemaining} days.`
                        : `🎉 You'll save ₹${savings.toFixed(0)} this month! You can spend up to ₹${Math.max(0, prediction.targetDailySpend).toFixed(0)}/day and stay on track.`}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {showPredictions && !hasPredictions && (
        <View style={styles.noPredictionsBox}>
          <Text style={styles.noPredictionsEmoji}>🤷</Text>
          <Text style={styles.noPredictionsText}>No predictions yet</Text>
          <Text style={styles.noPredictionsSub}>Set budgets and add transactions to see AI predictions</Text>
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
                  placeholderTextColor="#9CA3AF"
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
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: '#FFFFFF', padding: 20, paddingTop: 55, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backButton: { marginRight: 15 },
  backText: { color: '#7C3AED', fontSize: 16, fontWeight: 'bold' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A' },

  // Month Picker
  monthPickerContainer: { marginTop: 10, marginBottom: 15 },
  monthPickerScroll: { paddingHorizontal: 16, gap: 8 },
  monthChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', minWidth: 65 },
  monthChipSelected: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  monthChipText: { fontSize: 14, fontWeight: 'bold', color: '#6B7280' },
  monthChipTextSelected: { color: 'white' },
  monthChipYear: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  monthChipYearSelected: { color: 'rgba(255,255,255,0.7)' },

  totalCard: { marginHorizontal: 20, padding: 22, borderRadius: 24, elevation: 10, marginBottom: 5 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  totalAmount: { fontSize: 18, fontWeight: 'bold', color: 'white', textAlign: 'center', marginTop: 4 },
  divider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)' },

  overallProgressContainer: { marginTop: 20 },
  overallProgressBar: { height: 8, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 4, overflow: 'hidden' },
  overallProgressFill: { height: 8, borderRadius: 4 },
  overallProgressText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 6, textAlign: 'center' },

  predictionsSection: { marginTop: 20 },
  predictionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 12, marginTop: 25, gap: 10 },
  smartBadge: { backgroundColor: '#7C3AED15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: '#DDD6FE' },
  smartBadgeText: { color: '#7C3AED', fontSize: 11, fontWeight: 'bold' },
  predictionCard: { backgroundColor: '#FFFFFF', marginHorizontal: 20, marginBottom: 10, padding: 15, borderRadius: 16, flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: '#F3F4F6', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  predictionCardDanger: { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' },
  predictionEmoji: { fontSize: 28, marginRight: 12, marginTop: 2 },
  predictionText: { flex: 1 },
  predictionTitle: { fontSize: 13, color: '#9CA3AF', fontWeight: 'bold' },
  predictionAmount: { fontSize: 15, fontWeight: 'bold', color: '#1A1A1A', marginTop: 4 },
  predictionStatus: { fontSize: 13, fontWeight: 'bold', marginTop: 4 },
  predictionWarning: { fontSize: 12, color: '#EF4444', marginTop: 4, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, marginTop: 10 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { color: '#1A1A1A', fontSize: 13, fontWeight: 'bold' },
  statLabel: { color: '#9CA3AF', fontSize: 9, marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: '#E5E7EB' },
  adviceBox: { marginTop: 10, padding: 10, borderRadius: 10, borderWidth: 1 },
  adviceText: { fontSize: 11, lineHeight: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginHorizontal: 20, marginTop: 25, marginBottom: 12, color: '#1A1A1A' },
  budgetCard: { backgroundColor: '#FFFFFF', marginHorizontal: 20, marginBottom: 10, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#F3F4F6', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  budgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  categoryDot: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  categoryEmoji: { fontSize: 22 },
  categoryName: { fontSize: 15, fontWeight: 'bold', color: '#1A1A1A' },
  spentText: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  editButton: { backgroundColor: '#F5F3FF', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: '#DDD6FE' },
  editButtonText: { color: '#7C3AED', fontSize: 13, fontWeight: 'bold' },
  inputRow: { flexDirection: 'row', marginTop: 12, gap: 10 },
  budgetInput: { flex: 1, backgroundColor: '#F9FAFB', color: '#1A1A1A', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 15 },
  saveBtn: { backgroundColor: '#7C3AED', paddingHorizontal: 18, borderRadius: 10, justifyContent: 'center' },
  saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  progressContainer: { marginTop: 12 },
  progressBar: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  progressText: { fontSize: 11, color: '#9CA3AF' },
  budgetText: { fontSize: 11, color: '#9CA3AF' },
  alertBadge: { backgroundColor: '#FFF1F2', padding: 6, borderRadius: 8, marginTop: 8, alignItems: 'center', borderWidth: 1, borderColor: '#FECDD3' },
  alertText: { color: '#EF4444', fontSize: 12, fontWeight: 'bold' },

  // AI Prediction Toggle Button
  predictionToggleBtn: { marginHorizontal: 20, marginTop: 20, borderRadius: 16, overflow: 'hidden', elevation: 3, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6 },
  predictionToggleBtnActive: {},
  predictionToggleGradient: { padding: 16 },
  predictionToggleContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  predictionToggleEmoji: { fontSize: 28 },
  predictionToggleText: { fontSize: 15, fontWeight: 'bold', color: '#7C3AED' },
  predictionToggleSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  // No predictions fallback
  noPredictionsBox: { backgroundColor: '#FFFFFF', marginHorizontal: 20, marginTop: 12, padding: 30, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  noPredictionsEmoji: { fontSize: 40, marginBottom: 8 },
  noPredictionsText: { fontSize: 16, fontWeight: 'bold', color: '#6B7280' },
  noPredictionsSub: { fontSize: 13, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },
});