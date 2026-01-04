import Dexie, { type Table } from 'dexie';

export interface Profile {
  id?: number;
  userId: string;
  fullName: string;
  email?: string;
  phone?: string;
  initialBalance: number; // Saldo débito
  creditLimit: number; // Limite de crédito
  creditUsed: number; // Crédito usado
  creditDueDate?: Date; // Data limite do crédito atual
  creditDueDay?: number; // Dia do mês de vencimento (1-31)
  biometricId?: string;
  createdAt: Date;
}

export interface Transaction {
  id?: number;
  amount: number;
  type: 'income' | 'expense';
  paymentMethod: 'debit' | 'credit'; // Débito ou crédito
  category: string;
  description: string;
  date: Date;
  userId: string;
}

export interface Goal {
  id?: number;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: Date;
  userId: string;
  createdAt: Date;
}

export class InovaFinanceDB extends Dexie {
  profiles!: Table<Profile>;
  transactions!: Table<Transaction>;
  goals!: Table<Goal>;

  constructor() {
    super('inovafinance');
    this.version(2).stores({
      profiles: '++id, userId, fullName, email, phone',
      transactions: '++id, userId, type, category, date, paymentMethod',
      goals: '++id, userId, deadline',
    });
  }
}

export const db = new InovaFinanceDB();

// Helper functions
export async function getProfile(userId: string): Promise<Profile | undefined> {
  return db.profiles.where('userId').equals(userId).first();
}

export async function createProfile(profile: Omit<Profile, 'id' | 'createdAt'>): Promise<number> {
  return db.profiles.add({
    ...profile,
    createdAt: new Date(),
  });
}

export async function updateProfile(userId: string, updates: Partial<Profile>): Promise<number> {
  const profile = await getProfile(userId);
  if (profile?.id) {
    return db.profiles.update(profile.id, updates);
  }
  return 0;
}

export async function getTransactions(userId: string): Promise<Transaction[]> {
  return db.transactions.where('userId').equals(userId).reverse().sortBy('date');
}

export async function addTransaction(transaction: Omit<Transaction, 'id'>): Promise<number> {
  // Se for gasto no crédito, atualizar o creditUsed do profile
  if (transaction.type === 'expense' && transaction.paymentMethod === 'credit') {
    const profile = await getProfile(transaction.userId);
    if (profile?.id) {
      await db.profiles.update(profile.id, {
        creditUsed: (profile.creditUsed || 0) + transaction.amount,
      });
    }
  }
  return db.transactions.add(transaction);
}

export async function getGoals(userId: string): Promise<Goal[]> {
  return db.goals.where('userId').equals(userId).toArray();
}

export async function addGoal(goal: Omit<Goal, 'id' | 'createdAt'>): Promise<number> {
  return db.goals.add({
    ...goal,
    createdAt: new Date(),
  });
}

export async function updateGoal(id: number, updates: Partial<Goal>): Promise<number> {
  return db.goals.update(id, updates);
}

export async function calculateBalance(userId: string, initialBalance: number): Promise<{
  balance: number;
  totalIncome: number;
  totalExpense: number;
  debitBalance: number;
  creditUsed: number;
}> {
  const transactions = await getTransactions(userId);
  const profile = await getProfile(userId);
  
  let totalIncome = 0;
  let totalExpense = 0;
  let debitExpense = 0;
  
  transactions.forEach((t) => {
    if (t.type === 'income') {
      totalIncome += t.amount;
    } else {
      totalExpense += t.amount;
      if (t.paymentMethod === 'debit' || !t.paymentMethod) {
        debitExpense += t.amount;
      }
    }
  });
  
  const debitBalance = initialBalance + totalIncome - debitExpense;
  
  return {
    balance: initialBalance + totalIncome - totalExpense,
    totalIncome,
    totalExpense,
    debitBalance,
    creditUsed: profile?.creditUsed || 0,
  };
}

// Categories for transactions
export const EXPENSE_CATEGORIES = [
  { id: 'food', label: 'Alimentação', icon: 'Utensils' },
  { id: 'transport', label: 'Transporte', icon: 'Car' },
  { id: 'entertainment', label: 'Lazer', icon: 'Gamepad2' },
  { id: 'shopping', label: 'Compras', icon: 'ShoppingBag' },
  { id: 'health', label: 'Saúde', icon: 'Heart' },
  { id: 'education', label: 'Educação', icon: 'GraduationCap' },
  { id: 'bills', label: 'Contas', icon: 'Receipt' },
  { id: 'other', label: 'Outros', icon: 'MoreHorizontal' },
];

export const INCOME_CATEGORIES = [
  { id: 'salary', label: 'Salário', icon: 'Briefcase' },
  { id: 'freelance', label: 'Freelance', icon: 'Laptop' },
  { id: 'investment', label: 'Investimentos', icon: 'TrendingUp' },
  { id: 'gift', label: 'Presente', icon: 'Gift' },
  { id: 'other', label: 'Outros', icon: 'MoreHorizontal' },
];
