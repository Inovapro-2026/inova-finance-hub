import { useEffect, useRef } from 'react';
import { speakNative, initNativeTts, hasVoiceSelected } from '@/services/nativeTtsService';
import { getUserSalaryInfo, calculateDaysUntil } from '@/lib/plannerDb';
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
  enabled?: boolean;
}

const LAST_GREETING_KEY = 'inovabank_last_greeting';

/**
 * Hook to handle INOVA AI greeting on login
 * Also handles notification permission request and reminders
 */
export function useLoginGreeting({ userId, userName, enabled = true }: UseLoginGreetingOptions) {
  const hasGreeted = useRef(false);

  useEffect(() => {
    if (!enabled || !userId || hasGreeted.current) return;

    const performGreeting = async () => {
      // Check if we already greeted today
      const lastGreeting = localStorage.getItem(LAST_GREETING_KEY);
      const today = new Date().toDateString();
      
      if (lastGreeting === today) {
        hasGreeted.current = true;
        return;
      }

      // Wait for voice to be ready
      if (!hasVoiceSelected()) {
        await new Promise<void>((resolve) => {
          initNativeTts(() => resolve());
        });
      }

      // Get salary info for context
      const salaryInfo = await getUserSalaryInfo(userId);
      
      // Build greeting message
      let greeting = buildGreetingMessage(userName, salaryInfo);
      
      // Mark as greeted
      hasGreeted.current = true;
      localStorage.setItem(LAST_GREETING_KEY, today);

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
    };

    performGreeting();
  }, [userId, userName, enabled]);
}

/**
 * Build personalized greeting message
 */
function buildGreetingMessage(
  userName: string, 
  salaryInfo: { salaryAmount: number; salaryDay: number; advanceAmount: number; advanceDay: number | null } | null
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
  
  if (salaryInfo) {
    const { salaryDay, salaryAmount, advanceDay, advanceAmount } = salaryInfo;
    const today = new Date().getDate();
    
    // Check if today is salary day
    if (salaryDay === today && salaryAmount > 0) {
      const formatted = formatCurrency(salaryAmount);
      message += `Hoje é dia ${salaryDay}, seu salário de ${formatted} foi creditado! `;
    }
    // Check if today is advance day
    else if (advanceDay === today && advanceAmount > 0) {
      const formatted = formatCurrency(advanceAmount);
      message += `Hoje é dia ${advanceDay}, seu adiantamento de ${formatted} foi creditado! `;
    }
    // Check days until next payment
    else {
      const daysUntilSalary = salaryDay ? calculateDaysUntil(salaryDay) : 999;
      const daysUntilAdvance = advanceDay ? calculateDaysUntil(advanceDay) : 999;
      
      if (daysUntilSalary <= 3 && salaryAmount > 0) {
        const formatted = formatCurrency(salaryAmount);
        if (daysUntilSalary === 1) {
          message += `Amanhã é dia de salário! ${formatted} será creditado. `;
        } else {
          message += `Faltam ${daysUntilSalary} dias para o seu salário de ${formatted}. `;
        }
      } else if (daysUntilAdvance <= 3 && advanceAmount > 0) {
        const formatted = formatCurrency(advanceAmount);
        if (daysUntilAdvance === 1) {
          message += `Amanhã é dia de adiantamento! ${formatted} será creditado. `;
        } else {
          message += `Faltam ${daysUntilAdvance} dias para o seu adiantamento de ${formatted}. `;
        }
      } else {
        message += 'Estou aqui para ajudar com suas finanças! ';
      }
    }
  } else {
    message += 'Estou aqui para ajudar com suas finanças! ';
  }

  message += 'Que posso fazer por você hoje?';
  
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
