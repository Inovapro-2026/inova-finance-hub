import { useEffect, useRef } from 'react';
import { speakNative, initNativeTts, hasVoiceSelected } from '@/services/nativeTtsService';
import { getUserSalaryInfo, calculateDaysUntil, getScheduledPayments, type ScheduledPayment } from '@/lib/plannerDb';
import { calculateBalance, getTransactions } from '@/lib/db';
import { 
  checkAndSendPaymentReminders, 
  shouldCheckReminders, 
  markReminderChecked,
  hasNotificationPermission,
  requestNotificationPermission 
} from '@/services/notificationService';

interface UseLoginGreetingOptions {
  userId: number;
  userName: string;
  initialBalance: number;
  enabled?: boolean;
}

const LAST_GREETING_KEY = 'inovabank_last_greeting';
const GREETING_SESSION_KEY = 'inovabank_greeting_session';

/**
 * Hook to handle INOVA AI greeting on login
 * Also handles notification permission request and reminders
 */
export function useLoginGreeting({ userId, userName, initialBalance, enabled = true }: UseLoginGreetingOptions) {
  const hasGreeted = useRef(false);
  const isGreeting = useRef(false);

  useEffect(() => {
    // Prevent duplicate calls
    if (!enabled || !userId || hasGreeted.current || isGreeting.current) return;

    // Check session storage to prevent double greetings in same session
    const sessionGreeted = sessionStorage.getItem(GREETING_SESSION_KEY);
    if (sessionGreeted === String(userId)) {
      hasGreeted.current = true;
      return;
    }

    const performGreeting = async () => {
      // Lock to prevent concurrent executions
      if (isGreeting.current) return;
      isGreeting.current = true;

      try {
        // Check if we already greeted today
        const lastGreeting = localStorage.getItem(LAST_GREETING_KEY);
        const today = new Date().toDateString();
        
        if (lastGreeting === today) {
          hasGreeted.current = true;
          sessionStorage.setItem(GREETING_SESSION_KEY, String(userId));
          return;
        }

        // Wait for voice to be ready
        if (!hasVoiceSelected()) {
          await new Promise<void>((resolve) => {
            initNativeTts(() => resolve());
          });
        }

        // Get all financial data
        const [salaryInfo, balanceData, todayTransactions, scheduledPayments] = await Promise.all([
          getUserSalaryInfo(userId),
          calculateBalance(userId, initialBalance),
          getTodayTransactions(userId),
          getUpcomingPayments(userId)
        ]);
        
        // Build greeting message with financial info
        const greeting = buildGreetingMessage(
          userName, 
          salaryInfo, 
          balanceData,
          todayTransactions,
          scheduledPayments
        );
        
        // Mark as greeted BEFORE speaking to prevent race conditions
        hasGreeted.current = true;
        localStorage.setItem(LAST_GREETING_KEY, today);
        sessionStorage.setItem(GREETING_SESSION_KEY, String(userId));

        // Small delay to ensure UI is ready
        await new Promise(resolve => setTimeout(resolve, 500));

        // Speak the greeting
        try {
          await speakNative(greeting);
        } catch (err) {
          console.error('Greeting TTS error:', err);
        }

        // Check and send notification reminders
        if (salaryInfo) {
          await handleNotificationReminders(salaryInfo);
        }
      } finally {
        isGreeting.current = false;
      }
    };

    performGreeting();
  }, [userId, userName, initialBalance, enabled]);
}

/**
 * Get today's transactions for spending summary
 */
async function getTodayTransactions(userId: number): Promise<{ totalSpent: number; count: number }> {
  const transactions = await getTransactions(userId);
  const today = new Date().toDateString();
  
  const todayExpenses = transactions.filter(t => {
    const txDate = new Date(t.date).toDateString();
    return txDate === today && t.type === 'expense';
  });
  
  const totalSpent = todayExpenses.reduce((sum, t) => sum + t.amount, 0);
  
  return { totalSpent, count: todayExpenses.length };
}

/**
 * Get upcoming payments for today and soon
 */
async function getUpcomingPayments(userId: number): Promise<{
  dueToday: ScheduledPayment[];
  dueSoon: ScheduledPayment[];
}> {
  const payments = await getScheduledPayments(userId);
  const today = new Date();
  const todayDay = today.getDate();
  const currentMonth = today.toISOString().slice(0, 7);
  
  const dueToday: ScheduledPayment[] = [];
  const dueSoon: ScheduledPayment[] = [];
  
  payments.forEach(p => {
    // Check if already paid this month
    if (p.lastPaidAt) {
      const lastPaidMonth = p.lastPaidAt.toISOString().slice(0, 7);
      if (lastPaidMonth === currentMonth) return;
    }
    
    // Check if it's a one-time payment for another month
    if (!p.isRecurring && p.specificMonth) {
      const paymentMonth = p.specificMonth.toISOString().slice(0, 7);
      if (paymentMonth !== currentMonth) return;
    }
    
    const daysUntil = calculateDaysUntil(p.dueDay);
    
    if (p.dueDay === todayDay) {
      dueToday.push(p);
    } else if (daysUntil <= 3 && daysUntil > 0) {
      dueSoon.push(p);
    }
  });
  
  return { dueToday, dueSoon };
}

