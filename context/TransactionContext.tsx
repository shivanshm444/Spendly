import { createContext, useContext, useState, ReactNode } from 'react';

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
};

const TransactionContext = createContext<TransactionContextType | null>(null);

export function TransactionProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const updateTransaction = (index: number, category: string, notes: string) => {
    const updated = [...transactions];
    updated[index] = { ...updated[index], category, notes };
    setTransactions(updated);
  };

  return (
    <TransactionContext.Provider value={{ transactions, setTransactions, updateTransaction }}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions() {
  const context = useContext(TransactionContext);
  if (!context) throw new Error('useTransactions must be used within TransactionProvider');
  return context;
}