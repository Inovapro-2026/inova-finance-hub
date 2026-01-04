import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send, Sparkles, Volume2, VolumeX, Keyboard, X, Check, Edit3, ArrowDown, ArrowUp, Target, Utensils, Car, Gamepad2, ShoppingBag, Heart, GraduationCap, Receipt, MoreHorizontal, Briefcase, Laptop, TrendingUp, Gift, Wallet, CreditCard, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { calculateBalance, getTransactions, addTransaction, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/db';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { initNativeTts, speakNative, stopSpeaking as stopNativeSpeaking, hasVoiceSelected } from '@/services/nativeTtsService';
import { SchedulePaymentModal } from '@/components/SchedulePaymentModal';
import { addScheduledPayment } from '@/lib/plannerDb';

interface FinancialContext {
  balance: number;
  totalIncome: number;
  totalExpense: number;
  creditLimit: number;
  creditUsed: number;
  creditDueDay: number;
  daysUntilDue: number;
  recentTransactions: Array<{
    amount: number;
    type: string;
    category: string;
    description: string;
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
  food: Utensils,
  transport: Car,
  entertainment: Gamepad2,
  shopping: ShoppingBag,
  health: Heart,
  education: GraduationCap,
  bills: Receipt,
  other: MoreHorizontal,
  salary: Briefcase,
  freelance: Laptop,
  investment: TrendingUp,
  gift: Gift,
};

export default function AI() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceReady, setVoiceReady] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [input, setInput] = useState('');
  const [statusText, setStatusText] = useState('Toque para falar');
  const [pendingTransaction, setPendingTransaction] = useState<PendingTransaction | null>(null);
  const [editingAmount, setEditingAmount] = useState(false);
  const [editedAmount, setEditedAmount] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Initialize native TTS with voice selection
  useEffect(() => {
    // Check if voice is already selected
    if (hasVoiceSelected()) {
      setVoiceReady(true);
    }
    
    // Initialize TTS service
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
      totalIncome: 0, 
      totalExpense: 0, 
      creditLimit: 0,
      creditUsed: 0,
      creditDueDay: 5,
      daysUntilDue: 0,
      recentTransactions: [] 
    };

    const { balance, totalIncome, totalExpense, creditUsed } = await calculateBalance(user.userId, user.initialBalance);
    const transactions = await getTransactions(user.userId);
    const recentTransactions = transactions.slice(0, 10).map((t) => ({
      amount: t.amount,
      type: t.type,
      category: t.category,
      description: t.description,
    }));

    // Calculate days until credit due date
    const today = new Date();
    const dueDay = user.creditDueDay || 5;
    let dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);
    
    if (today.getDate() > dueDay) {
      // Due date already passed this month, use next month
      dueDate = new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
    }
    
    const diffTime = dueDate.getTime() - today.getTime();
    const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return { 
      balance, 
      totalIncome, 
      totalExpense, 
      creditLimit: user.creditLimit || 5000,
      creditUsed: creditUsed || 0,
      creditDueDay: dueDay,
      daysUntilDue,
      recentTransactions 
    };
  };

  // Check for schedule payment command
  const isScheduleCommand = (message: string): boolean => {
    const normalizedMessage = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const schedulePatterns = [
      'inova me lembre',
      'inova lembre',
      'me lembre de pagar',
      'agendar pagamento',
      'lembrete de pagamento',
      'agendar lembrete',
    ];
    return schedulePatterns.some(pattern => normalizedMessage.includes(pattern));
  };

  const processMessage = async (message: string) => {
    if (!message.trim()) return;
    
    if (!user) {
      toast.error('Faça login para usar a assistente');
      return;
    }

    // Check for schedule payment command
    if (isScheduleCommand(message)) {
      speak('Abrindo o agendador de pagamentos. Configure seu lembrete no formulário.');
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
        setPendingTransaction({
          amount: args.amount,
          type: args.type as 'income' | 'expense',
          paymentMethod: 'debit', // Default to debit, user can change
          category: args.category,
          description: args.description,
        });
        setEditedAmount(args.amount.toString());
        setStatusText('Confirme a transação');
        speak(`Registrar ${args.type === 'expense' ? 'gasto' : 'ganho'} de ${args.amount} reais em ${args.category}? Escolha se é débito ou crédito.`);
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
    if (!pendingTransaction || !user) return;

    const finalAmount = editingAmount ? parseFloat(editedAmount) : pendingTransaction.amount;
    
    if (isNaN(finalAmount) || finalAmount <= 0) {
      toast.error('Valor inválido');
      return;
    }

    // Check credit limit if using credit
    if (pendingTransaction.type === 'expense' && pendingTransaction.paymentMethod === 'credit') {
      const availableCredit = (user.creditLimit || 5000) - (user.creditUsed || 0);
      if (finalAmount > availableCredit) {
        toast.error(`Limite de crédito insuficiente. Disponível: R$ ${availableCredit.toFixed(2)}`);
        return;
      }
    }

    await addTransaction({
      amount: finalAmount,
      type: pendingTransaction.type,
      paymentMethod: pendingTransaction.type === 'expense' ? pendingTransaction.paymentMethod : 'debit',
      category: pendingTransaction.category,
      description: pendingTransaction.description,
      date: new Date(),
      userId: user.userId,
    });

    await refreshUser();

    const methodText = pendingTransaction.type === 'expense' 
      ? pendingTransaction.paymentMethod === 'credit' ? ' no crédito' : ' no débito'
      : '';

    toast.success('Transação registrada!', {
      description: `${pendingTransaction.type === 'expense' ? 'Gasto' : 'Ganho'} de R$ ${finalAmount.toFixed(2)}${methodText}`,
    });

    speak(`Transação registrada com sucesso${methodText}!`);
    setPendingTransaction(null);
    setEditingAmount(false);
    setStatusText('Pronta para ajudar');
  };

  const updateCategory = (categoryId: string) => {
    if (!pendingTransaction) return;
    setPendingTransaction({ ...pendingTransaction, category: categoryId });
  };

  const updatePaymentMethod = (method: 'debit' | 'credit') => {
    if (!pendingTransaction) return;
    setPendingTransaction({ ...pendingTransaction, paymentMethod: method });
  };

  const cancelTransaction = () => {
    setPendingTransaction(null);
    setEditingAmount(false);
    setStatusText('Pronta para ajudar');
    speak('Transação cancelada');
  };

  const toggleListening = () => {
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
          setStatusText('Pronta para ajudar');
        }}
        onSchedule={handleSchedulePayment}
      />
      <motion.div
        className="min-h-screen pb-28 flex flex-col relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Background Effects */}
      <div className="absolute inset-0 grid-pattern opacity-30" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      
      {/* Voice Toggle - Top Right */}
      <div className="absolute top-6 right-6 z-20">
        <motion.button
          onClick={() => {
            if (isSpeaking) handleStopSpeaking();
            setVoiceEnabled(!voiceEnabled);
            toast.info(voiceEnabled ? 'Voz desativada' : 'Voz ativada');
          }}
          className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all border",
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
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Title */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-12"
        >
          <h1 className="font-display text-3xl font-bold gradient-text mb-2">NOVA</h1>
          <p className="text-muted-foreground text-sm">Assistente Financeira Inteligente</p>
        </motion.div>

        {/* Central Microphone Button */}
        <motion.div
          className="relative"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        >
          {/* Pulsing Rings - Only when listening or speaking */}
          <AnimatePresence>
            {(isListening || isSpeaking) && (
              <>
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-primary/40"
                  initial={{ scale: 1, opacity: 0.8 }}
                  animate={{ scale: 2.5, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                  style={{ width: 160, height: 160, top: -30, left: -30 }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-secondary/30"
                  initial={{ scale: 1, opacity: 0.6 }}
                  animate={{ scale: 3, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
                  style={{ width: 160, height: 160, top: -30, left: -30 }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full border border-primary/20"
                  initial={{ scale: 1, opacity: 0.4 }}
                  animate={{ scale: 3.5, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.6 }}
                  style={{ width: 160, height: 160, top: -30, left: -30 }}
                />
              </>
            )}
          </AnimatePresence>

          {/* Main Mic Button */}
          <motion.button
            onClick={toggleListening}
            disabled={isLoading || pendingTransaction !== null}
            className={cn(
              "relative w-28 h-28 rounded-full flex items-center justify-center transition-all",
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
            {isListening ? (
              <MicOff className="w-10 h-10 text-white" />
            ) : (
              <Mic className="w-10 h-10 text-white" />
            )}
          </motion.button>

          {/* Sound Waves - When speaking */}
          <AnimatePresence>
            {isSpeaking && (
              <motion.div 
                className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex gap-1 items-end h-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {[...Array(7)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 bg-gradient-to-t from-secondary to-secondary/60 rounded-full"
                    animate={{ height: [8, 24, 12, 28, 8] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.08 }}
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

        {/* Quick Tips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-10 flex flex-wrap gap-2 justify-center max-w-sm"
        >
        {[
            { label: 'Gastei 50 no almoço', icon: ArrowDown, color: 'red' },
            { label: 'Recebi 200 de freelance', icon: ArrowUp, color: 'green' },
            { label: 'Paguei 150 de uber', icon: ArrowDown, color: 'purple' },
          ].map((item, i) => {
            const Icon = item.icon;
            const colorClasses: Record<string, string> = {
              blue: 'hover:bg-blue-500/20 hover:text-blue-400 hover:border-blue-500/40 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]',
              red: 'hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/40 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)]',
              green: 'hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/40 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]',
              purple: 'hover:bg-purple-500/20 hover:text-purple-400 hover:border-purple-500/40 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)]',
            };
            return (
              <motion.button
                key={item.label}
                disabled={isLoading || pendingTransaction !== null}
                onClick={() => {
                  if (!user) {
                    toast.error('Faça login para usar');
                    return;
                  }
                  processMessage(item.label);
                }}
                className={cn(
                  "px-4 py-2.5 text-xs bg-muted/30 rounded-full transition-all duration-300 border border-transparent flex items-center gap-2",
                  isLoading || pendingTransaction 
                    ? "opacity-50 cursor-not-allowed" 
                    : cn("cursor-pointer", colorClasses[item.color as keyof typeof colorClasses])
                )}
                whileHover={!isLoading && !pendingTransaction ? { scale: 1.05 } : undefined}
                whileTap={!isLoading && !pendingTransaction ? { scale: 0.95 } : undefined}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </motion.button>
            );
          })}
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
                        Saldo: R$ {((user?.initialBalance || 0) - (user?.creditUsed || 0)).toFixed(2)}
                      </span>
                    </motion.button>
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
                        Limite: R$ {((user?.creditLimit || 5000) - (user?.creditUsed || 0)).toFixed(2)}
                      </span>
                    </motion.button>
                  </div>
                </div>
              )}

              {/* Category Selection */}
              <div className="mb-6">
                <label className="text-xs text-muted-foreground mb-3 block">Categoria</label>
                <div className="grid grid-cols-4 gap-2">
                  {categories.map((cat) => {
                    const Icon = CATEGORY_ICONS[cat.id] || MoreHorizontal;
                    const isSelected = pendingTransaction.category === cat.id;
                    return (
                      <motion.button
                        key={cat.id}
                        onClick={() => updateCategory(cat.id)}
                        className={cn(
                          "flex flex-col items-center gap-1 p-3 rounded-xl border transition-all",
                          isSelected 
                            ? "bg-primary/20 border-primary text-primary" 
                            : "bg-muted/30 border-transparent text-muted-foreground hover:border-border"
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

              {/* Actions */}
              <div className="flex gap-3">
                <motion.button
                  onClick={cancelTransaction}
                  className="flex-1 h-14 rounded-2xl bg-muted/50 text-foreground font-medium"
                  whileTap={{ scale: 0.98 }}
                >
                  Cancelar
                </motion.button>
                <motion.button
                  onClick={confirmTransaction}
                  className="flex-1 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary text-white font-medium flex items-center justify-center gap-2"
                  whileTap={{ scale: 0.98 }}
                >
                  <Check className="w-5 h-5" />
                  Confirmar
                </motion.button>
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
