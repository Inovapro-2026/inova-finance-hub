// ISA Greeting Hook - Manages voice greetings for each page
import { useEffect, useRef, useCallback } from 'react';
import { 
  isaSpeak, 
  isFirstAccessToday, 
  markGreetedToday,
  wasTabGreeted,
  markTabGreeted,
  generateFirstAccessGreeting,
  generateHomeGreeting,
  generatePlannerGreeting,
  generateCardGreeting,
  generateProfileGreeting,
  calculateDaysUntilDay,
  isVoiceEnabled
} from '@/services/isaVoiceService';
import { calculateBalance, getTransactions, getGoals } from '@/lib/db';
import { 
  getScheduledPayments, 
  getUserSalaryInfo,
  calculateMonthlySummary 
} from '@/lib/plannerDb';

export type PageType = 'dashboard' | 'planner' | 'card' | 'goals' | 'ai' | 'other';

interface UseIsaGreetingOptions {
  pageType: PageType;
  userId: number;
  userName: string;
  initialBalance: number;
  enabled?: boolean;
  creditLimit?: number;
  creditUsed?: number;
}

export function useIsaGreeting({
  pageType,
  userId,
  userName,
  initialBalance,
  enabled = true,
  creditLimit = 0,
  creditUsed = 0
}: UseIsaGreetingOptions) {
  const hasSpoken = useRef(false);
  const isProcessing = useRef(false);

  const speakGreeting = useCallback(async () => {
    // Check global voice setting
    if (!isVoiceEnabled()) {
      console.log('ISA: Voice is globally disabled');
      return;
    }
    
    if (!enabled || !userId || hasSpoken.current || isProcessing.current) return;
    
    // Check if this tab was already greeted in this session
    if (wasTabGreeted(pageType)) {
      hasSpoken.current = true;
      return;
    }

    isProcessing.current = true;

    try {
      const isFirstAccess = isFirstAccessToday();
      
      // For first access of the day, give special greeting (only on dashboard)
      if (isFirstAccess && pageType === 'dashboard') {
        const greeting = generateFirstAccessGreeting(userName);
        await isaSpeak(greeting, pageType);
        markGreetedToday();
        markTabGreeted(pageType);
        hasSpoken.current = true;
        
        // After first greeting, continue with financial info
        await speakPageSpecificGreeting();
      } else {
        // Normal page-specific greeting
        await speakPageSpecificGreeting();
      }
    } catch (error) {
      console.error('ISA greeting error:', error);
    } finally {
      isProcessing.current = false;
    }
  }, [pageType, userId, userName, enabled, initialBalance, creditLimit, creditUsed]);

  const speakPageSpecificGreeting = async () => {
    try {
      let message = '';
      
      switch (pageType) {
        case 'dashboard': {
          const [balanceData, transactions, salaryInfo, scheduledPayments] = await Promise.all([
            calculateBalance(userId, initialBalance),
            getTransactions(userId),
            getUserSalaryInfo(userId),
            getScheduledPayments(userId)
          ]);
          
          // Calculate today's expenses
          const today = new Date().toDateString();
          const todayTransactions = transactions.filter(t => {
            const txDate = new Date(t.date).toDateString();
            return txDate === today && t.type === 'expense';
          });
          const todaySpent = todayTransactions.reduce((sum, t) => sum + t.amount, 0);
          
          // Calculate payments due today
          const todayDay = new Date().getDate();
          const paymentsDueToday = scheduledPayments
            .filter(p => p.dueDay === todayDay && p.isActive)
            .reduce((sum, p) => sum + p.amount, 0);
          
          // Days until salary
          const daysUntilSalary = salaryInfo?.salaryDay 
            ? calculateDaysUntilDay(salaryInfo.salaryDay)
            : null;
          
          message = generateHomeGreeting(
            userName,
            balanceData.debitBalance,
            todaySpent,
            paymentsDueToday,
            daysUntilSalary
          );
          break;
        }
        
        case 'planner': {
          const [goals, salaryInfo, scheduledPayments] = await Promise.all([
            getGoals(userId),
            getUserSalaryInfo(userId),
            getScheduledPayments(userId)
          ]);
          
          const activeGoals = goals.length;
          const goalsWithoutProgress = goals.filter(g => (g.currentAmount || 0) === 0).length;
          
          // Calculate monthly payments
          const summary = salaryInfo 
            ? await calculateMonthlySummary(userId, salaryInfo.salaryAmount, salaryInfo.salaryDay, salaryInfo.advanceAmount || 0)
            : null;
          const monthlyPayments = summary?.totalPayments || 0;
          
          const daysUntilSalary = salaryInfo?.salaryDay 
            ? calculateDaysUntilDay(salaryInfo.salaryDay)
            : null;
          
          message = generatePlannerGreeting(
            activeGoals,
            goalsWithoutProgress,
            monthlyPayments,
            daysUntilSalary
          );
          break;
        }
        
        case 'card': {
          message = generateCardGreeting(creditLimit, creditUsed);
          break;
        }
        
        case 'goals': {
          const goals = await getGoals(userId);
          message = generateProfileGreeting(goals.length);
          break;
        }
        
        default:
          return; // Don't speak on other pages
      }
      
      if (message) {
        await isaSpeak(message, pageType);
        markTabGreeted(pageType);
        hasSpoken.current = true;
      }
    } catch (error) {
      console.error('ISA page greeting error:', error);
    }
  };

  useEffect(() => {
    // Small delay to ensure page is loaded
    const timer = setTimeout(() => {
      speakGreeting();
    }, 500);

    return () => clearTimeout(timer);
  }, [speakGreeting]);

  return {
    speakGreeting,
    speakCustomMessage: async (message: string) => {
      await isaSpeak(message, pageType);
    }
  };
}
