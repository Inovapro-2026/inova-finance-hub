import { supabase } from '@/integrations/supabase/client';

export interface ScheduledPayment {
  id?: string;
  userId: number; // user_matricula
  name: string;
  amount: number;
  dueDay: number;
  isRecurring: boolean;
  isActive: boolean;
  specificMonth?: Date | null; // For one-time payments
  category: string;
  lastPaidAt?: Date | null;
  createdAt?: Date;
}

export interface PaymentLog {
  id?: string;
  userId: number;
  scheduledPaymentId?: string | null;
  name: string;
  amount: number;
  paidAt: Date;
  paymentType: 'scheduled' | 'salary' | 'manual';
}

export interface SalaryCredit {
  id?: string;
  userId: number;
  amount: number;
  creditedAt: Date;
  monthYear: string; // "2025-01" format
}

// Scheduled Payments functions
export async function getScheduledPayments(userId: number): Promise<ScheduledPayment[]> {
  const { data, error } = await supabase
    .from('scheduled_payments')
    .select('*')
    .eq('user_matricula', userId)
    .eq('is_active', true)
    .order('due_day', { ascending: true });

  if (error) {
    console.error('Error fetching scheduled payments:', error);
    return [];
  }

  return (data || []).map((p) => ({
    id: p.id,
    userId: p.user_matricula,
    name: p.name,
    amount: Number(p.amount),
    dueDay: p.due_day,
    isRecurring: p.is_recurring,
    isActive: p.is_active ?? true,
    specificMonth: p.specific_month ? new Date(p.specific_month) : null,
    category: p.category || 'outros',
    lastPaidAt: p.last_paid_at ? new Date(p.last_paid_at) : null,
    createdAt: new Date(p.created_at),
  }));
}

export async function addScheduledPayment(payment: Omit<ScheduledPayment, 'id' | 'createdAt' | 'isActive'>): Promise<string | null> {
  const { data, error } = await supabase
    .from('scheduled_payments')
    .insert({
      user_matricula: payment.userId,
      name: payment.name,
      amount: payment.amount,
      due_day: payment.dueDay,
      is_recurring: payment.isRecurring,
      specific_month: payment.specificMonth ? payment.specificMonth.toISOString().split('T')[0] : null,
      category: payment.category,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error adding scheduled payment:', error);
    return null;
  }

  return data?.id || null;
}

export async function updateScheduledPayment(id: string, updates: Partial<ScheduledPayment>): Promise<boolean> {
  const updateData: Record<string, unknown> = {};
  
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.amount !== undefined) updateData.amount = updates.amount;
  if (updates.dueDay !== undefined) updateData.due_day = updates.dueDay;
  if (updates.isRecurring !== undefined) updateData.is_recurring = updates.isRecurring;
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
  if (updates.specificMonth !== undefined) updateData.specific_month = updates.specificMonth?.toISOString().split('T')[0] || null;
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.lastPaidAt !== undefined) updateData.last_paid_at = updates.lastPaidAt?.toISOString() || null;

  const { error } = await supabase
    .from('scheduled_payments')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('Error updating scheduled payment:', error);
    return false;
  }

  return true;
}

export async function deleteScheduledPayment(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('scheduled_payments')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    console.error('Error deleting scheduled payment:', error);
    return false;
  }

  return true;
}

// Payment logs functions
export async function getPaymentLogs(userId: number, limit: number = 50): Promise<PaymentLog[]> {
  const { data, error } = await supabase
    .from('payment_logs')
    .select('*')
    .eq('user_matricula', userId)
    .order('paid_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching payment logs:', error);
    return [];
  }

  return (data || []).map((p) => ({
    id: p.id,
    userId: p.user_matricula,
    scheduledPaymentId: p.scheduled_payment_id,
    name: p.name,
    amount: Number(p.amount),
    paidAt: new Date(p.paid_at),
    paymentType: p.payment_type as 'scheduled' | 'salary' | 'manual',
  }));
}

