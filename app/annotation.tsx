import { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, StatusBar, Modal, Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTransactions, Split, ItemEntry } from '../context/TransactionContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const STATIONERY_SUBS = ['Pen', 'Pencil', 'Copy', 'Eraser', 'Ruler', 'Other'];
const DEFAULT_PRICES = [10, 20, 30, 50, 100];

type CategoryDef = { name: string; emoji: string; color: string; subs: string[] };

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

// ─── AI / Keyword Helpers ────────────────────────────────────────────────────

const getGeminiSuggestion = async (
  merchant: string, smsBody: string, allCategoryNames: string[]
): Promise<{ category: string; subCategory: string } | null> => {
  if (!GEMINI_API_KEY) return null;
  try {
    const prompt = `You are a bank transaction categorizer for an Indian user. Given this bank SMS, classify it into exactly one category and one subcategory.\n\nCategories and their subcategories:\n- Food: Breakfast, Lunch, Dinner, Coffee/Tea\n- Snacks: Chips, Biscuits, Instant Noodles, Cold Drink, Namkeen\n- Dairy: Milk, Paneer, Curd, Ghee, Butter\n- Groceries: Vegetables, Fruits, Household\n- Shopping: Clothing, Electronics, Accessories, Online\n- Travel: Cab/Auto, Bus/Train, Flight, Hotel\n- Fuel: Petrol, Diesel, CNG\n- Entertainment: Movies, Streaming, Gaming, Events\n- Health: Medicine, Doctor, Gym\n- Rent: Rent, Maintenance, Electricity\n- Education: Books, Course, Fees, Stationery\n- Other: (use only if nothing else fits)\n\nMerchant: ${merchant}\nFull SMS: ${smsBody || 'not available'}\n\nRespond with ONLY a JSON object like {"category":"Food","subCategory":"Lunch"} — no other text.`;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY.trim()}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 50 } }) }
    );
    if (!response.ok) {
      console.log('AI Categorize: API error', response.status);
      return null;
    }
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
  } catch (e) { console.log('AI Categorize error:', e); return null; }
};

const getAISuggestion = (merchant: string, smsBody: string = ''): { category: string; subCategory: string } => {
  const m = (merchant + ' ' + smsBody).toLowerCase();
  if (m.includes('kurkure') || m.includes('lays') || m.includes('chips') || m.includes('biscuit') || m.includes('parle') || m.includes('britannia') || m.includes('maggi') || m.includes('noodles') || m.includes('pepsi') || m.includes('coca cola') || m.includes('coke') || m.includes('sprite') || m.includes('thumbs up') || m.includes('thums up') || m.includes('7up') || m.includes('fanta') || m.includes('mirinda') || m.includes('redbull') || m.includes('cold drink') || m.includes('coldrink') || m.includes('frooti') || m.includes('maaza') || m.includes('real juice') || m.includes('tropicana') || m.includes('namkeen') || m.includes('mixture') || m.includes('bhujia') || m.includes('haldirams') || m.includes('act ii') || m.includes('popcorn') || m.includes('snack') || m.includes('munch') || m.includes('kit kat') || m.includes('dairy milk') || m.includes('5star') || m.includes('wafer'))
    return { category: 'Snacks', subCategory: m.includes('noodle') || m.includes('maggi') ? 'Instant Noodles' : m.includes('biscuit') || m.includes('parle') || m.includes('britannia') ? 'Biscuits' : m.includes('chips') || m.includes('lays') || m.includes('kurkure') ? 'Chips' : m.includes('pepsi') || m.includes('coke') || m.includes('sprite') || m.includes('cold drink') ? 'Cold Drink' : m.includes('namkeen') || m.includes('bhujia') ? 'Namkeen' : 'Other' };
  if (m.includes('amul') || m.includes('saras') || m.includes('milma') || m.includes('mother dairy') || m.includes('milk') || m.includes('paneer') || m.includes('curd') || m.includes('dahi') || m.includes('ghee') || m.includes('makhan') || m.includes('butter') || m.includes('cheese') || m.includes('dairy'))
    return { category: 'Dairy', subCategory: m.includes('paneer') ? 'Paneer' : m.includes('curd') || m.includes('dahi') ? 'Curd' : m.includes('ghee') ? 'Ghee' : m.includes('butter') || m.includes('makhan') ? 'Butter' : 'Milk' };
  if (m.includes('swiggy') || m.includes('zomato') || m.includes('dominos') || m.includes('mcdonalds') || m.includes('kfc') || m.includes('pizza') || m.includes('burger') || m.includes('cafe') || m.includes('restaurant') || m.includes('food') || m.includes('biryani') || m.includes('chai') || m.includes('starbucks') || m.includes('dunkin') || m.includes('barbeque') || m.includes('behrouz') || m.includes('faasos') || m.includes('box8') || m.includes('eatfit') || m.includes('subway') || m.includes('dineout') || m.includes('eatsure'))
    return { category: 'Food', subCategory: m.includes('breakfast') || m.includes('morning') ? 'Breakfast' : m.includes('coffee') || m.includes('chai') || m.includes('tea') || m.includes('starbucks') || m.includes('dunkin') ? 'Coffee/Tea' : m.includes('dinner') || m.includes('night') ? 'Dinner' : 'Lunch' };
  if (m.includes('amazon') || m.includes('flipkart') || m.includes('myntra') || m.includes('ajio') || m.includes('meesho') || m.includes('snapdeal') || m.includes('nykaa') || m.includes('tatacliq') || m.includes('shoppers stop') || m.includes('lifestyle') || m.includes('reliance digital') || m.includes('croma') || m.includes('decathlon') || m.includes('westside') || m.includes('zara') || m.includes('h&m') || m.includes('pantaloons') || m.includes('max fashion') || m.includes('lenskart') || m.includes('pepperfry') || m.includes('urban ladder') || m.includes('firstcry'))
    return { category: 'Shopping', subCategory: 'Online' };
  if (m.includes('petrol') || m.includes('fuel') || m.includes('bpcl') || m.includes('hpcl') || m.includes('iocl') || m.includes('indian oil') || m.includes('bharat petroleum') || m.includes('filling station') || m.includes('cng') || m.includes('diesel') || m.includes('nayara'))
    return { category: 'Fuel', subCategory: m.includes('cng') ? 'CNG' : m.includes('diesel') ? 'Diesel' : 'Petrol' };
  if (m.includes('uber') || m.includes('ola') || m.includes('rapido') || m.includes('flight') || m.includes('irctc') || m.includes('makemytrip') || m.includes('goibibo') || m.includes('redbus') || m.includes('indigo') || m.includes('spicejet') || m.includes('air india') || m.includes('metro') || m.includes('railway') || m.includes('oyo') || m.includes('cab') || m.includes('taxi') || m.includes('toll') || m.includes('fastag') || m.includes('parking'))
    return { category: 'Travel', subCategory: m.includes('flight') || m.includes('indigo') || m.includes('spicejet') ? 'Flight' : m.includes('oyo') || m.includes('hotel') ? 'Hotel' : m.includes('irctc') || m.includes('railway') || m.includes('metro') || m.includes('redbus') ? 'Bus/Train' : 'Cab/Auto' };
  if (m.includes('netflix') || m.includes('spotify') || m.includes('prime') || m.includes('hotstar') || m.includes('disney') || m.includes('jiocinema') || m.includes('zee5') || m.includes('sonyliv') || m.includes('bookmyshow') || m.includes('pvr') || m.includes('inox') || m.includes('cinepolis') || m.includes('steam') || m.includes('playstation') || m.includes('gaming') || m.includes('movie'))
    return { category: 'Entertainment', subCategory: m.includes('pvr') || m.includes('inox') || m.includes('movie') ? 'Movies' : m.includes('steam') || m.includes('gaming') ? 'Gaming' : 'Streaming' };
  if (m.includes('bigbasket') || m.includes('blinkit') || m.includes('zepto') || m.includes('instamart') || m.includes('jiomart') || m.includes('dmart') || m.includes('reliance fresh') || m.includes('grofers') || m.includes('bazaar') || m.includes('mart') || m.includes('grocer') || m.includes('kirana') || m.includes('nature basket') || m.includes('big bazaar') || m.includes('vegetables') || m.includes('fruits') || m.includes('sabzi'))
    return { category: 'Groceries', subCategory: m.includes('fruit') ? 'Fruits' : 'Vegetables' };
  if (m.includes('hospital') || m.includes('pharmacy') || m.includes('medical') || m.includes('apollo') || m.includes('medplus') || m.includes('netmeds') || m.includes('pharmeasy') || m.includes('1mg') || m.includes('doctor') || m.includes('clinic') || m.includes('gym') || m.includes('cult.fit') || m.includes('dental') || m.includes('wellness') || m.includes('practo'))
    return { category: 'Health', subCategory: m.includes('gym') || m.includes('cult') ? 'Gym' : m.includes('doctor') || m.includes('clinic') || m.includes('practo') ? 'Doctor' : 'Medicine' };
  if (m.includes('rent') || m.includes('electricity') || m.includes('water bill') || m.includes('maintenance') || m.includes('society') || m.includes('broadband') || m.includes('wifi') || m.includes('jio fiber') || m.includes('piped gas') || m.includes('property'))
    return { category: 'Rent', subCategory: m.includes('electric') ? 'Electricity' : m.includes('maintenance') || m.includes('society') ? 'Maintenance' : 'Rent' };
  if (m.includes('school') || m.includes('college') || m.includes('university') || m.includes('course') || m.includes('udemy') || m.includes('coursera') || m.includes('unacademy') || m.includes('byju') || m.includes('tuition') || m.includes('coaching') || m.includes('exam') || m.includes('books') || m.includes('stationery') || m.includes('pen') || m.includes('pencil') || m.includes('education') || m.includes('notebook') || m.includes('copy'))
    return { category: 'Education', subCategory: m.includes('stationery') || m.includes('pen') || m.includes('pencil') || m.includes('copy') || m.includes('notebook') ? 'Stationery' : m.includes('book') ? 'Books' : m.includes('course') || m.includes('udemy') ? 'Course' : 'Fees' };
  if (m.includes('recharge') || m.includes('jio') || m.includes('airtel') || m.includes('vodafone') || m.includes('postpaid') || m.includes('dth') || m.includes('tata sky'))
    return { category: 'Rent', subCategory: 'Other' };
  return { category: 'Other', subCategory: '' };
};

