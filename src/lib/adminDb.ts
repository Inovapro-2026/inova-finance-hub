import { supabase } from "@/integrations/supabase/client";

// Types
export interface AdminUser {
  id: string;
  matricula: number;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  initial_balance: number | null;
  salary_amount: number | null;
  salary_day: number | null;
  advance_amount: number | null;
  advance_day: number | null;
  credit_limit: number | null;
  credit_used: number | null;
  blocked: boolean;
  created_at: string;
}

export interface AdminLog {
  id: string;
  admin_id: string;
  action: string;
  target_user_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

// Check if current user is admin
export async function checkIsAdmin(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase.rpc('has_role', {
    _user_id: user.id,
    _role: 'admin'
  });

  if (error) {
    console.error('Error checking admin role:', error);
    return false;
  }

  return data === true;
}

// Get all users
export async function getAllUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase
    .from('users_matricula')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }

  return (data || []).map(user => ({
    ...user,
    blocked: user.blocked ?? false
  })) as AdminUser[];
}

// Get user by ID
export async function getUserById(id: string): Promise<AdminUser | null> {
  const { data, error } = await supabase
    .from('users_matricula')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }

  return data ? { ...data, blocked: data.blocked ?? false } as AdminUser : null;
}

// Update user
export async function updateUser(id: string, updates: Partial<AdminUser>): Promise<boolean> {
  const { error } = await supabase
    .from('users_matricula')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Error updating user:', error);
    return false;
  }

  return true;
}

// Block/Unblock user
export async function toggleUserBlock(id: string, blocked: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('users_matricula')
    .update({ blocked })
    .eq('id', id);

  if (error) {
    console.error('Error toggling user block:', error);
    return false;
  }

  return true;
}

// Delete user
export async function deleteUser(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('users_matricula')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting user:', error);
    return false;
  }

  return true;
}

// Get dashboard stats
export async function getDashboardStats() {
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Get all users
  const { data: users } = await supabase
    .from('users_matricula')
    .select('*');

  const activeUsers = (users || []).filter(u => !u.blocked).length;
  const blockedUsers = (users || []).filter(u => u.blocked).length;

  // Calculate total balance
  let totalBalance = 0;
  for (const user of users || []) {
    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, type')
      .eq('user_matricula', user.matricula);

    const initialBalance = user.initial_balance || 0;
    const transactionBalance = (transactions || []).reduce((acc, t) => {
      return t.type === 'income' ? acc + Number(t.amount) : acc - Number(t.amount);
    }, 0);

    totalBalance += initialBalance + transactionBalance;
  }

  // Get today's expenses
  const { data: todayExpenses } = await supabase
    .from('transactions')
    .select('amount')
    .eq('type', 'expense')
    .eq('date', today);

  const totalTodayExpenses = (todayExpenses || []).reduce((acc, t) => acc + Number(t.amount), 0);

  // Get scheduled payments for current month
  const { data: scheduledPayments } = await supabase
    .from('scheduled_payments')
    .select('amount')
    .eq('is_active', true);

  const totalScheduledPayments = (scheduledPayments || []).reduce((acc, p) => acc + Number(p.amount), 0);

  // Get salary credits this month
  const { data: salaryCredits } = await supabase
    .from('salary_credits')
    .select('amount')
    .like('month_year', `${currentMonth}%`);

  const totalSalaryCredits = (salaryCredits || []).reduce((acc, s) => acc + Number(s.amount), 0);

  // Users who received salary today
  const todayDay = new Date().getDate();
  const usersWithSalaryToday = (users || []).filter(u => u.salary_day === todayDay && u.salary_amount);

  // Users with payment due today
  const { data: paymentsToday } = await supabase
    .from('scheduled_payments')
    .select('*, user_matricula')
    .eq('due_day', todayDay)
    .eq('is_active', true);

  return {
    activeUsers,
    blockedUsers,
    totalBalance,
    totalTodayExpenses,
    totalScheduledPayments,
    totalSalaryCredits,
    usersWithSalaryToday: usersWithSalaryToday || [],
    paymentsToday: paymentsToday || [],
    totalImpact: totalBalance + totalSalaryCredits + totalScheduledPayments
  };
}

