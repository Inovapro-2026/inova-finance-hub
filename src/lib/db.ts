import { supabase } from '@/integrations/supabase/client';

export interface Profile {
  id: string;
  userId: number; // matricula
  fullName: string;
  email?: string;
  phone?: string;
  initialBalance: number;
  creditLimit: number;
  creditUsed: number;
  creditDueDay?: number;
  createdAt: Date;
}

export interface Transaction {
  id?: string;
  amount: number;
  type: 'income' | 'expense';
  paymentMethod: 'debit' | 'credit';
  category: string;
  description: string;
  date: Date;
  userId: number; // user_matricula
}

export interface Goal {
  id?: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: Date;
  userId: number; // user_matricula
  createdAt: Date;
  isActive: boolean;
}

// Profile functions - using Supabase
export async function getProfile(matricula: number): Promise<Profile | undefined> {
  const { data, error } = await supabase
    .from('users_matricula')
    .select('*')
    .eq('matricula', matricula)
    .maybeSingle();

  if (error || !data) {
    console.error('Error fetching profile:', error);
    return undefined;
  }

  return {
    id: data.id,
    userId: data.matricula,
    fullName: data.full_name || '',
    email: data.email || undefined,
    phone: data.phone || undefined,
    initialBalance: Number(data.initial_balance) || 0,
    creditLimit: Number(data.credit_limit) || 5000,
    creditUsed: Number(data.credit_used) || 0,
    creditDueDay: data.credit_due_day || 5,
    createdAt: new Date(data.created_at),
  };
}

export async function createProfile(profile: Omit<Profile, 'id' | 'createdAt'>): Promise<string | null> {
  const { data, error } = await supabase
    .from('users_matricula')
    .insert({
      matricula: profile.userId,
      full_name: profile.fullName,
      email: profile.email || null,
      phone: profile.phone || null,
      initial_balance: profile.initialBalance,
      credit_limit: profile.creditLimit,
      credit_used: profile.creditUsed,
      credit_due_day: profile.creditDueDay || 5,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating profile:', error);
    return null;
  }

  return data?.id || null;
}

export async function updateProfile(matricula: number, updates: Partial<Profile>): Promise<boolean> {
  const updateData: Record<string, unknown> = {};
  
  if (updates.fullName !== undefined) updateData.full_name = updates.fullName;
  if (updates.email !== undefined) updateData.email = updates.email;
  if (updates.phone !== undefined) updateData.phone = updates.phone;
  if (updates.initialBalance !== undefined) updateData.initial_balance = updates.initialBalance;
  if (updates.creditLimit !== undefined) updateData.credit_limit = updates.creditLimit;
  if (updates.creditUsed !== undefined) updateData.credit_used = updates.creditUsed;
  if (updates.creditDueDay !== undefined) updateData.credit_due_day = updates.creditDueDay;

  const { error } = await supabase
    .from('users_matricula')
    .update(updateData)
    .eq('matricula', matricula);

  if (error) {
    console.error('Error updating profile:', error);
    return false;
  }

  return true;
}

// Transaction functions - using Supabase
export async function getTransactions(userId: number): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, categories(name)')
    .eq('user_matricula', userId)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }

  return (data || []).map((t) => ({
    id: t.id,
    amount: Number(t.amount),
    type: t.type as 'income' | 'expense',
    paymentMethod: (t.payment_method as 'debit' | 'credit') || 'debit',
    category: (t.categories as { name: string } | null)?.name || t.description || 'Outros',
    description: t.description || '',
    date: new Date(t.date),
    userId: t.user_matricula,
  }));
}