// ─── On-Device Receipt OCR via ML Kit ────────────────────────────────────────

// Words that indicate a line is NOT an item (totals, headers, etc.)
const SKIP_WORDS = [
  'total', 'subtotal', 'sub total', 'grand total', 'net total', 'net amount',
  'gross amt', 'gross amount', 'net amt', 'gross', 'net',
  'tax', 'gst', 'cgst', 'sgst', 'igst', 'vat', 'cess',
  'discount', 'savings', 'you saved', 'cashback', 'saved', 'off mrp',
  'change', 'cash tendered', 'cash', 'card', 'upi', 'payment', 'paid', 'balance',
  'thank', 'visit', 'welcome', 'invoice', 'bill no', 'receipt',
  'date', 'time', 'counter', 'cashier', 'customer', 'member',
  'phone', 'tel', 'mobile', 'email', 'address', 'gstin', 'tin:',
  'round off', 'rounding', 'round', 'service charge', 'delivery',
  'packaging', 'container', 'bag',
  'store no', 'store id', 'branch', 'outlet',
  'c-mem', 'mem no', 'member no', 'loyalty',
  'item descrip', 'item description', 'description', 'particulars',
  'computer generated', 'copy', 'original',
  'avenues', 'supermarts', 'ltd', 'pvt',
  'total items', 'no of items', 'items:',
  'cash memo', 'tax invoice', 'retail',
];

// Names that are just currency/junk — not real items
const JUNK_NAMES = ['rs', 'rs.', 'inr', 'mrp', 'amt', 'amount', 'rate', 'qty', 'price', 'no', 'sr'];

/**
 * Check if a number at the given position is part of a product size spec
 * e.g., "500G", "2L", "8PK", "200G", "250ML", "1KG", "1.5L"
 */
const isProductSize = (line: string, numIndex: number, numRaw: string): boolean => {
  const afterNum = line.substring(numIndex + numRaw.length).toUpperCase();
  // Check if immediately followed by a size unit (no space)
  return /^(G|GM|GMS|KG|L|LTR|ML|PK|PKT|PC|PCS|MM|CM|M)\b/i.test(afterNum);
};

/**
 * Parse raw OCR text from a receipt into structured items.
 * Handles common Indian tabular receipt formats (D-MART, BigBazaar, etc.)
 * Format: "ITEM_NAME  QTY  RATE  AMOUNT" or "SL. ITEM_NAME QTY RATE AMOUNT"
 */