// Get financial stats
export async function getFinancialStats() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const startOfMonth = `${currentMonth}-01`;
  const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

  // Get all users for average calculation
  const { data: users } = await supabase
    .from('users_matricula')
    .select('*');

  // Calculate total balance
  let totalBalance = 0;
  for (const user of users || []) {
    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, type')
      .eq('user_matricula', user.matricula);

    const initialBalance = user.initial_balance || 0;
    const transactionBalance = (transactions || []).reduce((acc, t) => {
      return t.type === 'income' ? acc + Number(t.amount) : acc - Number(t.amount);
    }, 0);

    totalBalance += initialBalance + transactionBalance;
  }

  const averageBalance = (users?.length || 0) > 0 ? totalBalance / (users?.length || 1) : 0;

  // Get salary credits this month
  const { data: salaryCredits } = await supabase
    .from('salary_credits')
    .select('*')
    .like('month_year', `${currentMonth}%`);

  const totalSalaryCredits = (salaryCredits || []).reduce((acc, s) => acc + Number(s.amount), 0);

  // Get scheduled payments
  const { data: scheduledPayments } = await supabase
    .from('scheduled_payments')
    .select('*')
    .eq('is_active', true);

  const totalScheduledPayments = (scheduledPayments || []).reduce((acc, p) => acc + Number(p.amount), 0);

  // Get all transactions this month
  const { data: monthTransactions } = await supabase
    .from('transactions')
    .select('*')
    .gte('date', startOfMonth)
    .lte('date', endOfMonth);

  const incomeTransactions = (monthTransactions || []).filter(t => t.type === 'income');
  const expenseTransactions = (monthTransactions || []).filter(t => t.type === 'expense');

  // Get payment logs this month
  const { data: paymentLogs } = await supabase
    .from('payment_logs')
    .select('*')
    .gte('paid_at', startOfMonth);

  return {
    totalBalance,
    averageBalance,
    totalSalaryCredits,
    totalScheduledPayments,
    totalTransactions: (monthTransactions || []).length,
    salaryCredits: salaryCredits || [],
    incomeTransactions,
    expenseTransactions,
    paymentLogs: paymentLogs || [],
    pendingPayments: scheduledPayments || []
  };
}

// Get all scheduled payments for planning
export async function getAllScheduledPayments() {
  const { data, error } = await supabase
    .from('scheduled_payments')
    .select('*')
    .eq('is_active', true)
    .order('due_day', { ascending: true });

  if (error) {
    console.error('Error fetching scheduled payments:', error);
    return [];
  }

  return data || [];
}

// Update scheduled payment
export async function updateScheduledPayment(id: string, updates: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase
    .from('scheduled_payments')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Error updating scheduled payment:', error);
    return false;
  }

  return true;
}

// Delete scheduled payment
export async function deleteScheduledPaymentAdmin(id: string): Promise<boolean> {
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

// Mark payment as paid
export async function markPaymentAsPaid(payment: { id: string; user_matricula: number; name: string; amount: number }): Promise<boolean> {
  // Add to payment logs
  const { error: logError } = await supabase
    .from('payment_logs')
    .insert({
      user_matricula: payment.user_matricula,
      scheduled_payment_id: payment.id,
      name: payment.name,
      amount: payment.amount,
      payment_type: 'scheduled',
      paid_at: new Date().toISOString()
    });

  if (logError) {
    console.error('Error adding payment log:', logError);
    return false;
  }

  // Update last_paid_at
  const { error: updateError } = await supabase
    .from('scheduled_payments')
    .update({ last_paid_at: new Date().toISOString() })
    .eq('id', payment.id);

  if (updateError) {
    console.error('Error updating payment:', updateError);
    return false;
  }

  return true;
}

// Add admin log
export async function addAdminLog(action: string, targetUserId?: string, details?: Record<string, unknown>): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // Use raw insert with explicit typing to bypass RPC type issues
  const { error } = await supabase
    .from('admin_logs')
    .insert([{
      admin_id: user.id,
      action,
      target_user_id: targetUserId || null,
      details: details ? JSON.stringify(details) : null
    }] as unknown as { action: string; admin_id: string; target_user_id: string | null; details: string | null }[]);

  if (error) {
    console.error('Error adding admin log:', error);
    return false;
  }

  return true;
}

// Get admin logs
export async function getAdminLogs(limit = 50): Promise<AdminLog[]> {
  const { data, error } = await supabase
    .from('admin_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching admin logs:', error);
    return [];
  }

  // Map the data to match our AdminLog interface
  return (data || []).map(log => ({
    id: log.id,
    admin_id: log.admin_id,
    action: log.action,
    target_user_id: log.target_user_id,
    details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details as Record<string, unknown> | null,
    created_at: log.created_at
  }));
}

// Get user transactions
export async function getUserTransactions(matricula: number) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_matricula', matricula)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching user transactions:', error);
    return [];
  }

  return data || [];
}

// Get user scheduled payments
export async function getUserScheduledPayments(matricula: number) {
  const { data, error } = await supabase
    .from('scheduled_payments')
    .select('*')
    .eq('user_matricula', matricula)
    .eq('is_active', true)
    .order('due_day', { ascending: true });

  if (error) {
    console.error('Error fetching user scheduled payments:', error);
    return [];
  }

  return data || [];
}

// Get user payment logs
export async function getUserPaymentLogs(matricula: number) {
  const { data, error } = await supabase
    .from('payment_logs')
    .select('*')
    .eq('user_matricula', matricula)
    .order('paid_at', { ascending: false });

  if (error) {
    console.error('Error fetching user payment logs:', error);
    return [];
  }

  return data || [];
}