export async function addPaymentLog(log: Omit<PaymentLog, 'id'>): Promise<string | null> {
  const { data, error } = await supabase
    .from('payment_logs')
    .insert({
      user_matricula: log.userId,
      scheduled_payment_id: log.scheduledPaymentId || null,
      name: log.name,
      amount: log.amount,
      paid_at: log.paidAt.toISOString(),
      payment_type: log.paymentType,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error adding payment log:', error);
    return null;
  }

  return data?.id || null;
}

// Salary credits functions
export async function getSalaryCredits(userId: number): Promise<SalaryCredit[]> {
  const { data, error } = await supabase
    .from('salary_credits')
    .select('*')
    .eq('user_matricula', userId)
    .order('credited_at', { ascending: false });

  if (error) {
    console.error('Error fetching salary credits:', error);
    return [];
  }

  return (data || []).map((s) => ({
    id: s.id,
    userId: s.user_matricula,
    amount: Number(s.amount),
    creditedAt: new Date(s.credited_at),
    monthYear: s.month_year,
  }));
}

export async function addSalaryCredit(credit: Omit<SalaryCredit, 'id'>): Promise<string | null> {
  const { data, error } = await supabase
    .from('salary_credits')
    .insert({
      user_matricula: credit.userId,
      amount: credit.amount,
      credited_at: credit.creditedAt.toISOString(),
      month_year: credit.monthYear,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error adding salary credit:', error);
    return null;
  }

  return data?.id || null;
}

export async function checkSalaryCredited(userId: number, monthYear: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('salary_credits')
    .select('id')
    .eq('user_matricula', userId)
    .eq('month_year', monthYear)
    .maybeSingle();

  if (error) {
    console.error('Error checking salary credit:', error);
    return false;
  }

  return !!data;
}

// Get today's due payments
export async function getTodaysDuePayments(userId: number): Promise<ScheduledPayment[]> {
  const today = new Date();
  const todayDay = today.getDate();
  const currentMonth = today.toISOString().slice(0, 7); // "2025-01"

  const payments = await getScheduledPayments(userId);
  
  return payments.filter(p => {
    if (p.dueDay !== todayDay) return false;
    
    // Check if already paid this month
    if (p.lastPaidAt) {
      const lastPaidMonth = p.lastPaidAt.toISOString().slice(0, 7);
      if (lastPaidMonth === currentMonth) return false;
    }
    
    // If it's a one-time payment, check if it's for this month
    if (!p.isRecurring && p.specificMonth) {
      const paymentMonth = p.specificMonth.toISOString().slice(0, 7);
      if (paymentMonth !== currentMonth) return false;
    }
    
    return true;
  });
}

// Calculate monthly summary
export async function calculateMonthlySummary(userId: number, salaryAmount: number, salaryDay: number): Promise<{
  totalPayments: number;
  paymentsList: ScheduledPayment[];
  projectedBalance: number;
  heaviestPayment: ScheduledPayment | null;
  paymentsByDay: Map<number, ScheduledPayment[]>;
}> {
  const payments = await getScheduledPayments(userId);
  const today = new Date();
  const currentMonth = today.toISOString().slice(0, 7);
  
  // Filter active payments for this month
  const monthlyPayments = payments.filter(p => {
    if (p.isRecurring) return true;
    if (p.specificMonth) {
      const paymentMonth = p.specificMonth.toISOString().slice(0, 7);
      return paymentMonth === currentMonth;
    }
    return false;
  });
  
  const totalPayments = monthlyPayments.reduce((sum, p) => sum + p.amount, 0);
  const projectedBalance = salaryAmount - totalPayments;
  
  // Find heaviest payment
  const heaviestPayment = monthlyPayments.length > 0 
    ? monthlyPayments.reduce((max, p) => p.amount > max.amount ? p : max, monthlyPayments[0])
    : null;
  
  // Group by day
  const paymentsByDay = new Map<number, ScheduledPayment[]>();
  monthlyPayments.forEach(p => {
    const existing = paymentsByDay.get(p.dueDay) || [];
    paymentsByDay.set(p.dueDay, [...existing, p]);
  });
  
  return {
    totalPayments,
    paymentsList: monthlyPayments,
    projectedBalance,
    heaviestPayment,
    paymentsByDay,
  };
}

// Get user salary info
export async function getUserSalaryInfo(userId: number): Promise<{ 
  salaryAmount: number; 
  salaryDay: number;
  advanceAmount: number;
  advanceDay: number | null;
} | null> {
  const { data, error } = await supabase
    .from('users_matricula')
    .select('salary_amount, salary_day, advance_amount, advance_day')
    .eq('matricula', userId)
    .maybeSingle();

  if (error || !data) {
    console.error('Error fetching salary info:', error);
    return null;
  }

  return {
    salaryAmount: Number(data.salary_amount) || 0,
    salaryDay: data.salary_day || 5,
    advanceAmount: Number(data.advance_amount) || 0,
    advanceDay: data.advance_day || null,
  };
}

// Update user salary info
export async function updateUserSalaryInfo(
  userId: number, 
  salaryAmount: number, 
  salaryDay: number,
  advanceAmount?: number,
  advanceDay?: number | null
): Promise<boolean> {
  const updateData: Record<string, unknown> = { 
    salary_amount: salaryAmount, 
    salary_day: salaryDay 
  };
  
  if (advanceAmount !== undefined) {
    updateData.advance_amount = advanceAmount;
  }
  if (advanceDay !== undefined) {
    updateData.advance_day = advanceDay;
  }

  const { error } = await supabase
    .from('users_matricula')
    .update(updateData)
    .eq('matricula', userId);

  if (error) {
    console.error('Error updating salary info:', error);
    return false;
  }

  return true;
}

// Check if advance was credited this month
export async function checkAdvanceCredited(userId: number, monthYear: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('salary_credits')
    .select('id')
    .eq('user_matricula', userId)
    .eq('month_year', `${monthYear}-adv`)
    .maybeSingle();

  if (error) {
    console.error('Error checking advance credit:', error);
    return false;
  }

  return !!data;
}

// Calculate days until next payment
export function calculateDaysUntil(targetDay: number): number {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  let targetDate = new Date(currentYear, currentMonth, targetDay);
  
  // If the target day has passed this month, calculate for next month
  if (currentDay > targetDay) {
    targetDate = new Date(currentYear, currentMonth + 1, targetDay);
  }
  
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}
