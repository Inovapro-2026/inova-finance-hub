import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send, Sparkles, Volume2, VolumeX, Keyboard, X, Check, Edit3, ArrowDown, ArrowUp, Target, Utensils, Car, Gamepad2, ShoppingBag, Heart, GraduationCap, Receipt, MoreHorizontal, Briefcase, Laptop, TrendingUp, Gift, Wallet, CreditCard, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { calculateBalance, getTransactions, addTransaction, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/db';
import { getScheduledPayments, getUserSalaryInfo, calculateMonthlySummary } from '@/lib/plannerDb';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { initNativeTts, speakNative, stopSpeaking as stopNativeSpeaking, hasVoiceSelected } from '@/services/nativeTtsService';
import { SchedulePaymentModal } from '@/components/SchedulePaymentModal';
import { addScheduledPayment } from '@/lib/plannerDb';

interface FinancialContext {
  balance: number;
  debitBalance: number;
  totalIncome: number;
  totalExpense: number;
  creditLimit: number;
  creditUsed: number;
  creditDueDay: number;
  daysUntilDue: number;
  salaryAmount: number;
  salaryDay: number;
  monthlyPaymentsTotal: number;
  projectedBalance: number;
  todayExpenses: number;
  todayIncome: number;
  scheduledPayments: Array<{
    name: string;
    amount: number;
    dueDay: number;
    category: string;
  }>;
  recentTransactions: Array<{
    amount: number;
    type: string;
    category: string;
    description: string;
    date: string;
  }>;
}

interface PendingTransaction {
  amount: number;
  type: 'income' | 'expense';
  paymentMethod: 'debit' | 'credit';
  category: string;
  description: string;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'Alimentação': Utensils,
  'Transporte': Car,
  'Lazer': Gamepad2,
  'Compras': ShoppingBag,
  'Saúde': Heart,
  'Educação': GraduationCap,
  'Contas': Receipt,
  'Outros': MoreHorizontal,
  'Salário': Briefcase,
  'Freelance': Laptop,
  'Investimentos': TrendingUp,
  'Presente': Gift,
};

// Rotating Tips Component
interface TipItem {
  label: string;
  icon: React.ElementType;
  color: string;
}

function RotatingTip({ 
  tips, 
  onTipClick, 
  disabled 
}: { 
  tips: TipItem[]; 
  onTipClick: (tip: string) => void;
  disabled: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % tips.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [tips.length]);

  const currentTip = tips[currentIndex];
  const Icon = currentTip.icon;
  
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.3)]',
    red: 'bg-red-500/20 text-red-400 border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.3)]',
    green: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.3)]',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.3)]',
  };

  return (
    <AnimatePresence mode="wait">
      <motion.button
        key={currentIndex}
        disabled={disabled}
        onClick={() => onTipClick(currentTip.label)}
        className={cn(
          "px-5 py-3 text-sm rounded-full transition-all duration-300 border flex items-center gap-2.5 backdrop-blur-sm",
          disabled 
            ? "opacity-50 cursor-not-allowed bg-muted/30 border-transparent" 
            : cn("cursor-pointer", colorClasses[currentTip.color])
        )}
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.9 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        whileHover={!disabled ? { scale: 1.05 } : undefined}
        whileTap={!disabled ? { scale: 0.95 } : undefined}
      >
        <motion.div
          initial={{ rotate: -20 }}
          animate={{ rotate: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Icon className="w-4 h-4" />
        </motion.div>
        <span>{currentTip.label}</span>
        <motion.div 
          className="flex gap-1 ml-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {tips.map((_, i) => (
            <div 
              key={i} 
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all duration-300",
                i === currentIndex ? "bg-current scale-110" : "bg-current/30"
              )}
            />
          ))}
        </motion.div>
      </motion.button>
    </AnimatePresence>
  );
}

