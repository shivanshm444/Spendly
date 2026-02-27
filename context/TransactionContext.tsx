import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from '../firebase.config';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export type Transaction = {
  amount: number;
  merchant: string;
  date: string;
  message: string;
  category: string;
  notes: string;
};

type TransactionContextType = {
  transactions: Transaction[];
  setTransactions: (t: Transaction[]) => void;
  updateTransaction: (index: number, category: string, notes: string) => void;
  budgets: { [key: string]: string };
  setBudgets: (b: { [key: string]: string }) => void;
};

const TransactionContext = createContext<TransactionContextType | null>(null);

const USER_ID = 'user_001';

export function TransactionProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactionsState] = useState<Transaction[]>([]);
  const [budgets, setBudgetsState] = useState<{ [key: string]: string }>({});

  // Load data from Firebase on app start
  useEffect(() => {
    loadFromFirebase();
  }, []);

  const loadFromFirebase = async () => {
    try {
      const docRef = doc(db, 'users', USER_ID);
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

  const saveToFirebase = async (transactions: Transaction[], budgets: { [key: string]: string }) => {
    try {
      const docRef = doc(db, 'users', USER_ID);
      await setDoc(docRef, { transactions, budgets });
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

  const updateTransaction = (index: number, category: string, notes: string) => {
    const updated = [...transactions];
    updated[index] = { ...updated[index], category, notes };
    setTransactionsState(updated);
    saveToFirebase(updated, budgets);
  };

  return (
    <TransactionContext.Provider value={{ transactions, setTransactions, updateTransaction, budgets, setBudgets }}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions() {
  const context = useContext(TransactionContext);
  if (!context) throw new Error('useTransactions must be used within TransactionProvider');
  return context;
}