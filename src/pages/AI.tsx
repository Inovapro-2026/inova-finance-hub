import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send, Sparkles, Volume2, VolumeX, Keyboard, X, Check, Edit3, ArrowDown, ArrowUp, Target, Utensils, Car, Gamepad2, ShoppingBag, Heart, GraduationCap, Receipt, MoreHorizontal, Briefcase, Laptop, TrendingUp, Gift } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { calculateBalance, getTransactions, addTransaction, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/db';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FinancialContext {
  balance: number;
  totalIncome: number;
  totalExpense: number;
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
  const { user } = useAuth();
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [input, setInput] = useState('');
  const [statusText, setStatusText] = useState('Toque para falar');
  const [pendingTransaction, setPendingTransaction] = useState<PendingTransaction | null>(null);
  const [editingAmount, setEditingAmount] = useState(false);
  const [editedAmount, setEditedAmount] = useState('');
  const recognitionRef = useRef<any>(null);

  // Load voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
    return () => window.speechSynthesis.cancel();
  }, []);

  // Get the best Portuguese voice
  const getBestVoice = useCallback(() => {
    const voices = window.speechSynthesis.getVoices();
    const ptVoices = voices.filter(v => v.lang.startsWith('pt'));
    const premiumVoice = ptVoices.find(v => 
      v.name.includes('Google') || v.name.includes('Microsoft') || v.name.includes('Luciana')
    );
    return premiumVoice || ptVoices[0] || voices[0] || null;
  }, []);

  // Native TTS function
  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;

    const cleanText = text
      .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
      .replace(/\*\*/g, '')
      .replace(/\n+/g, '. ')
      .replace(/•/g, '')
      .trim();

    if (!cleanText) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    const voice = getBestVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'pt-BR';
    }
    
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled, getBestVoice]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const getFinancialContext = async (): Promise<FinancialContext> => {
    if (!user) return { balance: 0, totalIncome: 0, totalExpense: 0, recentTransactions: [] };

    const { balance, totalIncome, totalExpense } = await calculateBalance(user.userId, user.initialBalance);
    const transactions = await getTransactions(user.userId);
    const recentTransactions = transactions.slice(0, 10).map((t) => ({
      amount: t.amount,
      type: t.type,
      category: t.category,
      description: t.description,
    }));

    return { balance, totalIncome, totalExpense, recentTransactions };
  };

  const processMessage = async (message: string) => {
    if (!message.trim()) return;
    
    if (!user) {
      toast.error('Faça login para usar a assistente');
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
          category: args.category,
          description: args.description,
        });
        setEditedAmount(args.amount.toString());
        setStatusText('Confirme a transação');
        speak(`Registrar ${args.type === 'expense' ? 'gasto' : 'ganho'} de ${args.amount} reais em ${args.category}?`);
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

    await addTransaction({
      amount: finalAmount,
      type: pendingTransaction.type,
      category: pendingTransaction.category,
      description: pendingTransaction.description,
      date: new Date(),
      userId: user.userId,
    });

    toast.success('Transação registrada!', {
      description: `${pendingTransaction.type === 'expense' ? 'Gasto' : 'Ganho'} de R$ ${finalAmount.toFixed(2)}`,
    });

    speak('Transação registrada com sucesso!');
    setPendingTransaction(null);
    setEditingAmount(false);
    setStatusText('Pronta para ajudar');
  };

  const updateCategory = (categoryId: string) => {
    if (!pendingTransaction) return;
    setPendingTransaction({ ...pendingTransaction, category: categoryId });
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

  return (
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
            if (isSpeaking) stopSpeaking();
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
          {['Gastei 30 no almoço', 'Recebi 1000', 'Qual meu saldo?'].map((tip, i) => (
            <motion.button
              key={tip}
              onClick={() => processMessage(tip)}
              className="px-4 py-2 text-xs bg-muted/30 rounded-full hover:bg-primary/20 hover:text-primary transition-all border border-transparent hover:border-primary/30"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
            >
              <Sparkles className="w-3 h-3 inline mr-1.5" />
              {tip}
            </motion.button>
          ))}
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
              className="w-full max-w-sm bg-card border border-border rounded-3xl p-6 shadow-2xl"
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
  );
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