export default function AI() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceReady, setVoiceReady] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [input, setInput] = useState('');
  const [statusText, setStatusText] = useState('Toque para falar');
  const [pendingTransaction, setPendingTransaction] = useState<PendingTransaction | null>(null);
  const [editingAmount, setEditingAmount] = useState(false);
  const [editedAmount, setEditedAmount] = useState('');
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [currentDebitBalance, setCurrentDebitBalance] = useState(0);
  const [currentCreditAvailable, setCurrentCreditAvailable] = useState(0);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedulePreFill, setSchedulePreFill] = useState<{
    amount?: number;
    dueDay?: number;
    name?: string;
  } | null>(null);
  const [installments, setInstallments] = useState(1);
  const [showInstallments, setShowInstallments] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Initialize native TTS with voice selection
  useEffect(() => {
    if (hasVoiceSelected()) {
      setVoiceReady(true);
    }
    
    initNativeTts(() => {
      setVoiceReady(true);
    });

    return () => {
      stopNativeSpeaking();
    };
  }, []);

  // TTS function using native voice
  const speak = useCallback(async (text: string) => {
    if (!voiceEnabled) return;

    try {
      setIsSpeaking(true);
      await speakNative(text);
      setIsSpeaking(false);
    } catch (err) {
      console.error('TTS error:', err);
      setIsSpeaking(false);
    }
  }, [voiceEnabled]);

  const handleStopSpeaking = useCallback(() => {
    stopNativeSpeaking();
    setIsSpeaking(false);
  }, []);

  const getFinancialContext = async (): Promise<FinancialContext> => {
    if (!user) return { 
      balance: 0, 
      debitBalance: 0,
      totalIncome: 0, 
      totalExpense: 0, 
      creditLimit: 0,
      creditUsed: 0,
      creditDueDay: 5,
      daysUntilDue: 0,
      salaryAmount: 0,
      salaryDay: 5,
      monthlyPaymentsTotal: 0,
      projectedBalance: 0,
      todayExpenses: 0,
      todayIncome: 0,
      scheduledPayments: [],
      recentTransactions: [] 
    };

    const { balance, debitBalance, totalIncome, totalExpense, creditUsed } = await calculateBalance(user.userId, user.initialBalance);
    const transactions = await getTransactions(user.userId);
    const recentTransactions = transactions.slice(0, 10).map((t) => ({
      amount: t.amount,
      type: t.type,
      category: t.category,
      description: t.description,
      date: t.date.toISOString().split('T')[0],
    }));

    // Get today's transactions
    const today = new Date().toISOString().split('T')[0];
    const todayTransactions = transactions.filter(t => t.date.toISOString().split('T')[0] === today);
    const todayExpenses = todayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const todayIncome = todayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);

    // Get salary and scheduled payments info
    const salaryInfo = await getUserSalaryInfo(user.userId);
    const salaryAmount = salaryInfo?.salaryAmount || 0;
    const salaryDay = salaryInfo?.salaryDay || 5;
    
    const scheduledPayments = await getScheduledPayments(user.userId);
    const monthlySummary = await calculateMonthlySummary(user.userId, salaryAmount, salaryDay);

    // Calculate days until credit due date
    const todayDate = new Date();
    const dueDay = user.creditDueDay || 5;
    let dueDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), dueDay);
    
    if (todayDate.getDate() > dueDay) {
      // Due date already passed this month, use next month
      dueDate = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, dueDay);
    }
    
    const diffTime = dueDate.getTime() - todayDate.getTime();
    const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return { 
      balance, 
      debitBalance,
      totalIncome, 
      totalExpense, 
      creditLimit: user.creditLimit || 5000,
      creditUsed: creditUsed || 0,
      creditDueDay: dueDay,
      daysUntilDue,
      salaryAmount,
      salaryDay,
      monthlyPaymentsTotal: monthlySummary.totalPayments,
      projectedBalance: monthlySummary.projectedBalance,
      todayExpenses,
      todayIncome,
      scheduledPayments: scheduledPayments.map(p => ({
        name: p.name,
        amount: p.amount,
        dueDay: p.dueDay,
        category: p.category,
      })),
      recentTransactions 
    };
  };

  // Check for schedule payment command and extract data
  const parseScheduleCommand = (message: string): { isSchedule: boolean; amount?: number; dueDay?: number; name?: string } => {
    const normalizedMessage = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Check if contains "dia" + number (day pattern) - this is the key indicator for scheduling
    const hasDayPattern = /dia\s*\d{1,2}/.test(normalizedMessage);
    
    const schedulePatterns = [
      'agendar',
      'agenda',
      'pagar dia',
      'pagamento dia',
      'pagar no dia',
      'pagamento no dia',
      'lembrete',
      'me lembre',
      'inova lembre',
      'inova me lembre',
      'todo dia',
      'todo mes',
      'reais dia',
      'reais no dia',
      'no dia',
    ];
    
    const hasScheduleWord = schedulePatterns.some(pattern => normalizedMessage.includes(pattern));
    
    // If has "dia X" pattern with payment context words, it's a schedule
    const paymentContextWords = ['pagar', 'pagamento', 'conta', 'boleto', 'fatura', 'aluguel', 'luz', 'agua', 'internet', 'reais'];
    const hasPaymentContext = paymentContextWords.some(word => normalizedMessage.includes(word));
    
    const isSchedule = hasScheduleWord || (hasDayPattern && hasPaymentContext);
    if (!isSchedule) return { isSchedule: false };
    
    // Extract amount - look for patterns like "600 reais", "R$ 500", "de 300"
    const amountPatterns = [
      /(\d+(?:[.,]\d{2})?)\s*reais/i,
      /r\$\s*(\d+(?:[.,]\d{2})?)/i,
      /de\s*(\d+(?:[.,]\d{2})?)/i,
      /(\d+(?:[.,]\d{2})?)\s*(?:no dia|dia)/i,
    ];
    
    let amount: number | undefined;
    for (const pattern of amountPatterns) {
      const match = message.match(pattern);
      if (match) {
        amount = parseFloat(match[1].replace(',', '.'));
        break;
      }
    }
    
    // Extract day - look for patterns like "dia 20", "no dia 15"
    const dayPatterns = [
      /dia\s*(\d{1,2})/i,
      /no dia\s*(\d{1,2})/i,
      /todo dia\s*(\d{1,2})/i,
    ];
    
    let dueDay: number | undefined;
    for (const pattern of dayPatterns) {
      const match = message.match(pattern);
      if (match) {
        const day = parseInt(match[1], 10);
        if (day >= 1 && day <= 31) {
          dueDay = day;
          break;
        }
      }
    }
    
    // Try to extract description/name - what comes after value or before "dia"
    let name: string | undefined;
    const descPatterns = [
      /(?:pagar|pagamento|agendar)\s+(?:de\s+)?(?:\d+\s*reais?\s+)?(?:de\s+)?(.+?)(?:\s+dia|\s+no dia|$)/i,
      /(?:lembrete|lembre)\s+(?:de\s+)?(?:pagar\s+)?(.+?)(?:\s+\d|\s+dia|$)/i,
    ];
    
    for (const pattern of descPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const extracted = match[1].trim().replace(/\d+\s*reais?/gi, '').trim();
        if (extracted && extracted.length > 1 && !/^\d+$/.test(extracted)) {
          name = extracted.charAt(0).toUpperCase() + extracted.slice(1);
          break;
        }
      }
    }
    
    return { isSchedule: true, amount, dueDay, name };
  };

  const processMessage = async (message: string) => {
    if (!message.trim()) return;
    
    if (!user) {
      toast.error('Faça login para usar a assistente');
      return;
    }

    // Check for schedule payment command
    const scheduleData = parseScheduleCommand(message);
    if (scheduleData.isSchedule) {
      const hasData = scheduleData.amount || scheduleData.dueDay || scheduleData.name;
      
      if (hasData) {
        setSchedulePreFill({
          amount: scheduleData.amount,
          dueDay: scheduleData.dueDay,
          name: scheduleData.name,
        });
        
        const parts = [];
        if (scheduleData.amount) parts.push(`${scheduleData.amount} reais`);
        if (scheduleData.dueDay) parts.push(`dia ${scheduleData.dueDay}`);
        if (scheduleData.name) parts.push(`para ${scheduleData.name}`);
        
        speak(`Abrindo agendamento${parts.length > 0 ? ': ' + parts.join(', ') : ''}. Complete as opções no formulário.`);
      } else {
        setSchedulePreFill(null);
        speak('Abrindo o agendador de pagamentos. Configure seu lembrete no formulário.');
      }
      
      setShowScheduleModal(true);
      setStatusText('Agendar pagamento');
      return;
    }

    setIsLoading(true);
    setStatusText('Processando...');

    try {
      const context = await getFinancialContext();

      const response = await fetch(
        'https://pahvovxnhqsmcnqncmys.supabase.co/functions/v1/gemini-assistant',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, context }),
        }
      );

      const data = await response.json();

      if (data.error) throw new Error(data.error);

      // Check if a transaction needs confirmation
      if (data.functionCall?.name === 'record_transaction') {
        const { args } = data.functionCall;
        
        // Calculate real debit balance
        const { debitBalance } = await calculateBalance(user.userId, user.initialBalance);
        const realDebitBalance = Math.max(0, debitBalance); // Never show negative
        const creditAvailable = (user.creditLimit || 0) - (user.creditUsed || 0);
        const realCreditAvailable = Math.max(0, creditAvailable);
        
        setCurrentDebitBalance(realDebitBalance);
        setCurrentCreditAvailable(realCreditAvailable);
        
        // Auto-select credit if no debit balance available
        const defaultPaymentMethod = realDebitBalance <= 0 && user.hasCreditCard ? 'credit' : 'debit';
        
        setPendingTransaction({
          amount: args.amount,
          type: args.type as 'income' | 'expense',
          paymentMethod: defaultPaymentMethod,
          category: args.category,
          description: args.description,
        });
        setEditedAmount(args.amount.toString());
        setStatusText('Confirme a transação');
        
        // Build intelligent speech based on balance situation
        if (args.type === 'expense') {
          const totalAvailable = realDebitBalance + realCreditAvailable;
          const minInstallments = realCreditAvailable > 0 ? Math.ceil(args.amount / realCreditAvailable) : 0;
          const canInstallment = minInstallments > 1 && minInstallments <= 12;
          
          if (args.amount > totalAvailable && !canInstallment) {
            // No balance anywhere and can't installment
            speak(`Atenção! Gasto de ${args.amount} reais em ${args.category}. Você não tem saldo suficiente. Débito zerado e limite de crédito insuficiente.`);
          } else if (realDebitBalance <= 0 && realCreditAvailable <= 0) {
            // No balance at all
            speak(`Atenção! Você não tem saldo no débito nem limite no crédito disponível para registrar esse gasto.`);
          } else if (realDebitBalance <= 0 && args.amount > realCreditAvailable && canInstallment) {
            // No debit, exceeds credit but can installment
            speak(`Gasto de ${args.amount} reais em ${args.category}. Débito zerado. O valor excede seu limite de crédito de ${realCreditAvailable.toFixed(0)} reais, mas você pode parcelar em até ${minInstallments} vezes.`);
          } else if (realDebitBalance <= 0 && args.amount <= realCreditAvailable) {
            // No debit but fits in credit
            speak(`Gasto de ${args.amount} reais em ${args.category}. Débito zerado, usando crédito. Limite disponível: ${realCreditAvailable.toFixed(0)} reais.`);
          } else if (args.amount > realDebitBalance && user.hasCreditCard && args.amount <= realCreditAvailable) {
            // Exceeds debit but fits credit
            speak(`Gasto de ${args.amount} reais em ${args.category}. Seu débito tem apenas ${realDebitBalance.toFixed(0)} reais. Você pode usar o crédito.`);
          } else if (args.amount > realDebitBalance && user.hasCreditCard && canInstallment) {
            // Exceeds both but can installment
            speak(`Gasto de ${args.amount} reais. Débito insuficiente e excede o crédito. Você pode parcelar em ${minInstallments} vezes ou mais.`);
          } else {
            speak(`Registrar gasto de ${args.amount} reais em ${args.category}? Escolha débito ou crédito.`);
          }
        } else {
          speak(`Registrar ganho de ${args.amount} reais em ${args.category}?`);
        }
      } else {
        setStatusText('Pronta para ajudar');
        speak(data.message);
      }
    } catch (error) {
      console.error('Error calling AI:', error);
      setStatusText('Erro ao processar');
      toast.error('Erro ao conectar com a IA');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmTransaction = async () => {
    if (!pendingTransaction || !user || isSaving) return;

    const finalAmount = editingAmount ? parseFloat(editedAmount) : pendingTransaction.amount;
    
    if (isNaN(finalAmount) || finalAmount <= 0) {
      toast.error('Valor inválido');
      return;
    }

    // Check credit limit if using credit (consider installments)
    if (pendingTransaction.type === 'expense' && pendingTransaction.paymentMethod === 'credit') {
      const availableCredit = (user.creditLimit || 5000) - (user.creditUsed || 0);
      const amountPerInstallment = finalAmount / installments;
      
      if (amountPerInstallment > availableCredit) {
        toast.error(`Limite de crédito insuficiente. Disponível: R$ ${availableCredit.toFixed(2)}`);
        return;
      }
    }

    setIsSaving(true);
    
    try {
      // For installment purchases, only register the first installment amount now
      // The full amount affects the credit used, but we track it differently
      const isInstallment = installments > 1 && pendingTransaction.paymentMethod === 'credit';
      const amountToRegister = isInstallment ? (finalAmount / installments) : finalAmount;
      const description = isInstallment 
        ? `${pendingTransaction.description} (1/${installments}x de R$ ${amountToRegister.toFixed(2)})`
        : pendingTransaction.description;

      await addTransaction({
        amount: amountToRegister,
        type: pendingTransaction.type,
        paymentMethod: pendingTransaction.type === 'expense' ? pendingTransaction.paymentMethod : 'debit',
        category: pendingTransaction.category,
        description: description,
        date: new Date(),
        userId: user.userId,
      });

      await refreshUser();

      const methodText = pendingTransaction.type === 'expense' 
        ? pendingTransaction.paymentMethod === 'credit' ? ' no crédito' : ' no débito'
        : '';
      
      const installmentText = isInstallment 
        ? ` em ${installments}x de R$ ${amountToRegister.toFixed(2)}`
        : '';

      toast.success('Transação registrada!', {
        description: `${pendingTransaction.type === 'expense' ? 'Gasto' : 'Ganho'} de R$ ${finalAmount.toFixed(2)}${methodText}${installmentText}`,
      });

      speak(`Transação registrada com sucesso${methodText}${installmentText}!`);
      setPendingTransaction(null);
      setEditingAmount(false);
      setInstallments(1);
      setShowInstallments(false);
      setStatusText('Pronta para ajudar');
    } finally {
      setIsSaving(false);
    }
  };

  const updateCategory = (categoryId: string) => {
    if (!pendingTransaction) return;
    // If clicking "Outros", show custom input
    if (categoryId === 'Outros') {
      setShowCustomCategory(true);
      setCustomCategoryInput('');
      return;
    }
    setShowCustomCategory(false);
    setPendingTransaction({ ...pendingTransaction, category: categoryId });
  };

  const confirmCustomCategory = () => {
    if (!pendingTransaction || !customCategoryInput.trim()) return;
    const customName = customCategoryInput.trim().charAt(0).toUpperCase() + customCategoryInput.trim().slice(1).toLowerCase();
    setPendingTransaction({ ...pendingTransaction, category: customName });
    setShowCustomCategory(false);
    setCustomCategoryInput('');
  };

  const updatePaymentMethod = (method: 'debit' | 'credit') => {
    if (!pendingTransaction) return;
    setPendingTransaction({ ...pendingTransaction, paymentMethod: method });
  };

  const cancelTransaction = () => {
    setPendingTransaction(null);
    setEditingAmount(false);
    setShowCustomCategory(false);
    setCustomCategoryInput('');
    setInstallments(1);
    setShowInstallments(false);
    setStatusText('Pronta para ajudar');
    speak('Transação cancelada');
  };

  const toggleListening = () => {
    // Stop speaking if currently speaking
    if (isSpeaking) {
      handleStopSpeaking();
    }
    
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Reconhecimento de voz não suportado');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setStatusText('Ouvindo...');
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      processMessage(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setStatusText('Erro no reconhecimento');
      toast.error('Erro no reconhecimento de voz');
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleKeyboardSend = () => {
    if (!input.trim()) return;
    processMessage(input);
    setInput('');
    setShowKeyboard(false);
  };

  const categories = pendingTransaction?.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const handleSchedulePayment = async (payment: {
    name: string;
    amount: number;
    dueDay: number;
    isRecurring: boolean;
    specificMonth?: Date;
    category: string;
  }) => {
    if (!user) return;

    const id = await addScheduledPayment({
      userId: user.userId,
      name: payment.name,
      amount: payment.amount,
      dueDay: payment.dueDay,
      isRecurring: payment.isRecurring,
      specificMonth: payment.specificMonth || null,
      category: payment.category,
      lastPaidAt: null,
    });

    if (id) {
      toast.success('Pagamento agendado!');
      speak('Pagamento agendado com sucesso!');
      setStatusText('Pronta para ajudar');
    } else {
      toast.error('Erro ao agendar pagamento');
    }
  };

  return (
    <>
      <SchedulePaymentModal
        isOpen={showScheduleModal}
        onClose={() => {
          setShowScheduleModal(false);
          setSchedulePreFill(null);
          setStatusText('Pronta para ajudar');
        }}
        onSchedule={handleSchedulePayment}
        preFill={schedulePreFill}
      />
      <motion.div
        className="min-h-screen pb-28 flex flex-col relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Animated Tech Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Grid Pattern */}
        <div className="absolute inset-0 grid-pattern opacity-20" />
        
        {/* Floating Particles */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={`particle-${i}`}
            className="absolute w-1 h-1 bg-primary/40 rounded-full"
            initial={{ 
              x: Math.random() * window.innerWidth, 
              y: Math.random() * window.innerHeight,
              opacity: 0.2 
            }}
            animate={{ 
              y: [null, Math.random() * -200 - 100],
              opacity: [0.2, 0.8, 0.2],
              scale: [1, 1.5, 1]
            }}
            transition={{ 
              duration: 4 + Math.random() * 4, 
              repeat: Infinity,
              delay: Math.random() * 2
            }}
          />
        ))}
        
        {/* Glowing Orbs */}
        <motion.div 
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl"
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ duration: 6, repeat: Infinity }}
        />
        <motion.div 
          className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-secondary/10 rounded-full blur-3xl"
          animate={{ 
            scale: [1.2, 1, 1.2],
            opacity: [0.15, 0.05, 0.15]
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div 
          className="absolute top-1/3 right-1/4 w-[250px] h-[250px] bg-accent/10 rounded-full blur-3xl"
          animate={{ 
            scale: [1, 1.3, 1],
            x: [0, 30, 0],
            y: [0, -20, 0]
          }}
          transition={{ duration: 10, repeat: Infinity }}
        />
        
        {/* Tech Lines - Only when active */}
        <AnimatePresence>
          {(isListening || isSpeaking || isLoading) && (
            <>
              {/* Horizontal scanning lines */}
              <motion.div
                className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
                initial={{ top: '0%', opacity: 0 }}
                animate={{ top: ['0%', '100%'], opacity: [0, 1, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent"
                initial={{ top: '100%', opacity: 0 }}
                animate={{ top: ['100%', '0%'], opacity: [0, 1, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear', delay: 1 }}
              />
              
              {/* Corner brackets */}
              <motion.div
                className="absolute top-20 left-6 w-12 h-12 border-l-2 border-t-2 border-primary/40"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: [0.3, 1, 0.3], scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <motion.div
                className="absolute top-20 right-6 w-12 h-12 border-r-2 border-t-2 border-primary/40"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: [0.3, 1, 0.3], scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
              />
              <motion.div
                className="absolute bottom-32 left-6 w-12 h-12 border-l-2 border-b-2 border-secondary/40"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: [0.3, 1, 0.3], scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, delay: 1 }}
              />
              <motion.div
                className="absolute bottom-32 right-6 w-12 h-12 border-r-2 border-b-2 border-secondary/40"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: [0.3, 1, 0.3], scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, delay: 1.5 }}
              />
            </>
          )}
        </AnimatePresence>
      </div>
      
      {/* Controls - Top Right */}
      <div className="absolute top-6 right-6 z-20 flex gap-2">
        
        {/* Voice Toggle */}
        <motion.button
          onClick={() => {
            if (isSpeaking) handleStopSpeaking();
            setVoiceEnabled(!voiceEnabled);
            toast.info(voiceEnabled ? 'Voz desativada' : 'Voz ativada');
          }}
          className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all border backdrop-blur-sm",
            voiceEnabled 
              ? 'bg-primary/20 text-primary border-primary/30' 
              : 'bg-muted/50 text-muted-foreground border-muted'
          )}
          whileTap={{ scale: 0.95 }}
        >
          {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </motion.button>
      </div>

      {/* Main Content - Centered Microphone */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
        {/* Title */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-12"
        >
          <motion.h1 
            className="font-display text-3xl font-bold gradient-text mb-2"
            animate={isListening || isSpeaking ? { 
              textShadow: ['0 0 20px hsl(var(--primary) / 0.5)', '0 0 40px hsl(var(--primary) / 0.8)', '0 0 20px hsl(var(--primary) / 0.5)']
            } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            INOVA
          </motion.h1>
          <p className="text-muted-foreground text-sm">Sua Assistente Financeira Inteligente</p>
        </motion.div>

        {/* Central Microphone Button */}
        <motion.div
          className="relative"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        >
          {/* Rotating Tech Ring - Always visible */}
          <motion.div
            className="absolute inset-0 rounded-full border border-primary/20"
            style={{ width: 180, height: 180, top: -40, left: -40 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          >
            {/* Ring dots */}
            {[0, 90, 180, 270].map((deg) => (
              <motion.div
                key={deg}
                className="absolute w-2 h-2 bg-primary/60 rounded-full"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: `rotate(${deg}deg) translateY(-90px) translateX(-50%)`
                }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, delay: deg / 360 }}
              />
            ))}
          </motion.div>
          
          {/* Counter-rotating ring */}
          <motion.div
            className="absolute inset-0 rounded-full border border-dashed border-secondary/15"
            style={{ width: 220, height: 220, top: -60, left: -60 }}
            animate={{ rotate: -360 }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          />

          {/* Pulsing Rings - Only when listening or speaking */}
          <AnimatePresence>
            {(isListening || isSpeaking) && (
              <>
                {/* Electric pulse rings */}
                {[...Array(4)].map((_, i) => (
                  <motion.div
                    key={`ring-${i}`}
                    className={cn(
                      "absolute inset-0 rounded-full",
                      isListening ? "border-2 border-destructive/50" : "border-2 border-secondary/40"
                    )}
                    initial={{ scale: 1, opacity: 0.8 }}
                    animate={{ scale: 2.5 + i * 0.5, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ 
                      duration: 2, 
                      repeat: Infinity, 
                      ease: 'easeOut',
                      delay: i * 0.4
                    }}
                    style={{ width: 160, height: 160, top: -30, left: -30 }}
                  />
                ))}
                
                {/* Orbiting particles */}
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={`orbit-${i}`}
                    className="absolute w-1.5 h-1.5 rounded-full"
                    style={{
                      background: isListening 
                        ? 'hsl(0 72% 51%)' 
                        : 'hsl(217 100% 65%)',
                      boxShadow: isListening 
                        ? '0 0 10px hsl(0 72% 51%)' 
                        : '0 0 10px hsl(217 100% 65%)'
                    }}
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: [0.5, 1, 0.5],
                      rotate: [0, 360],
                    }}
                    transition={{ 
                      rotate: { duration: 2 + i * 0.3, repeat: Infinity, ease: 'linear' },
                      opacity: { duration: 1, repeat: Infinity }
                    }}
                    exit={{ opacity: 0 }}
                  >
                    <motion.div
                      className="absolute"
                      style={{
                        width: 120 + i * 15,
                        height: 120 + i * 15,
                        top: -60 - i * 7.5 + 3,
                        left: -60 - i * 7.5 + 3,
                        transformOrigin: 'center',
                      }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: 'linear' }}
                    >
                      <div 
                        className="absolute w-1.5 h-1.5 rounded-full"
                        style={{
                          top: 0,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: isListening 
                            ? 'hsl(0 72% 51%)' 
                            : 'hsl(217 100% 65%)',
                          boxShadow: isListening 
                            ? '0 0 10px hsl(0 72% 51%)' 
                            : '0 0 10px hsl(217 100% 65%)'
                        }}
                      />
                    </motion.div>
                  </motion.div>
                ))}

                {/* Glowing backdrop */}
                <motion.div
                  className="absolute inset-0 rounded-full blur-2xl"
                  style={{ 
                    width: 200, 
                    height: 200, 
                    top: -50, 
                    left: -50,
                    background: isListening 
                      ? 'radial-gradient(circle, hsl(0 72% 51% / 0.4) 0%, transparent 70%)' 
                      : 'radial-gradient(circle, hsl(217 100% 65% / 0.4) 0%, transparent 70%)'
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </>
            )}
          </AnimatePresence>

          {/* Main Mic Button */}
          <motion.button
            onClick={toggleListening}
            disabled={isLoading || pendingTransaction !== null}
            className={cn(
              "relative w-28 h-28 rounded-full flex items-center justify-center transition-all overflow-hidden",
              isListening 
                ? "bg-gradient-to-br from-destructive to-destructive/80" 
                : isSpeaking
                ? "bg-gradient-to-br from-secondary to-secondary/80"
                : "bg-gradient-to-br from-primary to-secondary",
              isLoading && "opacity-50 cursor-not-allowed"
            )}
            animate={isListening ? {
              scale: [1, 1.08, 1],
              boxShadow: [
                '0 0 40px hsl(0 72% 51% / 0.5)',
                '0 0 80px hsl(0 72% 51% / 0.7)',
                '0 0 40px hsl(0 72% 51% / 0.5)',
              ]
            } : isSpeaking ? {
              scale: [1, 1.05, 1],
              boxShadow: [
                '0 0 40px hsl(217 100% 65% / 0.5)',
                '0 0 60px hsl(217 100% 65% / 0.7)',
                '0 0 40px hsl(217 100% 65% / 0.5)',
              ]
            } : {
              boxShadow: '0 0 60px hsl(254 90% 67% / 0.4)'
            }}
            transition={{ duration: 0.8, repeat: isListening || isSpeaking ? Infinity : 0 }}
            whileTap={{ scale: 0.95 }}
          >
            {/* Inner glow effect */}
            <motion.div
              className="absolute inset-0 rounded-full bg-white/10"
              animate={{ opacity: [0.1, 0.3, 0.1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            
            {/* Mic icon with animation */}
            <motion.div
              animate={isListening ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              {isListening ? (
                <MicOff className="w-10 h-10 text-white drop-shadow-lg" />
              ) : (
                <Mic className="w-10 h-10 text-white drop-shadow-lg" />
              )}
            </motion.div>
          </motion.button>

          {/* Sound Waves - When speaking */}
          <AnimatePresence>
            {isSpeaking && (
              <motion.div 
                className="absolute -bottom-14 left-1/2 -translate-x-1/2 flex gap-1.5 items-center h-10"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                {[...Array(9)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1 bg-gradient-to-t from-secondary via-secondary to-secondary/40 rounded-full"
                    animate={{ 
                      height: [6, 20 + Math.random() * 16, 8, 24 + Math.random() * 12, 6],
                      opacity: [0.6, 1, 0.6]
                    }}
                    transition={{ 
                      duration: 0.6 + Math.random() * 0.4, 
                      repeat: Infinity, 
                      delay: i * 0.05 
                    }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Status Text */}
        <motion.p
          className={cn(
            "mt-16 text-center font-medium",
            isListening ? "text-destructive" : isSpeaking ? "text-secondary" : isLoading ? "text-warning" : "text-muted-foreground"
          )}
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {isLoading ? (
            <span className="flex items-center gap-2 justify-center">
              <motion.div
                className="w-2 h-2 bg-warning rounded-full"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
              Processando...
            </span>
          ) : statusText}
        </motion.p>

        {/* Rotating Quick Tips - One at a time */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 h-12 flex items-center justify-center"
        >
          <RotatingTip 
            tips={[
              { label: 'Qual meu saldo?', icon: Wallet, color: 'blue' },
              { label: 'Gastei 50 no almoço', icon: Utensils, color: 'green' },
              { label: 'Agendar 600 reais dia 20', icon: Calendar, color: 'purple' },
              { label: 'Quanto gastei hoje?', icon: ArrowDown, color: 'red' },
              { label: 'Me ajuda a economizar', icon: Target, color: 'blue' },
            ]}
            onTipClick={(tip) => {
              if (!user) {
                toast.error('Faça login para usar');
                return;
              }
              if (!isLoading && !pendingTransaction) {
                processMessage(tip);
              }
            }}
            disabled={isLoading || pendingTransaction !== null}
          />
        </motion.div>
      </div>

      {/* Keyboard Toggle Button */}
      <motion.button
        onClick={() => setShowKeyboard(!showKeyboard)}
        className="fixed bottom-32 right-6 w-14 h-14 rounded-2xl bg-muted/80 backdrop-blur-sm border border-border flex items-center justify-center z-20"
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
      >
        <Keyboard className="w-6 h-6 text-muted-foreground" />
      </motion.button>

      {/* Keyboard Input Overlay */}
      <AnimatePresence>
        {showKeyboard && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border p-6 pb-32 z-30"
          >
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setShowKeyboard(false)} className="p-2 text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
              <span className="text-sm text-muted-foreground">Digite sua mensagem</span>
            </div>
            <div className="flex gap-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleKeyboardSend()}
                placeholder="Ex: Gastei 50 com pizza..."
                className="h-14 bg-muted/30 border-border rounded-2xl text-base"
                autoFocus
              />
              <motion.button
                onClick={handleKeyboardSend}
                disabled={!input.trim()}
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center disabled:opacity-50"
                whileTap={{ scale: 0.9 }}
              >
                <Send className="w-5 h-5 text-white" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction Confirmation Popup */}
      <AnimatePresence>
        {pendingTransaction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-card border border-border rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center",
                    pendingTransaction.type === 'expense' 
                      ? "bg-destructive/20 text-destructive" 
                      : "bg-success/20 text-success"
                  )}>
                    {pendingTransaction.type === 'expense' ? (
                      <ArrowDown className="w-6 h-6" />
                    ) : (
                      <ArrowUp className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold">
                      {pendingTransaction.type === 'expense' ? 'Registrar Gasto' : 'Registrar Ganho'}
                    </h3>
                    <p className="text-xs text-muted-foreground">{pendingTransaction.description}</p>
                  </div>
                </div>
                <button onClick={cancelTransaction} className="p-2 text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Amount */}
              <div className="mb-6">
                <label className="text-xs text-muted-foreground mb-2 block">Valor</label>
                {editingAmount ? (
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">R$</span>
                    <Input
                      type="number"
                      value={editedAmount}
                      onChange={(e) => setEditedAmount(e.target.value)}
                      className="text-3xl font-bold h-14 bg-muted/30"
                      autoFocus
                    />
                    <button 
                      onClick={() => setEditingAmount(false)}
                      className="p-2 bg-primary/20 rounded-lg text-primary"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-4xl font-bold",
                      pendingTransaction.type === 'expense' ? "text-destructive" : "text-success"
                    )}>
                      R$ {pendingTransaction.amount.toFixed(2)}
                    </span>
                    <button 
                      onClick={() => setEditingAmount(true)}
                      className="p-2 bg-muted/50 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                      <Edit3 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Payment Method Selection (only for expenses) */}
              {pendingTransaction.type === 'expense' && (
                <div className="mb-6">
                  <label className="text-xs text-muted-foreground mb-3 block">Pagar com</label>
                  <div className="flex gap-2">
                    {/* Only show debit if there's balance available */}
                    {currentDebitBalance > 0 && (
                      <motion.button
                        onClick={() => updatePaymentMethod('debit')}
                        className={cn(
                          "flex-1 py-4 rounded-xl font-medium transition-all flex flex-col items-center gap-2 border",
                          pendingTransaction.paymentMethod === 'debit'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                            : 'bg-muted/30 border-transparent text-muted-foreground hover:border-border'
                        )}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Wallet className="w-6 h-6" />
                        <span className="text-sm">Débito</span>
                        <span className="text-[10px] text-muted-foreground">
                          Saldo: R$ {currentDebitBalance.toFixed(2)}
                        </span>
                      </motion.button>
                    )}
                    
                    {/* Show credit option if user has credit card */}
                    {user?.hasCreditCard && (
                      <motion.button
                        onClick={() => updatePaymentMethod('credit')}
                        className={cn(
                          "flex-1 py-4 rounded-xl font-medium transition-all flex flex-col items-center gap-2 border",
                          pendingTransaction.paymentMethod === 'credit'
                            ? 'bg-secondary/20 text-secondary border-secondary/50'
                            : 'bg-muted/30 border-transparent text-muted-foreground hover:border-border'
                        )}
                        whileTap={{ scale: 0.95 }}
                      >
                        <CreditCard className="w-6 h-6" />
                        <span className="text-sm">Crédito</span>
                        <span className="text-[10px] text-muted-foreground">
                          Limite: R$ {currentCreditAvailable.toFixed(2)}
                        </span>
                      </motion.button>
                    )}
                    
                    {/* Show message if no payment method available */}
                    {currentDebitBalance <= 0 && !user?.hasCreditCard && (
                      <div className="flex-1 py-4 rounded-xl bg-destructive/10 border border-destructive/30 flex flex-col items-center gap-2">
                        <Wallet className="w-6 h-6 text-destructive" />
                        <span className="text-sm text-destructive">Sem saldo</span>
                        <span className="text-[10px] text-muted-foreground">
                          Saldo zerado
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Warning when debit is zero */}
                  {currentDebitBalance <= 0 && user?.hasCreditCard && (
                    <p className="text-xs text-warning mt-2 text-center">
                      ⚠️ Saldo débito zerado. Usando crédito.
                    </p>
                  )}
                </div>
              )}

              {/* Category Selection */}
              <div className="mb-6">
                <label className="text-xs text-muted-foreground mb-3 block">Categoria</label>
                
                {/* Custom category input */}
                <AnimatePresence>
                  {showCustomCategory && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-3 overflow-hidden"
                    >
                      <div className="flex gap-2">
                        <Input
                          value={customCategoryInput}
                          onChange={(e) => setCustomCategoryInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && confirmCustomCategory()}
                          placeholder="Digite a categoria..."
                          className="h-12 bg-muted/30 border-border rounded-xl"
                          autoFocus
                        />
                        <motion.button
                          onClick={confirmCustomCategory}
                          disabled={!customCategoryInput.trim()}
                          className="px-4 h-12 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 flex items-center justify-center"
                          whileTap={{ scale: 0.95 }}
                        >
                          <Check className="w-5 h-5" />
                        </motion.button>
                        <motion.button
                          onClick={() => setShowCustomCategory(false)}
                          className="px-4 h-12 rounded-xl bg-muted/50 text-muted-foreground flex items-center justify-center"
                          whileTap={{ scale: 0.95 }}
                        >
                          <X className="w-5 h-5" />
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Show current custom category if set */}
                {pendingTransaction.category && !categories.find(c => c.id === pendingTransaction.category) && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-3 p-3 bg-primary/20 border border-primary rounded-xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <MoreHorizontal className="w-5 h-5 text-primary" />
                      <span className="text-sm font-medium text-primary">{pendingTransaction.category}</span>
                    </div>
                    <button 
                      onClick={() => {
                        setShowCustomCategory(true);
                        setCustomCategoryInput(pendingTransaction.category);
                      }}
                      className="p-1 text-primary hover:text-primary/80"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}

                <div className="grid grid-cols-4 gap-2">
                  {categories.map((cat) => {
                    const Icon = CATEGORY_ICONS[cat.id] || MoreHorizontal;
                    const isSelected = pendingTransaction.category === cat.id;
                    const isOutros = cat.id === 'Outros';
                    return (
                      <motion.button
                        key={cat.id}
                        onClick={() => updateCategory(cat.id)}
                        className={cn(
                          "flex flex-col items-center gap-1 p-3 rounded-xl border transition-all",
                          isSelected 
                            ? "bg-primary/20 border-primary text-primary" 
                            : "bg-muted/30 border-transparent text-muted-foreground hover:border-border",
                          isOutros && "bg-secondary/10 hover:bg-secondary/20"
                        )}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-[10px]">{cat.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Insufficient balance warning and installment options */}
              {pendingTransaction.type === 'expense' && (() => {
                const transactionAmount = editingAmount ? parseFloat(editedAmount) : pendingTransaction.amount;
                const availableInMethod = pendingTransaction.paymentMethod === 'debit' 
                  ? currentDebitBalance 
                  : currentCreditAvailable;
                const totalAvailable = currentDebitBalance + currentCreditAvailable;
                const exceedsCurrentMethod = transactionAmount > availableInMethod;
                const exceedsAll = transactionAmount > totalAvailable;
                
                // Calculate how many installments needed to fit within credit limit
                const minInstallmentsNeeded = pendingTransaction.paymentMethod === 'credit' && currentCreditAvailable > 0
                  ? Math.ceil(transactionAmount / currentCreditAvailable)
                  : 0;
                const canUseInstallments = pendingTransaction.paymentMethod === 'credit' && 
                  exceedsCurrentMethod && 
                  currentCreditAvailable > 0 &&
                  minInstallmentsNeeded <= 12;
                
                // Calculate amount per installment
                const amountPerInstallment = transactionAmount / installments;
                const installmentFitsLimit = amountPerInstallment <= currentCreditAvailable;
                
                if (exceedsAll && !canUseInstallments) {
                  return (
                    <div className="mb-4 p-4 rounded-xl bg-destructive/10 border border-destructive/30">
                      <div className="flex items-center gap-2 text-destructive mb-2">
                        <X className="w-5 h-5" />
                        <span className="font-medium">Saldo insuficiente!</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Valor: R$ {transactionAmount.toFixed(2)} | Disponível total: R$ {totalAvailable.toFixed(2)}
                      </p>
                    </div>
                  );
                } else if (exceedsCurrentMethod && canUseInstallments) {
                  // Show installment option for credit when exceeds limit
                  return (
                    <div className="mb-4">
                      <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/30 mb-3">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 text-secondary">
                            <CreditCard className="w-5 h-5" />
                            <span className="font-medium">Parcelar no crédito?</span>
                          </div>
                          <motion.button
                            onClick={() => {
                              setShowInstallments(!showInstallments);
                              if (!showInstallments) {
                                setInstallments(minInstallmentsNeeded);
                              }
                            }}
                            className={cn(
                              "px-3 py-1 rounded-lg text-sm font-medium transition-all",
                              showInstallments 
                                ? "bg-secondary text-secondary-foreground" 
                                : "bg-secondary/20 text-secondary"
                            )}
                            whileTap={{ scale: 0.95 }}
                          >
                            {showInstallments ? 'Cancelar' : 'Parcelar'}
                          </motion.button>
                        </div>
                        
                        <p className="text-xs text-muted-foreground mb-2">
                          Limite: R$ {currentCreditAvailable.toFixed(2)} | Valor: R$ {transactionAmount.toFixed(2)}
                        </p>
                        
                        <AnimatePresence>
                          {showInstallments && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="pt-3 border-t border-secondary/20">
                                <label className="text-xs text-muted-foreground mb-2 block">
                                  Número de parcelas (mín. {minInstallmentsNeeded}x)
                                </label>
                                <div className="flex flex-wrap gap-2">
                                  {[...Array(12 - minInstallmentsNeeded + 1)].map((_, i) => {
                                    const numInstallments = minInstallmentsNeeded + i;
                                    const perInstallment = transactionAmount / numInstallments;
                                    const fitsLimit = perInstallment <= currentCreditAvailable;
                                    
                                    if (!fitsLimit) return null;
                                    
                                    return (
                                      <motion.button
                                        key={numInstallments}
                                        onClick={() => setInstallments(numInstallments)}
                                        className={cn(
                                          "px-3 py-2 rounded-xl text-sm font-medium transition-all border",
                                          installments === numInstallments
                                            ? "bg-secondary text-secondary-foreground border-secondary"
                                            : "bg-muted/30 text-muted-foreground border-transparent hover:border-secondary/30"
                                        )}
                                        whileTap={{ scale: 0.95 }}
                                      >
                                        <span className="block">{numInstallments}x</span>
                                        <span className="block text-[10px] opacity-70">
                                          R$ {perInstallment.toFixed(2)}
                                        </span>
                                      </motion.button>
                                    );
                                  })}
                                </div>
                                
                                {installments > 1 && installmentFitsLimit && (
                                  <div className="mt-3 p-2 rounded-lg bg-success/10 border border-success/30">
                                    <p className="text-xs text-success text-center">
                                      ✓ {installments}x de R$ {amountPerInstallment.toFixed(2)} (cabe no limite)
                                    </p>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  );
                } else if (exceedsCurrentMethod) {
                  return (
                    <div className="mb-4 p-4 rounded-xl bg-warning/10 border border-warning/30">
                      <div className="flex items-center gap-2 text-warning mb-2">
                        <span className="font-medium">⚠️ Limite do {pendingTransaction.paymentMethod === 'debit' ? 'débito' : 'crédito'} insuficiente</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Disponível: R$ {availableInMethod.toFixed(2)} | 
                        {pendingTransaction.paymentMethod === 'debit' && currentCreditAvailable > 0 
                          ? ` Tente usar crédito (R$ ${currentCreditAvailable.toFixed(2)})` 
                          : pendingTransaction.paymentMethod === 'credit' && currentDebitBalance > 0
                          ? ` Tente usar débito (R$ ${currentDebitBalance.toFixed(2)})`
                          : ' Reduza o valor'
                        }
                      </p>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Actions */}
              <div className="flex gap-3">
                <motion.button
                  onClick={cancelTransaction}
                  className="flex-1 h-14 rounded-2xl bg-muted/50 text-foreground font-medium"
                  whileTap={{ scale: 0.98 }}
                >
                  Cancelar
                </motion.button>
                {(() => {
                  const transactionAmount = editingAmount ? parseFloat(editedAmount) : pendingTransaction.amount;
                  const availableInMethod = pendingTransaction.paymentMethod === 'debit' 
                    ? currentDebitBalance 
                    : currentCreditAvailable;
                  
                  // Check if installments make it possible
                  const amountPerInstallment = transactionAmount / installments;
                  const installmentFitsLimit = pendingTransaction.paymentMethod === 'credit' && 
                    installments > 1 && 
                    amountPerInstallment <= currentCreditAvailable;
                  
                  const canConfirm = pendingTransaction.type === 'income' || 
                    transactionAmount <= availableInMethod ||
                    installmentFitsLimit;
                  
                  const buttonText = installmentFitsLimit 
                    ? `Parcelar ${installments}x` 
                    : canConfirm 
                    ? 'Confirmar' 
                    : 'Sem saldo';
                  
                  return (
                    <motion.button
                      onClick={confirmTransaction}
                      disabled={!canConfirm}
                      className={cn(
                        "flex-1 h-14 rounded-2xl font-medium flex items-center justify-center gap-2",
                        canConfirm 
                          ? "bg-gradient-to-br from-primary to-secondary text-white"
                          : "bg-muted/30 text-muted-foreground cursor-not-allowed"
                      )}
                      whileTap={canConfirm ? { scale: 0.98 } : undefined}
                    >
                      <Check className="w-5 h-5" />
                      {buttonText}
                    </motion.button>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </motion.div>
    </>
  );
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
