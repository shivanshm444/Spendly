import { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, StatusBar, Modal
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTransactions, Split } from '../context/TransactionContext';
import { LinearGradient } from 'expo-linear-gradient';
let Notifications: any = null;
try { Notifications = require('expo-notifications'); } catch (e) { /* Expo Go SDK 53 */ }
import { db, auth } from '../firebase.config';
// @ts-ignore
import { doc, getDoc, setDoc } from 'firebase/firestore';

import { GEMINI_API_KEY } from '../config';

// ─── Category Definitions ────────────────────────────────────────────────────

const BUILT_IN_CATEGORIES = [
  { name: 'Food', emoji: '🍕', color: '#FF6B6B', subs: ['Breakfast', 'Lunch', 'Dinner', 'Coffee/Tea', 'Other'] },
  { name: 'Snacks', emoji: '🍟', color: '#F97316', subs: ['Chips', 'Biscuits', 'Instant Noodles', 'Cold Drink', 'Namkeen', 'Other'] },
  { name: 'Dairy', emoji: '🥛', color: '#60A5FA', subs: ['Milk', 'Paneer', 'Curd', 'Ghee', 'Butter', 'Other'] },
  { name: 'Groceries', emoji: '🏪', color: '#2ECC71', subs: ['Vegetables', 'Fruits', 'Household', 'Other'] },
  { name: 'Shopping', emoji: '🛒', color: '#4ECDC4', subs: ['Clothing', 'Electronics', 'Accessories', 'Online', 'Other'] },
  { name: 'Travel', emoji: '✈️', color: '#45B7D1', subs: ['Cab/Auto', 'Bus/Train', 'Flight', 'Hotel', 'Other'] },
  { name: 'Fuel', emoji: '⛽', color: '#F39C12', subs: ['Petrol', 'Diesel', 'CNG', 'Other'] },
  { name: 'Entertainment', emoji: '🎬', color: '#9B59B6', subs: ['Movies', 'Streaming', 'Gaming', 'Events', 'Other'] },
  { name: 'Health', emoji: '💊', color: '#E74C3C', subs: ['Medicine', 'Doctor', 'Gym', 'Other'] },
  { name: 'Rent', emoji: '🏠', color: '#3498DB', subs: ['Rent', 'Maintenance', 'Electricity', 'Other'] },
  { name: 'Education', emoji: '📚', color: '#1ABC9C', subs: ['Books', 'Course', 'Fees', 'Stationery', 'Other'] },
  { name: 'Other', emoji: '💳', color: '#95A5A6', subs: [] },
];

// Stationery sub-subcategories (shown when Education > Stationery is selected)
const STATIONERY_SUBS = ['Pen', 'Pencil', 'Copy', 'Eraser', 'Ruler', 'Other'];

type CategoryDef = { name: string; emoji: string; color: string; subs: string[] };

// ─── AI / Keyword Helpers ────────────────────────────────────────────────────