export async function addTransaction(transaction: Omit<Transaction, 'id'>): Promise<string | null> {
  // First, find or create the category
  let categoryId: string | null = null;
  
  const { data: existingCategory } = await supabase
    .from('categories')
    .select('id')
    .eq('user_matricula', transaction.userId)
    .eq('name', transaction.category)
    .maybeSingle();

  if (existingCategory) {
    categoryId = existingCategory.id;
  } else {
    // Create new category
    const categoryType = transaction.type === 'income' ? 'income' : 'expense';
    const { data: newCategory } = await supabase
      .from('categories')
      .insert({
        name: transaction.category,
        type: categoryType,
        user_matricula: transaction.userId,
      })
      .select('id')
      .single();
    
    if (newCategory) {
      categoryId = newCategory.id;
    }
  }

  // Insert the transaction
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      amount: transaction.amount,
      type: transaction.type,
      payment_method: transaction.paymentMethod,
      category_id: categoryId,
      description: transaction.description,
      date: transaction.date.toISOString().split('T')[0],
      user_matricula: transaction.userId,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error adding transaction:', error);
    return null;
  }

  // If expense on credit, update credit_used
  if (transaction.type === 'expense' && transaction.paymentMethod === 'credit') {
    const { data: profile } = await supabase
      .from('users_matricula')
      .select('credit_used')
      .eq('matricula', transaction.userId)
      .single();

    if (profile) {
      await supabase
        .from('users_matricula')
        .update({
          credit_used: Number(profile.credit_used || 0) + transaction.amount,
        })
        .eq('matricula', transaction.userId);
    }
  }

  return data?.id || null;
}

// Goal functions - using Supabase
export async function getGoals(userId: number): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_matricula', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching goals:', error);
    return [];
  }

  return (data || []).map((g) => ({
    id: g.id,
    title: g.name,
    targetAmount: Number(g.target_amount),
    currentAmount: Number(g.current_amount) || 0,
    deadline: new Date(g.deadline || Date.now()),
    userId: g.user_matricula,
    createdAt: new Date(g.created_at),
    isActive: g.is_active ?? true,
  }));
}

export async function addGoal(goal: Omit<Goal, 'id' | 'createdAt' | 'isActive'>): Promise<string | null> {
  const { data, error } = await supabase
    .from('goals')
    .insert({
      name: goal.title,
      target_amount: goal.targetAmount,
      current_amount: goal.currentAmount,
      deadline: goal.deadline.toISOString().split('T')[0],
      user_matricula: goal.userId,
      is_active: true,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error adding goal:', error);
    return null;
  }

  return data?.id || null;
}

export async function updateGoal(id: string, updates: Partial<Goal>): Promise<boolean> {
  const updateData: Record<string, unknown> = {};
  
  if (updates.title !== undefined) updateData.name = updates.title;
  if (updates.targetAmount !== undefined) updateData.target_amount = updates.targetAmount;
  if (updates.currentAmount !== undefined) updateData.current_amount = updates.currentAmount;
  if (updates.deadline !== undefined) updateData.deadline = updates.deadline.toISOString().split('T')[0];
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

  const { error } = await supabase
    .from('goals')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('Error updating goal:', error);
    return false;
  }

  return true;
}

export async function deleteGoal(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('goals')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    console.error('Error deleting goal:', error);
    return false;
  }

  return true;
}

// Calculate balance from Supabase transactions
export async function calculateBalance(userId: number, initialBalance: number): Promise<{
  balance: number;
  totalIncome: number;
  totalExpense: number;
  debitBalance: number;
  creditUsed: number;
}> {
  const transactions = await getTransactions(userId);
  
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
  
  // Get credit used from profile
  const { data: profile } = await supabase
    .from('users_matricula')
    .select('credit_used')
    .eq('matricula', userId)
    .maybeSingle();
  
  return {
    balance: initialBalance + totalIncome - totalExpense,
    totalIncome,
    totalExpense,
    debitBalance,
    creditUsed: Number(profile?.credit_used) || 0,
  };
}

// Categories for transactions
export const EXPENSE_CATEGORIES = [
  { id: 'Alimentação', label: 'Alimentação', icon: 'Utensils' },
  { id: 'Transporte', label: 'Transporte', icon: 'Car' },
  { id: 'Lazer', label: 'Lazer', icon: 'Gamepad2' },
  { id: 'Compras', label: 'Compras', icon: 'ShoppingBag' },
  { id: 'Saúde', label: 'Saúde', icon: 'Heart' },
  { id: 'Educação', label: 'Educação', icon: 'GraduationCap' },
  { id: 'Contas', label: 'Contas', icon: 'Receipt' },
  { id: 'Outros', label: 'Outros', icon: 'MoreHorizontal' },
];

export const INCOME_CATEGORIES = [
  { id: 'Salário', label: 'Salário', icon: 'Briefcase' },
  { id: 'Freelance', label: 'Freelance', icon: 'Laptop' },
  { id: 'Investimentos', label: 'Investimentos', icon: 'TrendingUp' },
  { id: 'Presente', label: 'Presente', icon: 'Gift' },
  { id: 'Outros', label: 'Outros', icon: 'MoreHorizontal' },
];