const parseReceiptText = (rawText: string): ItemEntry[] => {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  const items: ItemEntry[] = [];

  console.log('Receipt Parser: Processing', lines.length, 'lines');

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Skip lines that match header/footer/total patterns
    if (SKIP_WORDS.some(w => lower.includes(w))) continue;
    // Skip lines that are just numbers, symbols, or dashes
    if (/^[\d\s.,₹$%*=\-\/\\:;]+$/.test(line)) continue;
    if (line.length < 3) continue;
    // Skip date/time lines like "17/03/2026 19:42"
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(line)) continue;
    // Skip lines that are all uppercase headers without numbers (like "D-MART", "KORAMANGALA, BANGALORE")
    if (/^[A-Z\s,.\-]+$/.test(line) && !/\d/.test(line)) continue;
    // Skip lines starting with Rs/Rs./INR followed by a number (these are totals/subtotals)
    if (/^\s*(rs\.?|inr|₹)\s*\d/i.test(line)) continue;

    // Find ALL numbers in this line (to handle tabular formats)
    const allNumbers = [...line.matchAll(/(\d+(?:[.,]\d{1,2})?)/g)].map(m => ({
      value: parseFloat(m[1].replace(',', '.')),
      index: m.index!,
      raw: m[0],
      isSize: isProductSize(line, m.index!, m[0]), // e.g., 500G, 2L
    }));

    // Need at least one number that looks like a price (not a product size)
    const priceNumbers = allNumbers.filter(n => !n.isSize);
    if (priceNumbers.length === 0) continue;

    // For tabular receipts (QTY RATE AMOUNT), the LAST non-size number is the total amount
    const lastNum = priceNumbers[priceNumbers.length - 1];
    const price = lastNum.value;
    
    // Skip unreasonable prices
    if (isNaN(price) || price < 5 || price > 100000) continue;

    // Extract quantity: find the first standalone small number that's not a product size
    let qty = 1;
    if (priceNumbers.length >= 3) {
      for (let i = 0; i < priceNumbers.length - 1; i++) {
        const n = priceNumbers[i];
        if (n.value >= 1 && n.value <= 99 && Number.isInteger(n.value)) {
          const charBefore = line[n.index - 1] || ' ';
          const charAfter = line[n.index + n.raw.length] || ' ';
          if (/\s/.test(charBefore) && /[\s.]/.test(charAfter)) {
            qty = n.value;
            break;
          }
        }
      }
    }

    // Extract item name: everything before the numeric columns start
    // A numeric column starts where we see a non-size number preceded by 2+ spaces
    let nameEndIndex = line.length;
    for (let i = 0; i < allNumbers.length; i++) {
      const n = allNumbers[i];
      if (n.isSize) continue; // Skip size numbers — they're part of the product name

      const textBefore = line.substring(0, n.index).trim();
      if (textBefore.length >= 2 && /[A-Za-z]/.test(textBefore)) {
        // Check for a clear column gap (2+ spaces before this number)
        const fiveCharBefore = line.substring(Math.max(0, n.index - 5), n.index);
        if (/\s{2,}/.test(fiveCharBefore)) {
          nameEndIndex = n.index;
          break;
        }
      }
    }

    let name = line.substring(0, nameEndIndex).trim();

    // Remove serial number prefix like "1.", "2.", "3."
    name = name.replace(/^\d{1,2}\.\s*/, '');

    // Clean up
    name = name
      .replace(/[₹$*#]+/g, '')
      .replace(/^[\-\s.,:;]+/, '')
      .replace(/[\-\s.,:;]+$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // Skip if name is too short or looks like a number
    if (name.length < 2) continue;
    if (/^\d+$/.test(name)) continue;
    // Must contain at least one letter
    if (!/[A-Za-z]/.test(name)) continue;
    // Skip junk names like "Rs", "Rs.", "INR" etc.
    if (JUNK_NAMES.includes(name.toLowerCase().replace(/\.$/, ''))) continue;

    // Capitalize first letter of each word
    name = name.replace(/\b\w/g, c => c.toUpperCase());
    if (name.length > 35) name = name.substring(0, 35);

    items.push({
      name,
      qty: Math.max(1, Math.min(qty, 99)),
      price: Math.round(price * 100) / 100,
    });
  }

  return items;
};

/**
 * Scan a receipt using on-device ML Kit Text Recognition.
 * No API key needed, works offline.
 */
const scanReceiptOnDevice = async (
  imageUri: string
): Promise<ItemEntry[] | null> => {
  try {
    console.log('Receipt OCR: Starting on-device text recognition...');
    const result = await TextRecognition.recognize(imageUri);
    
    if (!result || !result.text) {
      console.log('Receipt OCR: No text found in image');
      return null;
    }

    console.log('Receipt OCR: Raw text length:', result.text.length);
    console.log('Receipt OCR: Raw text preview:', result.text.substring(0, 300));

    const items = parseReceiptText(result.text);
    console.log('Receipt OCR: Parsed', items.length, 'items from text');

    if (items.length === 0) return null;
    return items;

  } catch (e) {
    console.log('Receipt OCR: On-device error:', e);
    return null;
  }
};

// ─── Price Memory Helpers ────────────────────────────────────────────────────

const getPriceMemory = async (itemName: string): Promise<number | null> => {
  try {
    const val = await AsyncStorage.getItem(`price_memory_${itemName}`);
    return val ? parseFloat(val) : null;
  } catch { return null; }
};

const savePriceMemory = async (itemName: string, price: number) => {
  try { await AsyncStorage.setItem(`price_memory_${itemName}`, price.toString()); } catch { }
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
  const [notes, setNotes] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [receiptScanning, setReceiptScanning] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  // Cart: structured items
  const [cartItems, setCartItems] = useState<ItemEntry[]>([]);

  // Price panel
  const [activePriceItem, setActivePriceItem] = useState<string | null>(null);
  const [pricePanelPrices, setPricePanelPrices] = useState<number[]>(DEFAULT_PRICES);
  const [lastUsedPrice, setLastUsedPrice] = useState<number | null>(null);
  const [customPriceInput, setCustomPriceInput] = useState('');
  const [showCustomPriceModal, setShowCustomPriceModal] = useState(false);

  // Friend contribution
  const [contributionEnabled, setContributionEnabled] = useState(false);
  const [contributionAmount, setContributionAmount] = useState('');
  const [friendName, setFriendName] = useState('');

  // Custom item modal (adds to current category's items, NOT a new category)
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');

  // Custom categories (kept for backwards compat)
  const [customCategories, setCustomCategories] = useState<CategoryDef[]>([]);
  // Custom items per category (persisted)
  const [customItems, setCustomItems] = useState<{ [catName: string]: string[] }>({});

  const allCategories: CategoryDef[] = [...BUILT_IN_CATEGORIES, ...customCategories];
  const allCategoryNames = allCategories.map(c => c.name);

  const totalAmount = parseFloat(amount);
  const friendContrib = parseFloat(contributionAmount) || 0;
  const effectiveAmount = contributionEnabled ? Math.max(0, totalAmount - friendContrib) : totalAmount;
  const cartTotal = cartItems.reduce((sum, item) => sum + item.qty * item.price, 0);

  const currentCat = allCategories.find(c => c.name === selectedCategory);
  // Merge built-in subs with custom items for this category
  const currentSubs = currentCat ? [...currentCat.subs, ...(customItems[selectedCategory] || [])] : [];
  const showSubCategories = !!(selectedCategory && currentCat && (currentCat.subs.length > 0 || (customItems[selectedCategory] || []).length > 0));

  // Load custom categories + custom items from Firestore
  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.data();
        if (data?.customCategories) setCustomCategories(data.customCategories);
        if (data?.customItems) setCustomItems(data.customItems);
      } catch (e) { }
    };
    load();
  }, []);

  // Auto-trigger receipt scan when navigated from home screen
  useEffect(() => {
    if (params.scanReceipt === 'true') {
      const timer = setTimeout(() => {
        Alert.alert(
          'Scan Receipt',
          'Choose how to capture your receipt',
          [
            { text: 'Camera', onPress: () => handleScanReceipt(true) },
            { text: 'Gallery', onPress: () => handleScanReceipt(false) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }, 400);
      return () => clearTimeout(timer);
    }
  }, []);

  // AI classification
  useEffect(() => {
    setAiLoading(true);
    const classify = async () => {
      const geminiResult = await getGeminiSuggestion(merchant, message, allCategoryNames);
      if (geminiResult) {
        setSelectedCategory(geminiResult.category);
        setAiLoading(false);
        return;
      }
      const suggestion = getAISuggestion(merchant, message);
      setSelectedCategory(suggestion.category);
      setAiLoading(false);
    };
    classify();
  }, []);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleCategorySelect = (catName: string) => {
    setSelectedCategory(catName);
    setActivePriceItem(null);
    setCartItems([]);
    setNotes('');
  };

  // ─── Receipt Scan Handler ──────────────────────────────────────────────────

  const handleScanReceipt = async (useCamera: boolean) => {
    try {
      console.log('Receipt Scan: Starting...', useCamera ? 'Camera' : 'Gallery');
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        console.log('Receipt Scan: Camera permission:', status);
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Camera permission is required to scan receipts.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          base64: false, // ML Kit uses URI, not base64
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        console.log('Receipt Scan: Gallery permission:', status);
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Gallery permission is required to pick receipt photos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          base64: false, // ML Kit uses URI, not base64
        });
      }

      if (result.canceled) {
        console.log('Receipt Scan: User cancelled');
        return;
      }
      if (!result.assets?.[0]?.uri) {
        console.log('Receipt Scan: No image URI in result');
        Alert.alert('Error', 'Could not get image. Please try again.');
        return;
      }

      const imageUri = result.assets[0].uri;
      console.log('Receipt Scan: Got image:', imageUri);
      setReceiptScanning(true);
      setReceiptPreview(imageUri);

      // Use on-device ML Kit OCR (no API key needed)
      const items = await scanReceiptOnDevice(imageUri);
      console.log('Receipt Scan: Result:', items ? `${items.length} items` : 'null');

      if (!items || items.length === 0) {
        setReceiptScanning(false);
        setReceiptPreview(null);
        Alert.alert('😕 Could not read receipt', 'Try taking a clearer photo with good lighting, or add items manually.');
        return;
      }

      // Auto-categorize: find the most common category among scanned items
      const categoryCounts: Record<string, number> = {};
      items.forEach(item => {
        const suggestion = getAISuggestion(item.name);
        const cat = suggestion.category;
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
      const dominantCategory = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Other';

      setSelectedCategory(dominantCategory);
      setCartItems(items);
      setReceiptScanning(false);

      const totalScanned = items.reduce((sum, i) => sum + i.qty * i.price, 0);
      Alert.alert(
        '✅ Receipt Scanned!',
        `Found ${items.length} items totalling ₹${totalScanned.toFixed(0)}.\nYou can edit items below.`
      );
    } catch (e) {
      console.log('Scan receipt error:', e);
      setReceiptScanning(false);
      setReceiptPreview(null);
      Alert.alert('Error', 'Something went wrong while scanning. Please try again.');
    }
  };

  const showScanOptions = () => {
    Alert.alert(
      '📷 Scan Receipt',
      'Choose how to capture your receipt',
      [
        { text: '📸 Camera', onPress: () => handleScanReceipt(true) },
        { text: '🖼️ Gallery', onPress: () => handleScanReceipt(false) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleItemTap = async (itemName: string) => {
    if (itemName === 'Other') {
      setActivePriceItem(null);
      return;
    }

    // If price panel is already open for this item AND it's in cart, toggle it off (remove)
    if (activePriceItem === itemName) {
      const existingIdx = cartItems.findIndex(i => i.name === itemName);
      if (existingIdx !== -1) {
        setCartItems(prev => prev.filter((_, i) => i !== existingIdx));
      }
      setActivePriceItem(null);
      return;
    }

    // If item is already in cart, just open price panel to let user change the price
    const existingIdx = cartItems.findIndex(i => i.name === itemName);
    if (existingIdx !== -1) {
      const lastPrice = await getPriceMemory(itemName);
      setLastUsedPrice(lastPrice);
      let prices = [...DEFAULT_PRICES];
      if (lastPrice && !prices.includes(lastPrice)) prices = [lastPrice, ...prices];
      setPricePanelPrices(prices);
      setActivePriceItem(itemName);
      return;
    }

    // Auto-add to cart with remaining amount
    const remaining = Math.max(0, totalAmount - cartTotal);
    const itemPrice = remaining > 0 ? remaining : totalAmount;

    // Always default to remaining amount — last-used price is just an option in the panel
    const lastPrice = await getPriceMemory(itemName);

    setCartItems(prev => [...prev, { name: itemName, qty: 1, price: itemPrice }]);

    // Also open price panel so user can change it
    setLastUsedPrice(lastPrice);
    let prices = [...DEFAULT_PRICES];
    // Add the auto-filled price and last-used price to options
    if (itemPrice && !prices.includes(itemPrice)) prices = [itemPrice, ...prices];
    if (lastPrice && !prices.includes(lastPrice)) prices = [lastPrice, ...prices];
    // Sort prices ascending for a clean look
    prices = [...new Set(prices)].sort((a, b) => a - b);
    setPricePanelPrices(prices);
    setActivePriceItem(itemName);
  };

  const handlePriceSelect = async (itemName: string, price: number) => {
    // Save price memory
    await savePriceMemory(itemName, price);

    // Update existing cart item's price if it exists, otherwise add new
    setCartItems(prev => {
      const existingIdx = prev.findIndex(i => i.name === itemName);
      if (existingIdx !== -1) {
        // Update the price of the existing item
        return prev.map((item, i) => i === existingIdx ? { ...item, price } : item);
      }
      return [...prev, { name: itemName, qty: 1, price }];
    });

    // Close price panel
    setActivePriceItem(null);
  };

  const handleCustomPrice = () => {
    setCustomPriceInput('');
    setShowCustomPriceModal(true);
  };

  const handleCustomPriceSave = async () => {
    const price = parseFloat(customPriceInput);
    if (!price || price <= 0 || !activePriceItem) {
      Alert.alert('Please enter a valid price');
      return;
    }
    setShowCustomPriceModal(false);
    await handlePriceSelect(activePriceItem, price);
  };

  const removeCartItem = (idx: number) => {
    setCartItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateCartQty = (idx: number, delta: number) => {
    setCartItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const newQty = Math.max(1, item.qty + delta);
      return { ...item, qty: newQty };
    }));
  };

  // Custom item: add to selected category's items (NOT a new category)
  const handleSaveCustomItem = async () => {
    const trimmed = newItemName.trim();
    if (!trimmed) { Alert.alert('Please enter an item name'); return; }
    if (!selectedCategory) { Alert.alert('Please select a category first'); return; }
    if (currentSubs.includes(trimmed)) { Alert.alert('This item already exists'); return; }

    const updated = { ...customItems, [selectedCategory]: [...(customItems[selectedCategory] || []), trimmed] };
    setCustomItems(updated);
    setShowAddItemModal(false);
    setNewItemName('');

    // Persist
    const user = auth.currentUser;
    if (user) {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        await setDoc(doc(db, 'users', user.uid), { ...(snap.data() || {}), customItems: updated });
      } catch (e) { }
    }
  };

  const performSave = async () => {
    const finalCategory = selectedCategory;
    const itemNames = cartItems.map(i => i.name);
    const finalSubCategory = itemNames.length > 0 ? itemNames.join(', ') : '';
    const itemsNote = cartItems.map(i => `${i.name} ×${i.qty} @₹${i.price}`).join(' + ');
    const contribNote = contributionEnabled && friendContrib > 0
      ? `🤝 ${friendName || 'Friend'} pays back ₹${friendContrib.toFixed(0)} — your share: ₹${effectiveAmount.toFixed(0)}`
      : '';
    const finalNotes = [itemsNote, contribNote, notes].filter(Boolean).join(' — ');

    const savedAmount = cartTotal > 0 ? (contributionEnabled ? Math.max(0, cartTotal - friendContrib) : cartTotal) : (contributionEnabled ? effectiveAmount : totalAmount);

    if (isFromPending) {
      addTransaction({ amount: savedAmount, merchant, date, message, category: finalCategory, subCategory: finalSubCategory, notes: finalNotes, items: cartItems.length > 0 ? cartItems : undefined });
      setPendingTransaction(null);
    } else {
      updateTransaction(index, finalCategory, finalNotes, undefined, finalSubCategory, txnId, cartItems.length > 0 ? cartItems : undefined);
    }

    const checkBudgetAlert = async (category: string, txnAmount: number) => {
      if (!category) return false;
      const budget = parseFloat(budgets[category] || '0');
      if (budget <= 0) return false;
      const categorySpent = transactions.filter(t => t.category === category).reduce((sum, t) => sum + t.amount, 0) + txnAmount;
      const percent = (categorySpent / budget) * 100;
      if (percent >= 100) {
        Alert.alert('🚨 Budget Exceeded!', `${category}: Spent ₹${categorySpent.toFixed(0)} of ₹${budget.toFixed(0)}`, [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]);
        if (Notifications?.scheduleNotificationAsync) { await Notifications.scheduleNotificationAsync({ content: { title: '🚨 Budget Exceeded!', body: `${category}: ₹${categorySpent.toFixed(0)} of ₹${budget.toFixed(0)}`, sound: true }, trigger: null }); }
        return true;
      } else if (percent >= 80) {
        Alert.alert('⚠️ 80% Budget Used!', `${category} is at ${percent.toFixed(0)}%!\nRemaining: ₹${(budget - categorySpent).toFixed(0)}`, [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]);
        if (Notifications?.scheduleNotificationAsync) { await Notifications.scheduleNotificationAsync({ content: { title: '⚠️ Budget Warning!', body: `${category}: ${percent.toFixed(0)}% used`, sound: true }, trigger: null }); }
        return true;
      }
      return false;
    };

    const alerted = await checkBudgetAlert(finalCategory, savedAmount);
    if (alerted) return;

    const saveMsg = itemNames.length > 0
      ? `Tagged as ${finalCategory} › ${itemNames.join(' + ')}`
      : `Tagged as ${finalCategory}`;
    Alert.alert('✅ Saved!', saveMsg, [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]);
  };

  const handleSave = async () => {
    if (!selectedCategory) { Alert.alert('Please select a category!'); return; }

    // If cart total exceeds the transaction amount, warn the user
    if (cartItems.length > 0 && cartTotal > totalAmount) {
      const exceeding = cartTotal - totalAmount;
      Alert.alert(
        '🚫 Cart Exceeds Transaction',
        `Your cart total (₹${cartTotal.toFixed(0)}) is ₹${exceeding.toFixed(0)} more than the transaction amount (₹${totalAmount.toFixed(0)}).\n\nPlease remove items or adjust quantities.`
      );
      return;
    }

    // If user has items in cart but cart total < transaction amount, warn about uncategorized amount
    if (cartItems.length > 0 && cartTotal < totalAmount) {
      const remaining = totalAmount - cartTotal;
      Alert.alert(
        '⚠️ Uncategorized Amount',
        `₹${remaining.toFixed(0)} out of ₹${totalAmount.toFixed(0)} is not categorized yet.\n\n🛒 Cart total: ₹${cartTotal.toFixed(0)}\n💰 Transaction: ₹${totalAmount.toFixed(0)}\n❓ Remaining: ₹${remaining.toFixed(0)}`,
        [
          { text: 'Go Back & Add Items', style: 'cancel' },
          { text: 'Save Anyway', style: 'destructive', onPress: () => performSave() }
        ]
      );
      return;
    }

    performSave();
  };

  const handleDismiss = () => {
    if (isFromPending) setPendingTransaction(null);
    router.replace('/(tabs)');
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar barStyle="light-content" backgroundColor="#1E1B4B" />

      {/* Header */}
      <LinearGradient colors={['#1E1B4B', '#312E81']} style={styles.header}>
        <TouchableOpacity onPress={handleDismiss} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color="#C4B5FD" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{isFromPending ? 'New Transaction!' : 'Categorize'}</Text>
          <Text style={styles.headerSub}>{isFromPending ? 'Auto-detected from SMS' : 'Add details to your transaction'}</Text>
        </View>
        {isFromPending && <Ionicons name="notifications" size={20} color="#FBBF24" />}
      </LinearGradient>

      {/* Transaction Card */}
      <LinearGradient colors={['#7C3AED', '#4F46E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.transactionCard}>
        <Text style={styles.merchantName}>{merchant}</Text>
        <Text style={styles.amountText}>₹{totalAmount.toFixed(2)}</Text>
        {contributionEnabled && friendContrib > 0 && (
          <View style={styles.effectiveAmountBadge}>
            <Text style={styles.effectiveAmountText}>Your share: ₹{effectiveAmount.toFixed(0)}</Text>
          </View>
        )}
        <Text style={styles.date}>{date ? new Date(parseInt(date)).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</Text>
        {aiLoading ? (
          <View style={styles.aiLoading}>
            <ActivityIndicator size="small" color="white" />
            <Text style={styles.aiLoadingText}>AI is analyzing...</Text>
          </View>
        ) : selectedCategory ? (
          <View style={styles.aiSuggestion}>
            <Text style={styles.aiSuggestionText}>AI suggested: {selectedCategory}</Text>
          </View>
        ) : null}
      </LinearGradient>

      {/* ── Receipt Scan Button ──────────────────────────── */}
      {receiptScanning ? (
        <View style={styles.receiptScanningCard}>
          {receiptPreview && (
            <Image source={{ uri: receiptPreview }} style={styles.receiptPreviewImage} />
          )}
          <View style={styles.receiptScanningContent}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={styles.receiptScanningTitle}>AI is reading your receipt...</Text>
            <Text style={styles.receiptScanningHint}>Extracting items, prices & quantities</Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.scanReceiptBtn} onPress={showScanOptions}>
          <Ionicons name="camera" size={26} color="#7C3AED" />
          <View style={{ flex: 1 }}>
            <Text style={styles.scanReceiptTitle}>Scan Receipt</Text>
            <Text style={styles.scanReceiptHint}>
              {cartItems.length > 0 && receiptPreview
                ? `✅ ${cartItems.length} items scanned — tap to re-scan`
                : 'Auto-fill items from receipt photo'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#7C3AED" />
        </TouchableOpacity>
      )}

      {/* Friend Contribution Toggle */}
      <TouchableOpacity
        style={[styles.contribToggleBtn, contributionEnabled && styles.contribToggleBtnActive]}
        onPress={() => setContributionEnabled(!contributionEnabled)}>
        <Ionicons name="people" size={22} color={contributionEnabled ? '#10B981' : '#9CA3AF'} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.toggleBtnText, contributionEnabled && styles.toggleBtnTextActiveGreen]}>Friend Contribution</Text>
          <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{contributionEnabled ? 'Tap to remove' : 'Split cost with a friend'}</Text>
        </View>
        <View style={[styles.splitToggleSwitch, contributionEnabled && { backgroundColor: '#10B981' }]}>
          <View style={[styles.splitToggleDot, contributionEnabled && styles.splitToggleDotActive]} />
        </View>
      </TouchableOpacity>

      {contributionEnabled && (
        <View style={styles.contribSection}>
          <View style={styles.contribInputRow}>
            <View style={styles.contribInputGroup}>
              <Text style={styles.contribInputLabel}>👤 Friend's name</Text>
              <TextInput style={styles.contribInput} placeholder="e.g. Rahul" placeholderTextColor="#9CA3AF" value={friendName} onChangeText={setFriendName} />
            </View>
            <View style={styles.contribInputGroup}>
              <Text style={styles.contribInputLabel}>💰 Their share</Text>
              <TextInput style={styles.contribInput} placeholder="e.g. 50" placeholderTextColor="#9CA3AF" value={contributionAmount} onChangeText={setContributionAmount} keyboardType="numeric" />
            </View>
          </View>
          <View style={styles.contribSummary}>
            <View style={styles.contribSummaryItem}><Text style={styles.contribSummaryLabel}>Total Paid</Text><Text style={styles.contribSummaryValue}>₹{totalAmount.toFixed(0)}</Text></View>
            <Text style={styles.contribArrow}>→</Text>
            <View style={styles.contribSummaryItem}><Text style={styles.contribSummaryLabel}>{friendName || 'Friend'} pays</Text><Text style={[styles.contribSummaryValue, { color: '#10B981' }]}>₹{friendContrib.toFixed(0)}</Text></View>
            <Text style={styles.contribArrow}>=</Text>
            <View style={styles.contribSummaryItem}><Text style={styles.contribSummaryLabel}>Your expense</Text><Text style={[styles.contribSummaryValue, { color: '#7C3AED' }]}>₹{effectiveAmount.toFixed(0)}</Text></View>
          </View>
        </View>
      )}

      {/* ── Category Selection ──────────────────────────────── */}
      <View style={styles.sectionHeaderRow}>
        <Ionicons name="grid" size={16} color="#6D28D9" />
        <Text style={styles.sectionTitle}>Where did you spend?</Text>
      </View>
      <Text style={styles.sectionHint}>AI will auto-categorize — tap to override</Text>
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

      {/* Sub Categories — Item tiles with price panel */}
      {showSubCategories && (
        <View style={styles.subCatContainer}>
          <Text style={styles.subCatTitle}>
            {currentCat!.emoji} What did you buy? <Text style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 'normal' }}>(tap for price)</Text>
          </Text>

          <View style={styles.subCatGrid}>
            {currentSubs.filter(s => s !== 'Other').map((sub) => {
              const subEmoji = SUB_EMOJIS[sub] || '📦';
              const isInCart = cartItems.some(i => i.name === sub);
              const isActive = activePriceItem === sub;
              return (
                <TouchableOpacity key={sub}
                  style={[styles.subCatItem, isInCart && { backgroundColor: currentCat!.color, borderColor: currentCat!.color }, isActive && { borderColor: '#7C3AED', borderWidth: 2 }]}
                  onPress={() => handleItemTap(sub)}>
                  <Text style={styles.subCatEmoji}>{subEmoji}</Text>
                  <Text style={[styles.subCatText, isInCart && { color: 'white', fontWeight: 'bold' }]}>{sub}</Text>
                  {isInCart && <Text style={styles.subCatCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            {/* Add Custom Item */}
            <TouchableOpacity style={styles.addCustomChip} onPress={() => setShowAddItemModal(true)}>
              <Text style={styles.addCustomEmoji}>＋</Text>
              <Text style={styles.addCustomChipText}>Custom</Text>
            </TouchableOpacity>
          </View>

          {/* ── Price Selection Panel ──────────────────────── */}
          {activePriceItem && (
            <View style={styles.pricePanelContainer}>
              <Text style={styles.pricePanelTitle}>💰 Change price for {activePriceItem} {cartItems.find(i => i.name === activePriceItem) ? `(currently ₹${cartItems.find(i => i.name === activePriceItem)!.price})` : ''}</Text>
              <View style={styles.pricePanelGrid}>
                {pricePanelPrices.map((price) => (
                  <TouchableOpacity key={price} style={[styles.priceChip, lastUsedPrice === price && styles.priceChipLast]}
                    onPress={() => handlePriceSelect(activePriceItem, price)}>
                    <Text style={[styles.priceChipText, lastUsedPrice === price && styles.priceChipTextLast]}>₹{price}</Text>
                    {lastUsedPrice === price && <Text style={styles.priceChipBadge}>last</Text>}
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.priceChipCustom} onPress={handleCustomPrice}>
                  <Text style={styles.priceChipCustomText}>✏️ Custom</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── Cart Summary ──────────────────────────────────── */}
      {cartItems.length > 0 && (
        <View style={styles.cartContainer}>
          <Text style={styles.cartTitle}>🛒 Your Cart</Text>
          {cartItems.map((item, idx) => (
            <View key={`${item.name}-${item.price}-${idx}`} style={styles.cartRow}>
              <View style={styles.cartItemInfo}>
                <Text style={styles.cartItemName}>{item.name}</Text>
                <Text style={styles.cartItemDetail}>₹{item.price} each</Text>
              </View>
              <View style={styles.cartQtyControls}>
                <TouchableOpacity style={styles.cartQtyBtn} onPress={() => updateCartQty(idx, -1)}>
                  <Text style={styles.cartQtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.cartQtyValue}>{item.qty}</Text>
                <TouchableOpacity style={styles.cartQtyBtn} onPress={() => updateCartQty(idx, 1)}>
                  <Text style={styles.cartQtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.cartItemTotal}>₹{(item.qty * item.price).toFixed(0)}</Text>
              <TouchableOpacity onPress={() => removeCartItem(idx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.cartRemove}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={styles.cartTotalRow}>
            <Text style={styles.cartTotalLabel}>Cart Total</Text>
            <Text style={styles.cartTotalValue}>₹{cartTotal.toFixed(0)}</Text>
          </View>
        </View>
      )}

      {/* Notes */}
      {selectedCategory && (
        <>
          <Text style={styles.sectionTitle}>📝 Add a note (optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="e.g. Lunch with friends..."
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
            {cartTotal > 0 ? `💾 Save — ₹${cartTotal.toFixed(0)}` : '💾 Save Transaction'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      {isFromPending && (
        <TouchableOpacity style={styles.skipButton} onPress={handleDismiss}>
          <Text style={styles.skipButtonText}>Skip for now →</Text>
        </TouchableOpacity>
      )}

      <View style={{ height: 40 }} />

      {/* Add Custom Item Modal */}
      <Modal visible={showAddItemModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🏷️ Add Custom Item</Text>
            <Text style={styles.modalSubtitle}>Adding to: {currentCat?.emoji} {selectedCategory}</Text>
            <Text style={styles.modalLabel}>Item Name *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Chocolate, Juice..."
              placeholderTextColor="#9CA3AF"
              value={newItemName}
              onChangeText={setNewItemName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowAddItemModal(false); setNewItemName(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveCustomItem} style={styles.modalSaveContainer}>
                <LinearGradient colors={['#7C3AED', '#4F46E5']} style={styles.modalSave}>
                  <Text style={styles.modalSaveText}>Add Item</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom Price Modal */}
      <Modal visible={showCustomPriceModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>✏️ Enter Price</Text>
            <Text style={styles.modalSubtitle}>For: {activePriceItem}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter price in ₹"
              placeholderTextColor="#9CA3AF"
              value={customPriceInput}
              onChangeText={setCustomPriceInput}
              keyboardType="numeric"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCustomPriceModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCustomPriceSave} style={styles.modalSaveContainer}>
                <LinearGradient colors={['#7C3AED', '#4F46E5']} style={styles.modalSave}>
                  <Text style={styles.modalSaveText}>Add</Text>
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
  container: { flex: 1, backgroundColor: '#F8F7FF' },
  header: { paddingTop: 52, paddingBottom: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  headerSub: { fontSize: 12, color: '#A5B4FC', fontWeight: '500', marginTop: 2 },
  autoBadge: { backgroundColor: '#F5F3FF', marginHorizontal: 20, padding: 10, borderRadius: 12, marginBottom: 10, marginTop: 14, borderWidth: 1, borderColor: '#DDD6FE', alignItems: 'center' },
  autoBadgeText: { color: '#7C3AED', fontSize: 13, fontWeight: 'bold' },
  transactionCard: { marginHorizontal: 20, marginTop: 15, padding: 25, borderRadius: 24, alignItems: 'center', elevation: 10, marginBottom: 10 },

  // Receipt scan
  scanReceiptBtn: { marginHorizontal: 20, marginVertical: 10, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#EDE9FE', elevation: 2, gap: 12 },
  scanReceiptTitle: { fontSize: 14, fontWeight: '700', color: '#7C3AED' },
  scanReceiptHint: { fontSize: 11, color: '#9CA3AF', marginTop: 2, fontWeight: '500' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 20, marginBottom: 4, gap: 8 },
  receiptScanningCard: { marginHorizontal: 20, marginVertical: 10, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1.5, borderColor: '#DDD6FE', overflow: 'hidden', elevation: 3 },
  receiptPreviewImage: { width: '100%', height: 120, resizeMode: 'cover' },
  receiptScanningContent: { padding: 20, alignItems: 'center', gap: 10 },
  receiptScanningTitle: { fontSize: 16, fontWeight: 'bold', color: '#7C3AED', marginTop: 4 },
  receiptScanningHint: { fontSize: 12, color: '#9CA3AF' },
  merchantName: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  amountText: { fontSize: 40, fontWeight: 'bold', color: 'white', marginTop: 8 },
  date: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 5 },
  aiLoading: { flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 8 },
  aiLoadingText: { color: 'white', fontSize: 13 },
  aiSuggestion: { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  aiSuggestionText: { color: 'white', fontSize: 13 },
  effectiveAmountBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginTop: 6 },
  effectiveAmountText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },

  sectionTitle: { fontSize: 17, fontWeight: 'bold', marginHorizontal: 20, marginTop: 20, marginBottom: 12, color: '#1A1A1A' },
  sectionHint: { fontSize: 12, color: '#9CA3AF', marginHorizontal: 20, marginTop: -8, marginBottom: 8 },

  categoryScroll: { paddingHorizontal: 16, paddingVertical: 4, gap: 6 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', gap: 5, elevation: 1 },
  categoryChipEmoji: { fontSize: 14 },
  categoryChipName: { fontSize: 11, color: '#6B7280', fontWeight: '600' },

  subCatContainer: { marginHorizontal: 20, marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#F3F4F6', elevation: 2 },
  subCatTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 14 },
  subCatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  subCatItem: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 18, backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E5E7EB', minWidth: 90 },
  subCatEmoji: { fontSize: 28, marginBottom: 4 },
  subCatText: { fontSize: 13, color: '#6B7280', fontWeight: '700', textAlign: 'center' },
  subCatCheck: { position: 'absolute', top: 4, right: 6, fontSize: 12, color: 'white', fontWeight: 'bold' },
  addCustomChip: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 18, backgroundColor: '#F5F3FF', borderWidth: 1.5, borderColor: '#DDD6FE', borderStyle: 'dashed', minWidth: 90 },
  addCustomEmoji: { fontSize: 28, marginBottom: 4, color: '#7C3AED' },
  addCustomChipText: { fontSize: 13, color: '#7C3AED', fontWeight: '700' },

  // Price panel
  pricePanelContainer: { marginTop: 14, backgroundColor: '#F5F3FF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#DDD6FE' },
  pricePanelTitle: { fontSize: 14, fontWeight: 'bold', color: '#7C3AED', marginBottom: 10 },
  pricePanelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priceChip: { backgroundColor: '#FFFFFF', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center' },
  priceChipLast: { borderColor: '#7C3AED', backgroundColor: '#F5F3FF' },
  priceChipText: { fontSize: 15, fontWeight: 'bold', color: '#1A1A1A' },
  priceChipTextLast: { color: '#7C3AED' },
  priceChipBadge: { fontSize: 9, color: '#7C3AED', fontWeight: '700', marginTop: 2 },
  priceChipCustom: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: '#DDD6FE', borderStyle: 'dashed' },
  priceChipCustomText: { fontSize: 13, fontWeight: 'bold', color: '#7C3AED' },

  // Cart
  cartContainer: { marginHorizontal: 20, marginTop: 14, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: '#7C3AED20', elevation: 2 },
  cartTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 12 },
  cartRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 8 },
  cartItemInfo: { flex: 1 },
  cartItemName: { fontSize: 14, fontWeight: 'bold', color: '#1A1A1A' },
  cartItemDetail: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  cartQtyControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cartQtyBtn: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#DDD6FE', alignItems: 'center', justifyContent: 'center' },
  cartQtyBtnText: { fontSize: 18, fontWeight: 'bold', color: '#7C3AED', lineHeight: 20 },
  cartQtyValue: { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A', minWidth: 24, textAlign: 'center' },
  cartItemTotal: { fontSize: 14, fontWeight: 'bold', color: '#7C3AED', minWidth: 50, textAlign: 'right' },
  cartRemove: { fontSize: 16, color: '#EF4444', fontWeight: 'bold', marginLeft: 4 },
  cartTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1.5, borderTopColor: '#7C3AED20' },
  cartTotalLabel: { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A' },
  cartTotalValue: { fontSize: 20, fontWeight: 'bold', color: '#7C3AED' },

  notesInput: { marginHorizontal: 20, backgroundColor: '#FFFFFF', color: '#1A1A1A', padding: 16, borderRadius: 14, fontSize: 15, borderWidth: 1, borderColor: '#E5E7EB', textAlignVertical: 'top' },
  saveButtonContainer: { marginHorizontal: 20, marginTop: 24, borderRadius: 16, overflow: 'hidden', elevation: 4 },
  saveButton: { padding: 18, alignItems: 'center' },
  saveButtonText: { color: 'white', fontSize: 17, fontWeight: 'bold' },
  skipButton: { marginTop: 12, alignItems: 'center', padding: 14 },
  skipButtonText: { color: '#9CA3AF', fontSize: 14 },

  // Toggles
  splitToggleSwitch: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#E5E7EB', justifyContent: 'center', padding: 2 },
  splitToggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'white' },
  splitToggleDotActive: { alignSelf: 'flex-end' },
  toggleBtnIcon: { fontSize: 24, marginBottom: 4 },
  toggleBtnText: { fontSize: 13, fontWeight: 'bold', color: '#6B7280' },
  toggleBtnTextActiveGreen: { color: '#10B981' },
  contribToggleBtn: { marginHorizontal: 20, marginVertical: 10, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', elevation: 1, gap: 12 },
  contribToggleBtnActive: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  contribSection: { marginHorizontal: 20, marginBottom: 10, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, borderWidth: 1.5, borderColor: '#10B981', elevation: 2 },
  contribInputRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  contribInputGroup: { flex: 1 },
  contribInputLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600', marginBottom: 6 },
  contribInput: { backgroundColor: '#F9FAFB', color: '#1A1A1A', padding: 12, borderRadius: 12, fontSize: 15, borderWidth: 1, borderColor: '#E5E7EB' },
  contribSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F0FDF4', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#BBF7D0' },
  contribSummaryItem: { alignItems: 'center', flex: 1 },
  contribSummaryLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 4 },
  contribSummaryValue: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' },
  contribArrow: { fontSize: 16, color: '#9CA3AF', fontWeight: 'bold' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 6, textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginBottom: 16 },
  modalLabel: { fontSize: 13, color: '#6B7280', fontWeight: '600', marginBottom: 8, marginTop: 12 },
  modalInput: { backgroundColor: '#F9FAFB', color: '#1A1A1A', padding: 15, borderRadius: 12, fontSize: 15, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 4 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalCancel: { flex: 1, backgroundColor: '#F9FAFB', padding: 16, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  modalCancelText: { color: '#6B7280', fontWeight: 'bold', fontSize: 15 },
  modalSaveContainer: { flex: 2, borderRadius: 14, overflow: 'hidden', elevation: 4 },
  modalSave: { padding: 16, alignItems: 'center' },
  modalSaveText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
});