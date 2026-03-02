import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db, auth } from '../firebase.config';
// @ts-ignore
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STALE_DATA_CLEANUP_KEY = 'sms_overhaul_v1_cleanup_done';

export type Split = {
  amount: number;
  description: string;
  category: string;
};

export type Transaction = {
  amount: number;
  merchant: string;
  date: string;
  message: string;
  category: string;
  notes: string;
  splits?: Split[];
};

type TransactionContextType = {
  transactions: Transaction[];
  setTransactions: (t: Transaction[]) => void;
  updateTransaction: (index: number, category: string, notes: string, splits?: Split[]) => void;
  addTransaction: (t: Transaction) => void;
  pendingTransaction: Transaction | null;
  setPendingTransaction: (t: Transaction | null) => void;
  budgets: { [key: string]: string };
  setBudgets: (b: { [key: string]: string }) => void;
};

const TransactionContext = createContext<TransactionContextType | null>(null);

export function TransactionProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactionsState] = useState<Transaction[]>([]);
  const [budgets, setBudgetsState] = useState<{ [key: string]: string }>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [pendingTransaction, setPendingTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        loadFromFirebase(user.uid);
      } else {
        setUserId(null);
        setTransactionsState([]);
        setBudgetsState({});
      }
    });
    return unsub;
  }, []);

  const loadFromFirebase = async (uid: string) => {
    try {
      // One-time cleanup of stale data from previous version
      const cleanupDone = await AsyncStorage.getItem(STALE_DATA_CLEANUP_KEY);
      if (!cleanupDone) {
        console.log('Clearing stale transactions from previous version...');
        const docRef = doc(db, 'users', uid);
        await setDoc(docRef, { transactions: [], budgets: {} }, { merge: false });
        await AsyncStorage.setItem(STALE_DATA_CLEANUP_KEY, 'true');
        setTransactionsState([]);
        setBudgetsState({});
        return;
      }

      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.transactions) setTransactionsState(data.transactions);
        if (data.budgets) setBudgetsState(data.budgets);
      }
    } catch (error) {
      console.log('Firebase load error:', error);
    }
  };

  const saveToFirebase = async (t: Transaction[], b: { [key: string]: string }) => {
    if (!userId) return;
    try {
      const docRef = doc(db, 'users', userId);
      await setDoc(docRef, { transactions: t, budgets: b });
    } catch (error) {
      console.log('Firebase save error:', error);
    }
  };

  const setTransactions = (t: Transaction[]) => {
    setTransactionsState(t);
    saveToFirebase(t, budgets);
  };

  const setBudgets = (b: { [key: string]: string }) => {
    setBudgetsState(b);
    saveToFirebase(transactions, b);
  };

  const updateTransaction = (index: number, category: string, notes: string, splits?: Split[]) => {
    const updated = [...transactions];
    updated[index] = { ...updated[index], category, notes, splits };
    setTransactionsState(updated);
    saveToFirebase(updated, budgets);
  };

  const addTransaction = (t: Transaction) => {
    const updated = [t, ...transactions];
    setTransactionsState(updated);
    saveToFirebase(updated, budgets);
  };

  return (
    <TransactionContext.Provider value={{
      transactions,
      setTransactions,
      updateTransaction,
      addTransaction,
      pendingTransaction,
      setPendingTransaction,
      budgets,
      setBudgets,
    }}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions() {
  const context = useContext(TransactionContext);
  if (!context) throw new Error('useTransactions must be used within TransactionProvider');
  return context;
}