/**
 * Build personalized greeting message with financial summary
 */
function buildGreetingMessage(
  userName: string, 
  salaryInfo: { salaryAmount: number; salaryDay: number; advanceAmount: number; advanceDay: number | null } | null,
  balanceData: { debitBalance: number; totalExpense: number },
  todayTransactions: { totalSpent: number; count: number },
  scheduledPayments: { dueToday: ScheduledPayment[]; dueSoon: ScheduledPayment[] }
): string {
  const firstName = userName.split(' ')[0];
  const hour = new Date().getHours();
  
  let timeGreeting: string;
  if (hour < 12) {
    timeGreeting = 'Bom dia';
  } else if (hour < 18) {
    timeGreeting = 'Boa tarde';
  } else {
    timeGreeting = 'Boa noite';
  }

  let message = `${timeGreeting}, ${firstName}! `;
  
  // Add balance info
  const formattedBalance = formatCurrency(Math.max(0, balanceData.debitBalance));
  message += `Seu saldo disponível é de ${formattedBalance}. `;
  
  // Add today's spending
  if (todayTransactions.totalSpent > 0) {
    const formattedSpent = formatCurrency(todayTransactions.totalSpent);
    message += `Hoje você gastou ${formattedSpent}. `;
  } else {
    message += `Você ainda não registrou gastos hoje. `;
  }
  
  // PRIORITIZE: Add payments due today FIRST before salary info
  if (scheduledPayments.dueToday.length > 0) {
    const totalDueToday = scheduledPayments.dueToday.reduce((sum, p) => sum + p.amount, 0);
    const formattedDue = formatCurrency(totalDueToday);
    
    if (scheduledPayments.dueToday.length === 1) {
      message += `Atenção! Você tem ${scheduledPayments.dueToday[0].name} para pagar hoje, no valor de ${formattedDue}. `;
    } else {
      const names = scheduledPayments.dueToday.map(p => p.name).join(', ');
      message += `Atenção! Você tem ${scheduledPayments.dueToday.length} pagamentos para hoje: ${names}. Totalizando ${formattedDue}. `;
    }
  } else {
    message += `Você não tem contas para pagar hoje. `;
  }
  
  // Add salary/advance info if it's the day
  if (salaryInfo) {
    const { salaryDay, salaryAmount, advanceDay, advanceAmount } = salaryInfo;
    const today = new Date().getDate();
    
    if (salaryDay === today && salaryAmount > 0) {
      const formatted = formatCurrency(salaryAmount);
      message += `Seu salário de ${formatted} foi creditado hoje! `;
    } else if (advanceDay === today && advanceAmount > 0) {
      const formatted = formatCurrency(advanceAmount);
      message += `Seu adiantamento de ${formatted} foi creditado hoje! `;
    }
  }
  
  // Add payments due soon (only if no payments today)
  if (scheduledPayments.dueSoon.length > 0 && scheduledPayments.dueToday.length === 0) {
    const nextPayment = scheduledPayments.dueSoon[0];
    const daysUntil = calculateDaysUntil(nextPayment.dueDay);
    const formattedAmount = formatCurrency(nextPayment.amount);
    
    if (daysUntil === 1) {
      message += `Amanhã você tem ${nextPayment.name} para pagar, no valor de ${formattedAmount}. `;
    } else {
      message += `Em ${daysUntil} dias você tem ${nextPayment.name} para pagar. `;
    }
  }
  
  message += 'Que posso fazer por você?';
  
  return message;
}

/**
 * Format currency for speech
 */
function formatCurrency(value: number): string {
  const reais = Math.floor(value);
  const centavos = Math.round((value - reais) * 100);
  
  if (centavos === 0) {
    return `${reais} reais`;
  }
  return `${reais} reais e ${centavos} centavos`;
}

/**
 * Handle notification permission and reminders
 */
async function handleNotificationReminders(salaryInfo: {
  salaryAmount: number;
  salaryDay: number;
  advanceAmount: number;
  advanceDay: number | null;
}): Promise<void> {
  // Request permission if not granted
  if (!hasNotificationPermission()) {
    const granted = await requestNotificationPermission();
    if (!granted) return;
  }

  // Check if we should send reminders today
  if (!shouldCheckReminders()) return;

  // Send reminders if tomorrow is payment day
  checkAndSendPaymentReminders(
    salaryInfo.salaryDay,
    salaryInfo.salaryAmount,
    salaryInfo.advanceDay,
    salaryInfo.advanceAmount
  );

  // Mark as checked
  markReminderChecked();
}
