import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db, auth } from '../firebase.config';
// @ts-ignore
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

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
  subCategory?: string;
  notes: string;
  splits?: Split[];
};

type TransactionContextType = {
  transactions: Transaction[];
  setTransactions: (t: Transaction[]) => void;
  updateTransaction: (index: number, category: string, notes: string, splits?: Split[], subCategory?: string, id?: string) => void;
  addTransaction: (t: Transaction) => void;
  pendingTransaction: Transaction | null;
  setPendingTransaction: (t: Transaction | null) => void;
  budgets: { [key: string]: string };
  setBudgets: (b: { [key: string]: string }) => void;
  isLoaded: boolean;
};

const TransactionContext = createContext<TransactionContextType | null>(null);

export function TransactionProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactionsState] = useState<Transaction[]>([]);
  const [budgets, setBudgetsState] = useState<{ [key: string]: string }>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [pendingTransaction, setPendingTransaction] = useState<Transaction | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsLoaded(false); // Reset to false whenever a user change/login is detected!
        setUserId(user.uid);
        loadFromFirebase(user.uid);
      } else {
        setUserId(null);
        setTransactionsState([]);
        setBudgetsState({});
        setIsLoaded(true); // Treat as loaded if no user
      }
    });
    return unsub;
  }, []);

  const loadFromFirebase = async (uid: string) => {
    try {
      // Load both profile and transaction data
      const userDocRef = doc(db, 'users', uid);
      const txnsDocRef = doc(db, 'users', uid, 'data', 'transactions');

      const [userSnap, txnsSnap] = await Promise.all([
        getDoc(userDocRef),
        getDoc(txnsDocRef)
      ]);

      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.budgets) setBudgetsState(data.budgets);
      }

      if (txnsSnap.exists()) {
        const data = txnsSnap.data();
        if (data.list) setTransactionsState(data.list);
      }

      setIsLoaded(true);
    } catch (error) {
      console.log('Firebase load error:', error);
      setIsLoaded(true);
    }
  };

  const saveToFirebase = async (t: Transaction[], b: { [key: string]: string }) => {
    if (!userId || !isLoaded) return;
    try {
      const userDocRef = doc(db, 'users', userId);
      const txnsDocRef = doc(db, 'users', userId, 'data', 'transactions');

      await Promise.all([
        setDoc(userDocRef, { budgets: b }, { merge: true }),
        setDoc(txnsDocRef, { list: t })
      ]);
    } catch (error) {
      console.log('Firebase save error:', error);
    }
  };
  const setTransactions = (t: Transaction[]) => {
    setTransactionsState(prev => {
      // Use 3-field key (date+amount+merchant) — matches getSmsId in index.tsx
      const tid = (tx: Transaction) => `${tx.date}-${tx.amount}-${tx.merchant}`;

      // Merge: keep existing categories if already categorized
      const merged = t.map(newTxn => {
        const existing = prev.find(ex => tid(ex) === tid(newTxn));
        if (existing && existing.category) {
          return { ...newTxn, category: existing.category, notes: existing.notes, splits: existing.splits, subCategory: existing.subCategory };
        }
        return newTxn;
      });

      // Deduplicate
      const seen = new Set<string>();
      const deduped = merged.filter(tx => {
        const key = tid(tx);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      saveToFirebase(deduped, budgets);
      return deduped;
    });
  };

  const setBudgets = (b: { [key: string]: string }) => {
    setBudgetsState(b);
    saveToFirebase(transactions, b);
  };

  const updateTransaction = (index: number, category: string, notes: string, splits?: Split[], subCategory?: string, id?: string) => {
    let updated = [...transactions];
    let targetIndex = index;

    if (id) {
      const getTid = (t: Transaction) => `${t.date}-${t.amount}-${t.merchant}`;
      if (targetIndex < 0 || targetIndex >= updated.length || getTid(updated[targetIndex]) !== id) {
        targetIndex = updated.findIndex(t => getTid(t) === id);
      }
    }

    if (targetIndex !== -1) {
      updated[targetIndex] = { ...updated[targetIndex], category, subCategory, notes, splits };
      setTransactionsState(updated);
      saveToFirebase(updated, budgets);
    }
  };

  const addTransaction = (t: Transaction) => {
    const tid = (tx: Transaction) => `${tx.date}-${tx.amount}-${tx.merchant}`;
    const newId = tid(t);

    setTransactionsState(prev => {
      const exists = prev.some(existing => tid(existing) === newId);
      let updated;
      if (exists) {
        // Update existing "raw" entry with categorization data
        updated = prev.map(existing => tid(existing) === newId ? { ...existing, ...t } : existing);
      } else {
        // Truly new entry
        updated = [t, ...prev];
      }
      saveToFirebase(updated, budgets);
      return updated;
    });
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
      isLoaded,
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