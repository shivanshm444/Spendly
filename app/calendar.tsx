import { useState, useMemo } from 'react';
import {
    StyleSheet, Text, View, TouchableOpacity, ScrollView,
    StatusBar, Modal, Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTransactions } from '../context/TransactionContext';
import { LinearGradient } from 'expo-linear-gradient';

const screenWidth = Dimensions.get('window').width;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const CATEGORY_COLORS: { [key: string]: string } = {
    Food: '#FF6B6B', Snacks: '#F97316', Dairy: '#60A5FA', Shopping: '#4ECDC4',
    Travel: '#45B7D1', Fuel: '#F39C12', Entertainment: '#9B59B6', Groceries: '#2ECC71',
    Health: '#E74C3C', Rent: '#3498DB', Education: '#1ABC9C', Other: '#95A5A6',
};
const CATEGORY_EMOJIS: { [key: string]: string } = {
    Food: '🍕', Snacks: '🍟', Dairy: '🥛', Shopping: '🛒', Travel: '✈️',
    Fuel: '⛽', Entertainment: '🎬', Groceries: '🏪', Health: '💊',
    Rent: '🏠', Education: '📚', Other: '💳',
};

export default function CalendarScreen() {
    const router = useRouter();
    const { transactions } = useTransactions();

    const now = new Date();
    const [viewYear, setViewYear] = useState(now.getFullYear());
    const [viewMonth, setViewMonth] = useState(now.getMonth());
    const [selectedDay, setSelectedDay] = useState<number | null>(null);

    // Build daily totals map for the current month
    const dailyData = useMemo(() => {
        const map: { [day: number]: { total: number; count: number; transactions: typeof transactions } } = {};
        const monthStart = new Date(viewYear, viewMonth, 1).getTime();
        const monthEnd = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59, 999).getTime();

        transactions.forEach(t => {
            const ts = parseInt(t.date);
            if (isNaN(ts) || ts < monthStart || ts > monthEnd) return;
            const d = new Date(ts);
            const day = d.getDate();
            if (!map[day]) map[day] = { total: 0, count: 0, transactions: [] };
            map[day].total += t.amount;
            map[day].count += 1;
            map[day].transactions = [...map[day].transactions, t];
        });
        return map;
    }, [transactions, viewYear, viewMonth]);

    // Calendar grid
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const totalCells = Math.ceil((firstDayOfMonth + daysInMonth) / 7) * 7;
    const cellWidth = (screenWidth - 56) / 7;

    const monthTotal = Object.values(dailyData).reduce((sum, d) => sum + d.total, 0);
    const daysWithSpending = Object.keys(dailyData).length;
    const dailyAvg = daysWithSpending > 0 ? monthTotal / daysWithSpending : 0;

    const goToPrevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
        setSelectedDay(null);
    };
    const goToNextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
        setSelectedDay(null);
    };

    const selectedDayData = selectedDay ? dailyData[selectedDay] : null;

    // Determine spending intensity for color
    const maxDaily = Math.max(...Object.values(dailyData).map(d => d.total), 1);

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>📅 Calendar</Text>
            </View>

            {/* Month Navigation */}
            <View style={styles.monthNav}>
                <TouchableOpacity onPress={goToPrevMonth} style={styles.navBtn}>
                    <Text style={styles.navBtnText}>‹</Text>
                </TouchableOpacity>
                <View style={styles.monthLabelContainer}>
                    <Text style={styles.monthLabel}>{MONTHS[viewMonth]}</Text>
                    <Text style={styles.yearLabel}>{viewYear}</Text>
                </View>
                <TouchableOpacity onPress={goToNextMonth} style={styles.navBtn}>
                    <Text style={styles.navBtnText}>›</Text>
                </TouchableOpacity>
            </View>

            {/* Month Summary */}
            <LinearGradient colors={['#7C3AED', '#4F46E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryVal}>₹{monthTotal.toFixed(0)}</Text>
                        <Text style={styles.summaryLbl}>Total</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryVal}>{daysWithSpending}</Text>
                        <Text style={styles.summaryLbl}>Active Days</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryVal}>₹{dailyAvg.toFixed(0)}</Text>
                        <Text style={styles.summaryLbl}>Daily Avg</Text>
                    </View>
                </View>
            </LinearGradient>

            {/* Calendar Grid */}
            <View style={styles.calendarCard}>
                {/* Day Headers */}
                <View style={styles.dayHeaderRow}>
                    {DAYS.map(d => (
                        <View key={d} style={[styles.dayHeaderCell, { width: cellWidth }]}>
                            <Text style={[styles.dayHeaderText, (d === 'Sun') && { color: '#EF4444' }]}>{d}</Text>
                        </View>
                    ))}
                </View>

                {/* Date Cells */}
                <View style={styles.calendarGrid}>
                    {Array.from({ length: totalCells }).map((_, idx) => {
                        const dayNum = idx - firstDayOfMonth + 1;
                        const isValid = dayNum >= 1 && dayNum <= daysInMonth;
                        const data = isValid ? dailyData[dayNum] : null;
                        const isToday = isValid && dayNum === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
                        const isSelected = isValid && dayNum === selectedDay;
                        const intensity = data ? Math.min(data.total / maxDaily, 1) : 0;

                        return (
                            <TouchableOpacity
                                key={idx}
                                style={[
                                    styles.dateCell,
                                    { width: cellWidth, height: cellWidth + 8 },
                                    isToday && styles.dateCellToday,
                                    isSelected && styles.dateCellSelected,
                                    data && !isSelected && { backgroundColor: `rgba(124, 58, 237, ${0.05 + intensity * 0.15})` },
                                ]}
                                disabled={!isValid}
                                onPress={() => isValid && setSelectedDay(dayNum === selectedDay ? null : dayNum)}
                                activeOpacity={0.6}
                            >
                                {isValid && (
                                    <>
                                        <Text style={[
                                            styles.dateNum,
                                            isToday && styles.dateNumToday,
                                            isSelected && styles.dateNumSelected,
                                            new Date(viewYear, viewMonth, dayNum).getDay() === 0 && { color: '#EF4444' },
                                        ]}>{dayNum}</Text>
                                        {data ? (
                                            <>
                                                <View style={[styles.spendDot, { backgroundColor: intensity > 0.5 ? '#7C3AED' : '#DDD6FE' }]} />
                                                <Text style={[styles.dateAmount, isSelected && { color: 'white' }]} numberOfLines={1}>
                                                    ₹{data.total >= 1000 ? (data.total / 1000).toFixed(1) + 'k' : data.total.toFixed(0)}
                                                </Text>
                                            </>
                                        ) : (
                                            <Text style={styles.dateEmpty}> </Text>
                                        )}
                                    </>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* Selected Day Detail */}
            {selectedDay && selectedDayData && (
                <View style={styles.dayDetailCard}>
                    <View style={styles.dayDetailHeader}>
                        <Text style={styles.dayDetailTitle}>
                            📋 {selectedDay} {MONTHS[viewMonth]} {viewYear}
                        </Text>
                        <View style={styles.dayDetailBadge}>
                            <Text style={styles.dayDetailBadgeText}>₹{selectedDayData.total.toFixed(0)}</Text>
                        </View>
                    </View>
                    <Text style={styles.dayDetailCount}>
                        {selectedDayData.count} transaction{selectedDayData.count > 1 ? 's' : ''}
                    </Text>

                    {/* Group by category */}
                    {(() => {
                        const groups: { [cat: string]: typeof transactions } = {};
                        selectedDayData.transactions.forEach(t => {
                            const cat = t.category || 'Uncategorized';
                            if (!groups[cat]) groups[cat] = [];
                            groups[cat].push(t);
                        });

                        return Object.entries(groups).map(([cat, txns]) => {
                            const catColor = CATEGORY_COLORS[cat] || '#95A5A6';
                            const catEmoji = CATEGORY_EMOJIS[cat] || '💳';
                            const catTotal = txns.reduce((sum, t) => sum + t.amount, 0);

                            return (
                                <View key={cat} style={styles.catGroup}>
                                    <View style={styles.catGroupHeader}>
                                        <View style={[styles.catDot, { backgroundColor: catColor }]} />
                                        <Text style={styles.catGroupEmoji}>{catEmoji}</Text>
                                        <Text style={styles.catGroupName}>{cat}</Text>
                                        <Text style={[styles.catGroupTotal, { color: catColor }]}>₹{catTotal.toFixed(0)}</Text>
                                    </View>

                                    {txns.map((t, i) => (
                                        <View key={i} style={styles.txnRow}>
                                            {t.items && t.items.length > 0 ? (
                                                t.items.map((item, j) => (
                                                    <View key={j} style={styles.txnItemRow}>
                                                        <Text style={styles.txnItemName}>{item.name}</Text>
                                                        <Text style={styles.txnItemQty}>×{item.qty}</Text>
                                                        <Text style={styles.txnItemPrice}>₹{item.price} each</Text>
                                                        <Text style={styles.txnItemTotal}>₹{(item.qty * item.price).toFixed(0)}</Text>
                                                    </View>
                                                ))
                                            ) : (
                                                <View style={styles.txnItemRow}>
                                                    <Text style={styles.txnItemName}>{t.subCategory || t.merchant}</Text>
                                                    <Text style={styles.txnItemTotal}>₹{t.amount.toFixed(0)}</Text>
                                                </View>
                                            )}
                                        </View>
                                    ))}
                                </View>
                            );
                        });
                    })()}
                </View>
            )}

            {selectedDay && !selectedDayData && (
                <View style={styles.dayDetailCard}>
                    <Text style={styles.emptyDayTitle}>📋 {selectedDay} {MONTHS[viewMonth]} {viewYear}</Text>
                    <Text style={styles.emptyDayText}>No transactions on this day</Text>
                </View>
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

    // Month Nav
    monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginTop: 16, marginBottom: 8 },
    navBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB', elevation: 1 },
    navBtnText: { fontSize: 24, color: '#7C3AED', fontWeight: 'bold', lineHeight: 28 },
    monthLabelContainer: { alignItems: 'center' },
    monthLabel: { fontSize: 20, fontWeight: 'bold', color: '#1A1A1A' },
    yearLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

    // Summary
    summaryCard: { marginHorizontal: 20, marginTop: 12, padding: 20, borderRadius: 20, elevation: 6 },
    summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryVal: { fontSize: 20, fontWeight: 'bold', color: 'white' },
    summaryLbl: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
    summaryDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },

    // Calendar
    calendarCard: { marginHorizontal: 20, marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 8, borderWidth: 1, borderColor: '#F3F4F6', elevation: 2 },
    dayHeaderRow: { flexDirection: 'row', marginBottom: 4 },
    dayHeaderCell: { alignItems: 'center', paddingVertical: 8 },
    dayHeaderText: { fontSize: 12, fontWeight: '700', color: '#9CA3AF' },
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    dateCell: { alignItems: 'center', justifyContent: 'center', paddingVertical: 2, borderRadius: 12, marginVertical: 1 },
    dateCellToday: { borderWidth: 2, borderColor: '#7C3AED' },
    dateCellSelected: { backgroundColor: '#7C3AED' },
    dateNum: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
    dateNumToday: { color: '#7C3AED', fontWeight: 'bold' },
    dateNumSelected: { color: 'white', fontWeight: 'bold' },
    spendDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
    dateAmount: { fontSize: 8, color: '#7C3AED', fontWeight: '700', marginTop: 1 },
    dateEmpty: { fontSize: 8, marginTop: 3 },

    // Day Detail
    dayDetailCard: { marginHorizontal: 20, marginTop: 16, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#F3F4F6', elevation: 2 },
    dayDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    dayDetailTitle: { fontSize: 17, fontWeight: 'bold', color: '#1A1A1A' },
    dayDetailBadge: { backgroundColor: '#7C3AED', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14 },
    dayDetailBadgeText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
    dayDetailCount: { fontSize: 12, color: '#9CA3AF', marginBottom: 12 },

    catGroup: { marginBottom: 14, backgroundColor: '#F9FAFB', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#F3F4F6' },
    catGroupHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
    catDot: { width: 8, height: 8, borderRadius: 4 },
    catGroupEmoji: { fontSize: 16 },
    catGroupName: { fontSize: 14, fontWeight: 'bold', color: '#1A1A1A', flex: 1 },
    catGroupTotal: { fontSize: 14, fontWeight: 'bold' },

    txnRow: { marginLeft: 22 },
    txnItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 },
    txnItemName: { flex: 1, fontSize: 13, color: '#4B5563', fontWeight: '500' },
    txnItemQty: { fontSize: 12, color: '#7C3AED', fontWeight: '700' },
    txnItemPrice: { fontSize: 11, color: '#9CA3AF' },
    txnItemTotal: { fontSize: 13, fontWeight: 'bold', color: '#1A1A1A', minWidth: 50, textAlign: 'right' },

    emptyDayTitle: { fontSize: 17, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 8 },
    emptyDayText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 16 },
});