const getGeminiSuggestion = async (
  merchant: string, smsBody: string, allCategoryNames: string[]
): Promise<{ category: string; subCategory: string } | null> => {
  if (!GEMINI_API_KEY) return null;
  try {
    const prompt = `You are a bank transaction categorizer for an Indian user. Given this bank SMS, classify it into exactly one category and one subcategory.

Categories and their subcategories:
- Food: Breakfast, Lunch, Dinner, Coffee/Tea
- Snacks: Chips, Biscuits, Instant Noodles, Cold Drink, Namkeen
- Dairy: Milk, Paneer, Curd, Ghee, Butter
- Groceries: Vegetables, Fruits, Household
- Shopping: Clothing, Electronics, Accessories, Online
- Travel: Cab/Auto, Bus/Train, Flight, Hotel
- Fuel: Petrol, Diesel, CNG
- Entertainment: Movies, Streaming, Gaming, Events
- Health: Medicine, Doctor, Gym
- Rent: Rent, Maintenance, Electricity
- Education: Books, Course, Fees, Stationery
- Other: (use only if nothing else fits)

Merchant: ${merchant}
Full SMS: ${smsBody || 'not available'}

Respond with ONLY a JSON object like {"category":"Food","subCategory":"Lunch"} — no other text.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY.trim()}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 50 },
        }),
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) return null;
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.category && allCategoryNames.includes(parsed.category)) {
      return { category: parsed.category, subCategory: parsed.subCategory || '' };
    }
    return null;
  } catch (e) {
    return null;
  }
};

const getAISuggestion = (merchant: string, smsBody: string = ''): { category: string; subCategory: string } => {
  const m = (merchant + ' ' + smsBody).toLowerCase();

  // 🍟 Snacks (check before Food so kurkure/chips don't get classified as food)
  if (m.includes('kurkure') || m.includes('lays') || m.includes('chips') ||
    m.includes('biscuit') || m.includes('parle') || m.includes('britannia') ||
    m.includes('maggi') || m.includes('noodles') || m.includes('pepsi') ||
    m.includes('coca cola') || m.includes('coke') || m.includes('sprite') ||
    m.includes('thumbs up') || m.includes('thums up') || m.includes('7up') ||
    m.includes('fanta') || m.includes('mirinda') || m.includes('redbull') ||
    m.includes('cold drink') || m.includes('coldrink') || m.includes('frooti') ||
    m.includes('maaza') || m.includes('real juice') || m.includes('tropicana') ||
    m.includes('namkeen') || m.includes('mixture') || m.includes('bhujia') ||
    m.includes('haldirams') || m.includes('act ii') || m.includes('popcorn') ||
    m.includes('snack') || m.includes('munch') || m.includes('kit kat') ||
    m.includes('dairy milk') || m.includes('5star') || m.includes('wafer'))
    return {
      category: 'Snacks', subCategory: m.includes('noodle') || m.includes('maggi') ? 'Instant Noodles'
        : m.includes('biscuit') || m.includes('parle') || m.includes('britannia') ? 'Biscuits'
          : m.includes('chips') || m.includes('lays') || m.includes('kurkure') ? 'Chips'
            : m.includes('pepsi') || m.includes('coke') || m.includes('sprite') || m.includes('cold drink') ? 'Cold Drink'
              : m.includes('namkeen') || m.includes('bhujia') ? 'Namkeen' : 'Other'
    };

  // 🥛 Dairy (check before Groceries)
  if (m.includes('amul') || m.includes('saras') || m.includes('milma') ||
    m.includes('mother dairy') || m.includes('milk') || m.includes('paneer') ||
    m.includes('curd') || m.includes('dahi') || m.includes('ghee') ||
    m.includes('makhan') || m.includes('butter') || m.includes('cheese') ||
    m.includes('dairy'))
    return {
      category: 'Dairy', subCategory: m.includes('paneer') ? 'Paneer'
        : m.includes('curd') || m.includes('dahi') ? 'Curd'
          : m.includes('ghee') ? 'Ghee'
            : m.includes('butter') || m.includes('makhan') ? 'Butter'
              : 'Milk'
    };

  // 🍕 Food & Dining
  if (m.includes('swiggy') || m.includes('zomato') || m.includes('dominos') || m.includes('mcdonalds') ||
    m.includes('kfc') || m.includes('pizza') || m.includes('burger') || m.includes('cafe') ||
    m.includes('restaurant') || m.includes('food') || m.includes('biryani') || m.includes('chai') ||
    m.includes('starbucks') || m.includes('dunkin') || m.includes('barbeque') ||
    m.includes('behrouz') || m.includes('faasos') || m.includes('box8') || m.includes('eatfit') ||
    m.includes('subway') || m.includes('dineout') || m.includes('eatsure'))
    return {
      category: 'Food', subCategory: m.includes('breakfast') || m.includes('morning') ? 'Breakfast'
        : m.includes('coffee') || m.includes('chai') || m.includes('tea') || m.includes('starbucks') || m.includes('dunkin') ? 'Coffee/Tea'
          : m.includes('dinner') || m.includes('night') ? 'Dinner' : 'Lunch'
    };

  // 🛒 Shopping
  if (m.includes('amazon') || m.includes('flipkart') || m.includes('myntra') || m.includes('ajio') ||
    m.includes('meesho') || m.includes('snapdeal') || m.includes('nykaa') || m.includes('tatacliq') ||
    m.includes('shoppers stop') || m.includes('lifestyle') || m.includes('reliance digital') ||
    m.includes('croma') || m.includes('decathlon') || m.includes('westside') || m.includes('zara') ||
    m.includes('h&m') || m.includes('pantaloons') || m.includes('max fashion') || m.includes('lenskart') ||
    m.includes('pepperfry') || m.includes('urban ladder') || m.includes('firstcry'))
    return { category: 'Shopping', subCategory: 'Online' };

  // ⛽ Fuel
  if (m.includes('petrol') || m.includes('fuel') || m.includes('bpcl') || m.includes('hpcl') ||
    m.includes('iocl') || m.includes('indian oil') || m.includes('bharat petroleum') ||
    m.includes('filling station') || m.includes('cng') || m.includes('diesel') || m.includes('nayara'))
    return { category: 'Fuel', subCategory: m.includes('cng') ? 'CNG' : m.includes('diesel') ? 'Diesel' : 'Petrol' };

  // ✈️ Travel
  if (m.includes('uber') || m.includes('ola') || m.includes('rapido') || m.includes('flight') ||
    m.includes('irctc') || m.includes('makemytrip') || m.includes('goibibo') || m.includes('redbus') ||
    m.includes('indigo') || m.includes('spicejet') || m.includes('air india') || m.includes('metro') ||
    m.includes('railway') || m.includes('oyo') || m.includes('cab') || m.includes('taxi') ||
    m.includes('toll') || m.includes('fastag') || m.includes('parking'))
    return {
      category: 'Travel', subCategory: m.includes('flight') || m.includes('indigo') || m.includes('spicejet') ? 'Flight'
        : m.includes('oyo') || m.includes('hotel') ? 'Hotel'
          : m.includes('irctc') || m.includes('railway') || m.includes('metro') || m.includes('redbus') ? 'Bus/Train'
            : 'Cab/Auto'
    };

  // 🎬 Entertainment
  if (m.includes('netflix') || m.includes('spotify') || m.includes('prime') || m.includes('hotstar') ||
    m.includes('disney') || m.includes('jiocinema') || m.includes('zee5') || m.includes('sonyliv') ||
    m.includes('bookmyshow') || m.includes('pvr') || m.includes('inox') || m.includes('cinepolis') ||
    m.includes('steam') || m.includes('playstation') || m.includes('gaming') || m.includes('movie'))
    return {
      category: 'Entertainment', subCategory: m.includes('pvr') || m.includes('inox') || m.includes('movie') ? 'Movies'
        : m.includes('steam') || m.includes('gaming') ? 'Gaming'
          : 'Streaming'
    };

  // 🏪 Groceries
  if (m.includes('bigbasket') || m.includes('blinkit') || m.includes('zepto') || m.includes('instamart') ||
    m.includes('jiomart') || m.includes('dmart') || m.includes('reliance fresh') ||
    m.includes('grofers') || m.includes('bazaar') || m.includes('mart') || m.includes('grocer') ||
    m.includes('kirana') || m.includes('nature basket') || m.includes('big bazaar') ||
    m.includes('vegetables') || m.includes('fruits') || m.includes('sabzi'))
    return { category: 'Groceries', subCategory: m.includes('fruit') ? 'Fruits' : 'Vegetables' };

  // 💊 Health
  if (m.includes('hospital') || m.includes('pharmacy') || m.includes('medical') || m.includes('apollo') ||
    m.includes('medplus') || m.includes('netmeds') || m.includes('pharmeasy') || m.includes('1mg') ||
    m.includes('doctor') || m.includes('clinic') || m.includes('gym') || m.includes('cult.fit') ||
    m.includes('dental') || m.includes('wellness') || m.includes('practo'))
    return {
      category: 'Health', subCategory: m.includes('gym') || m.includes('cult') ? 'Gym'
        : m.includes('doctor') || m.includes('clinic') || m.includes('practo') ? 'Doctor' : 'Medicine'
    };

  // 🏠 Rent & Utilities
  if (m.includes('rent') || m.includes('electricity') || m.includes('water bill') ||
    m.includes('maintenance') || m.includes('society') || m.includes('broadband') ||
    m.includes('wifi') || m.includes('jio fiber') || m.includes('piped gas') || m.includes('property'))
    return {
      category: 'Rent', subCategory: m.includes('electric') ? 'Electricity'
        : m.includes('maintenance') || m.includes('society') ? 'Maintenance' : 'Rent'
    };

  // 📚 Education
  if (m.includes('school') || m.includes('college') || m.includes('university') || m.includes('course') ||
    m.includes('udemy') || m.includes('coursera') || m.includes('unacademy') || m.includes('byju') ||
    m.includes('tuition') || m.includes('coaching') || m.includes('exam') || m.includes('books') ||
    m.includes('stationery') || m.includes('pen') || m.includes('pencil') || m.includes('education') ||
    m.includes('notebook') || m.includes('copy'))
    return {
      category: 'Education', subCategory: m.includes('stationery') || m.includes('pen') || m.includes('pencil') || m.includes('copy') || m.includes('notebook') ? 'Stationery'
        : m.includes('book') ? 'Books'
          : m.includes('course') || m.includes('udemy') ? 'Course' : 'Fees'
    };

  // 📱 Recharge / Bills
  if (m.includes('recharge') || m.includes('jio') || m.includes('airtel') || m.includes('vodafone') ||
    m.includes('postpaid') || m.includes('dth') || m.includes('tata sky'))
    return { category: 'Rent', subCategory: 'Other' };

  return { category: 'Other', subCategory: '' };
};

const getAISplitSuggestions = (merchant: string, amount: number): Split[] => {
  const m = merchant.toLowerCase();
  if (m.includes('swiggy') || m.includes('zomato')) {
    return [
      { amount: Math.round(amount * 0.7), description: 'Main course', category: 'Food' },
      { amount: Math.round(amount * 0.3), description: 'Drinks / Dessert', category: 'Snacks' },
    ];
  }
  if (m.includes('amazon') || m.includes('flipkart')) {
    return [
      { amount: Math.round(amount * 0.5), description: 'Item 1', category: 'Shopping' },
      { amount: amount - Math.round(amount * 0.5), description: 'Item 2', category: 'Shopping' },
    ];
  }
  if (m.includes('mart') || m.includes('bazaar') || m.includes('grocer')) {
    return [
      { amount: Math.round(amount * 0.4), description: 'Vegetables & Fruits', category: 'Groceries' },
      { amount: Math.round(amount * 0.3), description: 'Snacks & Drinks', category: 'Snacks' },
      { amount: amount - Math.round(amount * 0.4) - Math.round(amount * 0.3), description: 'Household items', category: 'Shopping' },
    ];
  }
  const suggestion = getAISuggestion(merchant, '');
  return [
    { amount: Math.round(amount / 2), description: 'Item 1', category: suggestion.category },
    { amount: amount - Math.round(amount / 2), description: 'Item 2', category: suggestion.category },
  ];
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AnnotationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { updateTransaction, addTransaction, pendingTransaction, setPendingTransaction, transactions, budgets } = useTransactions();

  const isFromPending = !!pendingTransaction && !params.merchant;
  const merchant = isFromPending ? pendingTransaction!.merchant : String(params.merchant || 'Unknown');
  const amount = isFromPending ? String(pendingTransaction!.amount) : String(params.amount || '0');
  const date = isFromPending ? pendingTransaction!.date : String(params.date || '');
  const message = isFromPending ? pendingTransaction!.message : '';
  const index = isFromPending ? -1 : parseInt(String(params.index || '0'));
  const txnId = String(params.id || '');

  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubs, setSelectedSubs] = useState<string[]>([]); // multi-select subcategories
  const [selectedSubSub, setSelectedSubSub] = useState(''); // for Stationery sub-sub
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState(1); // item quantity counter
  const [aiLoading, setAiLoading] = useState(false);

  // Friend contribution
  const [contributionEnabled, setContributionEnabled] = useState(false);
  const [contributionAmount, setContributionAmount] = useState('');
  const [friendName, setFriendName] = useState('');

  // Custom categories
  const [customCategories, setCustomCategories] = useState<CategoryDef[]>([]);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('');

  // All categories combined
  const allCategories: CategoryDef[] = [...BUILT_IN_CATEGORIES, ...customCategories];
  const allCategoryNames = allCategories.map(c => c.name);

  const totalAmount = parseFloat(amount);
  const friendContrib = parseFloat(contributionAmount) || 0;
  const effectiveAmount = contributionEnabled ? Math.max(0, totalAmount - friendContrib) : totalAmount;

  const currentCat = allCategories.find(c => c.name === selectedCategory);
  const showSubCategories = !!(selectedCategory && currentCat && currentCat.subs.length > 0);
  const showStationerySubs = selectedCategory === 'Education' && selectedSubs.includes('Stationery');
  const showNotesBox = selectedSubs.includes('Other') || selectedCategory === 'Other';

  // Load custom categories from Firestore
  useEffect(() => {
    const loadCustomCategories = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.data();
        if (data?.customCategories) {
          setCustomCategories(data.customCategories);
        }
      } catch (e) { /* ignore */ }
    };
    loadCustomCategories();
  }, []);

  // AI classification on mount
  useEffect(() => {
    setAiLoading(true);
    const classify = async () => {
      const geminiResult = await getGeminiSuggestion(merchant, message, allCategoryNames);
      if (geminiResult) {
        setSelectedCategory(geminiResult.category);
        if (geminiResult.subCategory) setSelectedSubs([geminiResult.subCategory]);
        setAiLoading(false);
        return;
      }
      const suggestion = getAISuggestion(merchant, message);
      setSelectedCategory(suggestion.category);
      if (suggestion.subCategory) setSelectedSubs([suggestion.subCategory]);
      setAiLoading(false);
    };
    classify();
  }, []);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleCategorySelect = (catName: string) => {
    setSelectedCategory(catName);
    setSelectedSubs([]);
    setSelectedSubSub('');
    setNotes('');
    setQuantity(1);
  };

  const handleSubToggle = (sub: string) => {
    setSelectedSubs(prev => {
      if (prev.includes(sub)) return prev.filter(s => s !== sub);
      return [...prev, sub];
    });
    setSelectedSubSub('');
    setQuantity(1);
  };

  const removeSelectedSub = (sub: string) => {
    setSelectedSubs(prev => prev.filter(s => s !== sub));
  };

  const handleSaveCustomCategory = async () => {
    const trimmedName = newCatName.trim();
    const trimmedEmoji = newCatEmoji.trim() || '🏷️';
    if (!trimmedName) {
      Alert.alert('Please enter a category name');
      return;
    }
    if (allCategoryNames.includes(trimmedName)) {
      Alert.alert('A category with this name already exists');
      return;
    }
    const newCat: CategoryDef = { name: trimmedName, emoji: trimmedEmoji, color: '#7C3AED', subs: ['Other'] };
    const updated = [...customCategories, newCat];
    setCustomCategories(updated);
    setShowAddCustom(false);
    setNewCatName('');
    setNewCatEmoji('');

    // Persist to Firestore
    const user = auth.currentUser;
    if (user) {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        await setDoc(doc(db, 'users', user.uid), {
          ...(snap.data() || {}),
          customCategories: updated,
        });
      } catch (e) { /* ignore */ }
    }
  };



  const handleSave = async () => {
    if (!selectedCategory) {
      Alert.alert('Please select a category!');
      return;
    }

    const finalCategory = selectedCategory;
    // Build items list from multi-select
    const itemsList = selectedSubs.filter(s => s !== 'Other');
    const effectiveSub = showStationerySubs && selectedSubSub
      ? `Stationery › ${selectedSubSub}`
      : (itemsList.length > 0 ? itemsList.join(', ') : '');
    const finalSubCategory = effectiveSub;
    const qtyNote = quantity > 1 ? `${quantity}× @ ₹${(totalAmount / quantity).toFixed(2)} each` : '';
    const contribNote = contributionEnabled && friendContrib > 0
      ? `🤝 ${friendName || 'Friend'} pays back ₹${friendContrib.toFixed(0)} — your share: ₹${effectiveAmount.toFixed(0)}`
      : '';
    const itemsNote = itemsList.length > 1 ? `🛒 ${itemsList.join(' + ')}` : '';
    const finalNotes = [itemsNote, qtyNote, contribNote, notes].filter(Boolean).join(' — ');

    // Use effective amount (after friend contribution) for the transaction
    const savedAmount = contributionEnabled ? effectiveAmount : totalAmount;

    if (isFromPending) {
      addTransaction({ amount: savedAmount, merchant, date, message, category: finalCategory, subCategory: finalSubCategory, notes: finalNotes });
      setPendingTransaction(null);
    } else {
      updateTransaction(index, finalCategory, finalNotes, undefined, finalSubCategory, txnId);
    }

    const checkBudgetAlert = async (category: string, txnAmount: number) => {
      if (!category) return false;
      const budget = parseFloat(budgets[category] || '0');
      if (budget <= 0) return false;
      const categorySpent = transactions.filter(t => t.category === category).reduce((sum, t) => sum + t.amount, 0) + txnAmount;
      const percent = (categorySpent / budget) * 100;
      if (percent >= 100) {
        Alert.alert('🚨 Budget Exceeded!', `${category}: Spent ₹${categorySpent.toFixed(0)} of ₹${budget.toFixed(0)}`, [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]);
        if (Notifications?.scheduleNotificationAsync) {
          await Notifications.scheduleNotificationAsync({ content: { title: '🚨 Budget Exceeded!', body: `${category}: ₹${categorySpent.toFixed(0)} of ₹${budget.toFixed(0)}`, sound: true }, trigger: null });
        }
        return true;
      } else if (percent >= 80) {
        Alert.alert('⚠️ 80% Budget Used!', `${category} is at ${percent.toFixed(0)}%!\nRemaining: ₹${(budget - categorySpent).toFixed(0)}`, [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]);
        if (Notifications?.scheduleNotificationAsync) {
          await Notifications.scheduleNotificationAsync({ content: { title: '⚠️ Budget Warning!', body: `${category}: ${percent.toFixed(0)}% used`, sound: true }, trigger: null });
        }
        return true;
      }
      return false;
    };

    const alerted = await checkBudgetAlert(finalCategory, savedAmount);
    if (alerted) return;

    const saveMsg = itemsList.length > 1
      ? `Tagged as ${finalCategory} › ${itemsList.join(' + ')}`
      : `Tagged as ${finalCategory}${effectiveSub ? ` › ${effectiveSub}` : ''}`;
    Alert.alert('✅ Saved!', saveMsg, [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]);
  };

  const handleDismiss = () => {
    if (isFromPending) {
      setPendingTransaction(null);
    }
    router.replace('/(tabs)');
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleDismiss} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isFromPending ? '🔔 New Transaction!' : 'Categorize'}</Text>
      </View>

      {isFromPending && (
        <View style={styles.autoBadge}>
          <Text style={styles.autoBadgeText}>📲 Auto-detected from SMS</Text>
        </View>
      )}

      {/* Transaction Card */}
      <LinearGradient colors={['#7C3AED', '#4F46E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.transactionCard}>
        <Text style={styles.merchantName}>{merchant}</Text>
        <Text style={styles.amount}>₹{totalAmount.toFixed(2)}</Text>
        {contributionEnabled && friendContrib > 0 && (
          <View style={styles.effectiveAmountBadge}>
            <Text style={styles.effectiveAmountText}>Your share: ₹{effectiveAmount.toFixed(0)}</Text>
          </View>
        )}
        <Text style={styles.date}>{date ? new Date(parseInt(date)).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</Text>
        {aiLoading ? (
          <View style={styles.aiLoading}>
            <ActivityIndicator size="small" color="white" />
            <Text style={styles.aiLoadingText}>🤖 AI is analyzing...</Text>
          </View>
        ) : selectedCategory ? (
          <View style={styles.aiSuggestion}>
            <Text style={styles.aiSuggestionText}>
              🤖 AI suggested: {selectedCategory}{selectedSubs.length > 0 ? ` › ${selectedSubs.join(', ')}` : ''}
            </Text>
          </View>
        ) : null}
      </LinearGradient>

      {/* Friend Contribution Toggle */}
      <TouchableOpacity
        style={[styles.contribToggleBtn, contributionEnabled && styles.contribToggleBtnActive]}
        onPress={() => setContributionEnabled(!contributionEnabled)}>
        <Text style={styles.toggleBtnIcon}>🤝</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.toggleBtnText, contributionEnabled && styles.toggleBtnTextActiveGreen]}>Friend Contribution</Text>
          <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{contributionEnabled ? 'Tap to remove' : 'Split cost with a friend'}</Text>
        </View>
        <View style={[styles.splitToggleSwitch, contributionEnabled && { backgroundColor: '#10B981' }]}>
          <View style={[styles.splitToggleDot, contributionEnabled && styles.splitToggleDotActive]} />
        </View>
      </TouchableOpacity>

      {/* Friend Contribution Section */}
      {contributionEnabled && (
        <View style={styles.contribSection}>
          <View style={styles.contribInputRow}>
            <View style={styles.contribInputGroup}>
              <Text style={styles.contribInputLabel}>👤 Friend's name</Text>
              <TextInput
                style={styles.contribInput}
                placeholder="e.g. Rahul"
                placeholderTextColor="#9CA3AF"
                value={friendName}
                onChangeText={setFriendName}
              />
            </View>
            <View style={styles.contribInputGroup}>
              <Text style={styles.contribInputLabel}>💰 Their share</Text>
              <TextInput
                style={styles.contribInput}
                placeholder="e.g. 50"
                placeholderTextColor="#9CA3AF"
                value={contributionAmount}
                onChangeText={setContributionAmount}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.contribSummary}>
            <View style={styles.contribSummaryItem}>
              <Text style={styles.contribSummaryLabel}>Total Paid</Text>
              <Text style={styles.contribSummaryValue}>₹{totalAmount.toFixed(0)}</Text>
            </View>
            <Text style={styles.contribArrow}>→</Text>
            <View style={styles.contribSummaryItem}>
              <Text style={styles.contribSummaryLabel}>{friendName || 'Friend'} pays</Text>
              <Text style={[styles.contribSummaryValue, { color: '#10B981' }]}>₹{friendContrib.toFixed(0)}</Text>
            </View>
            <Text style={styles.contribArrow}>=</Text>
            <View style={styles.contribSummaryItem}>
              <Text style={styles.contribSummaryLabel}>Your expense</Text>
              <Text style={[styles.contribSummaryValue, { color: '#7C3AED' }]}>₹{effectiveAmount.toFixed(0)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* ── Category Selection ──────────────────────────────── */}
      <Text style={styles.sectionTitle}>Where did you spend?</Text>
      <Text style={styles.sectionHint}>🤖 AI will auto-categorize — tap to override</Text>
      {/* Compact horizontal scrollable category row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
        {allCategories.map((cat) => (
          <TouchableOpacity key={cat.name}
            style={[styles.categoryChip, selectedCategory === cat.name && { borderColor: cat.color, borderWidth: 1.5, backgroundColor: cat.color + '15' }]}
            onPress={() => handleCategorySelect(cat.name)}>
            <Text style={styles.categoryChipEmoji}>{cat.emoji}</Text>
            <Text style={[styles.categoryChipName, selectedCategory === cat.name && { color: cat.color, fontWeight: 'bold' }]}>{cat.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sub Categories — Multi-select */}
      {showSubCategories && (
        <View style={styles.subCatContainer}>
          <Text style={styles.subCatTitle}>
            {currentCat!.emoji} What did you buy? <Text style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 'normal' }}>(select multiple)</Text>
          </Text>

          {/* Selected items as chips */}
          {selectedSubs.length > 0 && (
            <View style={styles.selectedChipsRow}>
              {selectedSubs.map(sub => (
                <View key={sub} style={[styles.selectedChip, { backgroundColor: currentCat!.color + '20', borderColor: currentCat!.color }]}>
                  <Text style={[styles.selectedChipText, { color: currentCat!.color }]}>{sub}</Text>
                  <TouchableOpacity onPress={() => removeSelectedSub(sub)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={[styles.selectedChipX, { color: currentCat!.color }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <View style={styles.subCatGrid}>
            {currentCat!.subs.map((sub) => {
              const SUB_EMOJIS: Record<string, string> = {
                Breakfast: '🌅', Lunch: '🍛', Dinner: '🌙', 'Coffee/Tea': '☕',
                Chips: '🍟', Biscuits: '🍪', 'Instant Noodles': '🍜', 'Cold Drink': '🥤', Namkeen: '🥜',
                Milk: '🥛', Paneer: '🧀', Curd: '🫙', Ghee: '🫕', Butter: '🧈',
                Vegetables: '🥬', Fruits: '🍎', Household: '🏠',
                Clothing: '👕', Electronics: '📱', Accessories: '👜', Online: '🛒',
                'Cab/Auto': '🚕', 'Bus/Train': '🚆', Flight: '✈️', Hotel: '🏨',
                Petrol: '⛽', Diesel: '🛢️', CNG: '💨',
                Movies: '🎬', Streaming: '📺', Gaming: '🎮', Events: '🎪',
                Medicine: '💊', Doctor: '🩺', Gym: '💪',
                Rent: '🏠', Maintenance: '🔧', Electricity: '⚡',
                Books: '📖', Course: '🎓', Fees: '🏫', Stationery: '✏️',
                Other: '📦',
              };
              const subEmoji = SUB_EMOJIS[sub] || '📦';
              const isSelected = selectedSubs.includes(sub);
              return (
                <TouchableOpacity key={sub}
                  style={[styles.subCatItem, isSelected && { backgroundColor: currentCat!.color, borderColor: currentCat!.color }]}
                  onPress={() => handleSubToggle(sub)}>
                  <Text style={styles.subCatEmoji}>{subEmoji}</Text>
                  <Text style={[styles.subCatText, isSelected && { color: 'white', fontWeight: 'bold' }]}>{sub}</Text>
                  {isSelected && <Text style={styles.subCatCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            {/* Add Custom inside sub-cat section */}
            <TouchableOpacity style={styles.addCustomChip} onPress={() => setShowAddCustom(true)}>
              <Text style={styles.addCustomEmoji}>＋</Text>
              <Text style={styles.addCustomChipText}>Custom</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Stationery Sub-subcategories */}
      {showStationerySubs && (
        <View style={styles.subCatContainer}>
          <Text style={styles.subCatTitle}>✏️ Which stationery item?</Text>
          <View style={styles.subCatGrid}>
            {STATIONERY_SUBS.map((ss) => (
              <TouchableOpacity key={ss}
                style={[styles.subCatItem, selectedSubSub === ss && { backgroundColor: '#1ABC9C', borderColor: '#1ABC9C' }]}
                onPress={() => setSelectedSubSub(ss)}>
                <Text style={[styles.subCatText, selectedSubSub === ss && { color: 'white', fontWeight: 'bold' }]}>{ss}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Quantity Counter — shown when a subcategory is selected */}
      {selectedSubs.length > 0 && !selectedSubs.includes('Other') && (
        <View style={styles.quantityContainer}>
          <View style={styles.quantityLeft}>
            <Text style={styles.quantityLabel}>🔢 How many items?</Text>
            {quantity > 1 && (
              <Text style={styles.quantityUnitPrice}>₹{(totalAmount / quantity).toFixed(2)} each</Text>
            )}
          </View>
          <View style={styles.quantityControls}>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(q => Math.max(1, q - 1))}>
              <Text style={styles.qtyBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.qtyValue}>{quantity}</Text>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(q => q + 1)}>
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Notes */}
      {selectedCategory && (
        <>
          <Text style={styles.sectionTitle}>
            {showNotesBox ? '📝 Please describe' : '📝 Add a note (optional)'}
          </Text>
          <TextInput
            style={styles.notesInput}
            placeholder={showNotesBox ? 'e.g. Maggi, Chips, Movie ticket...' : 'e.g. Lunch with friends...'}
            placeholderTextColor="#9CA3AF"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </>
      )}


      {/* Save Button */}
      <TouchableOpacity style={styles.saveButtonContainer} onPress={handleSave}>
        <LinearGradient colors={['#7C3AED', '#4F46E5']} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>
            {'💾 Save Transaction'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      {isFromPending && (
        <TouchableOpacity style={styles.skipButton} onPress={handleDismiss}>
          <Text style={styles.skipButtonText}>Skip for now →</Text>
        </TouchableOpacity>
      )}

      <View style={{ height: 40 }} />

      {/* Add Custom Category Modal */}
      <Modal visible={showAddCustom} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🏷️ Create Custom Category</Text>
            <Text style={styles.modalLabel}>Emoji (optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 🎁"
              placeholderTextColor="#9CA3AF"
              value={newCatEmoji}
              onChangeText={setNewCatEmoji}
              maxLength={4}
            />
            <Text style={styles.modalLabel}>Category Name *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Gifts, Charity, Pets..."
              placeholderTextColor="#9CA3AF"
              value={newCatName}
              onChangeText={setNewCatName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowAddCustom(false); setNewCatName(''); setNewCatEmoji(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveCustomCategory} style={styles.modalSaveContainer}>
                <LinearGradient colors={['#7C3AED', '#4F46E5']} style={styles.modalSave}>
                  <Text style={styles.modalSaveText}>Save Category</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: '#FFFFFF', padding: 20, paddingTop: 55, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backButton: { marginRight: 15 },
  backText: { color: '#7C3AED', fontSize: 16, fontWeight: 'bold' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A' },
  autoBadge: { backgroundColor: '#F5F3FF', marginHorizontal: 20, padding: 10, borderRadius: 12, marginBottom: 10, marginTop: 14, borderWidth: 1, borderColor: '#DDD6FE', alignItems: 'center' },
  autoBadgeText: { color: '#7C3AED', fontSize: 13, fontWeight: 'bold' },
  transactionCard: { marginHorizontal: 20, marginTop: 15, padding: 25, borderRadius: 24, alignItems: 'center', elevation: 10, marginBottom: 10 },
  merchantName: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  amount: { fontSize: 40, fontWeight: 'bold', color: 'white', marginTop: 8 },
  date: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 5 },
  aiLoading: { flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 8 },
  aiLoadingText: { color: 'white', fontSize: 13 },
  aiSuggestion: { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  aiSuggestionText: { color: 'white', fontSize: 13 },

  // Split Toggle
  splitToggleContainer: { marginHorizontal: 20, marginVertical: 10 },
  splitToggle: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  splitToggleActive: { borderColor: '#7C3AED', backgroundColor: '#F5F3FF' },
  splitToggleIcon: { fontSize: 24, marginRight: 12 },
  splitToggleTextContainer: { flex: 1 },
  splitToggleText: { fontSize: 15, fontWeight: 'bold', color: '#1A1A1A' },
  splitToggleTextActive: { color: '#7C3AED' },
  splitToggleSubtext: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  splitToggleSwitch: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#E5E7EB', justifyContent: 'center', padding: 2 },
  splitToggleSwitchActive: { backgroundColor: '#7C3AED' },
  splitToggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'white' },
  splitToggleDotActive: { alignSelf: 'flex-end' },

  // Section
  sectionTitle: { fontSize: 17, fontWeight: 'bold', marginHorizontal: 20, marginTop: 20, marginBottom: 12, color: '#1A1A1A' },

  // Split cards
  splitSummary: { marginHorizontal: 20, backgroundColor: '#F9FAFB', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  splitSummaryText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  splitCard: { marginHorizontal: 20, marginBottom: 12, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  splitCardActive: { borderColor: '#7C3AED', borderWidth: 2 },
  splitCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  splitCardNumber: { fontSize: 14, fontWeight: 'bold', color: '#7C3AED', backgroundColor: '#F5F3FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  removeSplitBtn: { backgroundColor: '#FFF1F2', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: '#FECDD3' },
  removeSplitText: { color: '#E11D48', fontSize: 14, fontWeight: 'bold' },
  splitLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600', marginBottom: 6 },
  splitRow: { marginBottom: 12 },

  // +/- Amount row
  splitAmountRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  splitAdjustBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#DDD6FE', alignItems: 'center', justifyContent: 'center' },
  splitAdjustText: { fontSize: 22, fontWeight: 'bold', color: '#7C3AED', lineHeight: 26 },
  splitAmountDisplay: { fontSize: 20, fontWeight: 'bold', color: '#1A1A1A', minWidth: 80, textAlign: 'center' },
  splitAmountInput: { flex: 1, backgroundColor: '#F9FAFB', color: '#1A1A1A', padding: 10, borderRadius: 10, fontSize: 14, borderWidth: 1, borderColor: '#E5E7EB', textAlign: 'center' },

  splitDescInput: { backgroundColor: '#F9FAFB', color: '#1A1A1A', padding: 12, borderRadius: 12, fontSize: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  splitCategoryToggle: { backgroundColor: '#F5F3FF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#DDD6FE', alignItems: 'center', marginTop: 4 },
  splitCategoryToggleText: { color: '#7C3AED', fontSize: 14, fontWeight: 'bold' },
  splitCategoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  splitCategoryItem: { width: '30%', backgroundColor: '#F9FAFB', padding: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  splitCategoryEmoji: { fontSize: 20, marginBottom: 3 },
  splitCategoryName: { fontSize: 10, color: '#6B7280', textAlign: 'center' },
  addSplitBtn: { marginHorizontal: 20, marginTop: 4, marginBottom: 4, padding: 16, backgroundColor: '#F5F3FF', borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#DDD6FE', borderStyle: 'dashed' },
  addSplitText: { color: '#7C3AED', fontSize: 15, fontWeight: 'bold' },

  // Hint text under section title
  sectionHint: { fontSize: 12, color: '#9CA3AF', marginHorizontal: 20, marginTop: -8, marginBottom: 8 },

  // Compact horizontal scrollable category chips (small — AI auto-categorizes)
  categoryScroll: { paddingHorizontal: 16, paddingVertical: 4, gap: 6 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', gap: 5, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  categoryChipEmoji: { fontSize: 14 },
  categoryChipName: { fontSize: 11, color: '#6B7280', fontWeight: '600' },

  // Sub categories — large, prominent tiles with emoji icons
  subCatContainer: { marginHorizontal: 20, marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#F3F4F6', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
  subCatTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 14 },
  subCatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  subCatItem: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 18, backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', minWidth: 90 },
  subCatEmoji: { fontSize: 28, marginBottom: 4 },
  subCatText: { fontSize: 13, color: '#6B7280', fontWeight: '700', textAlign: 'center' },

  // Add Custom chip (inside sub-cat) — styled like sub-cat tile
  addCustomChip: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 18, backgroundColor: '#F5F3FF', borderWidth: 1.5, borderColor: '#DDD6FE', borderStyle: 'dashed', minWidth: 90 },
  addCustomEmoji: { fontSize: 28, marginBottom: 4, color: '#7C3AED' },
  addCustomChipText: { fontSize: 13, color: '#7C3AED', fontWeight: '700' },

  // Quantity counter
  quantityContainer: { marginHorizontal: 20, marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#F3F4F6', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  quantityLeft: { flex: 1 },
  quantityLabel: { fontSize: 15, fontWeight: 'bold', color: '#1A1A1A' },
  quantityUnitPrice: { fontSize: 13, color: '#7C3AED', marginTop: 4, fontWeight: '600' },
  quantityControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qtyBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F5F3FF', borderWidth: 1.5, borderColor: '#DDD6FE', alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 24, fontWeight: 'bold', color: '#7C3AED', lineHeight: 28 },
  qtyValue: { fontSize: 26, fontWeight: 'bold', color: '#1A1A1A', minWidth: 36, textAlign: 'center' },

  // Notes
  notesInput: { marginHorizontal: 20, backgroundColor: '#FFFFFF', color: '#1A1A1A', padding: 16, borderRadius: 14, fontSize: 15, borderWidth: 1, borderColor: '#E5E7EB', textAlignVertical: 'top' },

  // Save
  saveButtonContainer: { marginHorizontal: 20, marginTop: 24, borderRadius: 16, overflow: 'hidden', elevation: 4, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  saveButton: { padding: 18, alignItems: 'center' },
  saveButtonText: { color: 'white', fontSize: 17, fontWeight: 'bold' },
  skipButton: { marginTop: 12, alignItems: 'center', padding: 14 },
  skipButtonText: { color: '#9CA3AF', fontSize: 14 },

  // Custom Category Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 20, textAlign: 'center' },
  modalLabel: { fontSize: 13, color: '#6B7280', fontWeight: '600', marginBottom: 8, marginTop: 12 },
  modalInput: { backgroundColor: '#F9FAFB', color: '#1A1A1A', padding: 15, borderRadius: 12, fontSize: 15, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 4 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalCancel: { flex: 1, backgroundColor: '#F9FAFB', padding: 16, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  modalCancelText: { color: '#6B7280', fontWeight: 'bold', fontSize: 15 },
  modalSaveContainer: { flex: 2, borderRadius: 14, overflow: 'hidden', elevation: 4, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
  modalSave: { padding: 16, alignItems: 'center' },
  modalSaveText: { color: 'white', fontWeight: 'bold', fontSize: 15 },

  // Toggle Row (Split + Contribution buttons)
  toggleRow: { flexDirection: 'row', marginHorizontal: 20, marginVertical: 10, gap: 10 },
  toggleBtn: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  toggleBtnActive: { borderColor: '#7C3AED', backgroundColor: '#F5F3FF' },
  toggleBtnActiveGreen: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  toggleBtnIcon: { fontSize: 24, marginBottom: 4 },
  toggleBtnText: { fontSize: 13, fontWeight: 'bold', color: '#6B7280' },
  toggleBtnTextActive: { color: '#7C3AED' },
  toggleBtnTextActiveGreen: { color: '#10B981' },

  // Effective amount badge on card
  effectiveAmountBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginTop: 6 },
  effectiveAmountText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },

  // Friend Contribution Section
  contribSection: { marginHorizontal: 20, marginBottom: 10, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, borderWidth: 1.5, borderColor: '#10B981', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  contribHeader: { marginBottom: 14 },
  contribTitle: { fontSize: 17, fontWeight: 'bold', color: '#1A1A1A' },
  contribSubtitle: { fontSize: 12, color: '#9CA3AF', marginTop: 3 },
  contribInputRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  contribInputGroup: { flex: 1 },
  contribInputLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600', marginBottom: 6 },
  contribInput: { backgroundColor: '#F9FAFB', color: '#1A1A1A', padding: 12, borderRadius: 12, fontSize: 15, borderWidth: 1, borderColor: '#E5E7EB' },
  contribSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F0FDF4', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#BBF7D0' },
  contribSummaryItem: { alignItems: 'center', flex: 1 },
  contribSummaryLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 4 },
  contribSummaryValue: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' },
  contribArrow: { fontSize: 16, color: '#9CA3AF', fontWeight: 'bold' },

  // Contribution toggle button (full-width)
  contribToggleBtn: { marginHorizontal: 20, marginVertical: 10, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, gap: 12 },
  contribToggleBtnActive: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },

  // Multi-select chips
  selectedChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12, marginTop: 4 },
  selectedChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, gap: 6 },
  selectedChipText: { fontSize: 13, fontWeight: 'bold' },
  selectedChipX: { fontSize: 14, fontWeight: 'bold' },
  subCatCheck: { position: 'absolute', top: 4, right: 6, fontSize: 12, color: 'white', fontWeight: 'bold' },
});