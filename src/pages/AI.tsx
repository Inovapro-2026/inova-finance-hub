import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Send, Sparkles, Bot, User, CheckCircle2 } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { calculateBalance, getTransactions, addTransaction, type Transaction } from '@/lib/db';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  transactionRegistered?: boolean;
}

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

export default function AI() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize with welcome message
  useEffect(() => {
    if (user && messages.length === 0) {
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: `Olá ${user.fullName.split(' ')[0]}! 👋 Sou a NOVA, sua assistente financeira inteligente.\n\n💬 Você pode me dizer coisas como:\n• "Gastei 50 com pizza"\n• "Recebi 1000 de salário"\n• "Qual meu saldo?"\n• "Me dá um resumo financeiro"\n\n🎤 Ou use o microfone para falar comigo!`,
        },
      ]);
    }
  }, [user, messages.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Get financial context for the AI
  const getFinancialContext = async (): Promise<FinancialContext> => {
    if (!user) {
      return { balance: 0, totalIncome: 0, totalExpense: 0, recentTransactions: [] };
    }

    const { balance, totalIncome, totalExpense } = await calculateBalance(
      user.userId,
      user.initialBalance
    );
    const transactions = await getTransactions(user.userId);
    const recentTransactions = transactions.slice(0, 10).map((t) => ({
      amount: t.amount,
      type: t.type,
      category: t.category,
      description: t.description,
    }));

    return { balance, totalIncome, totalExpense, recentTransactions };
  };

  const handleSend = async () => {
    if (!input.trim() || !user) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const context = await getFinancialContext();

      const response = await fetch(
        'https://pahvovxnhqsmcnqncmys.supabase.co/functions/v1/gemini-assistant',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: input,
            context,
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Check if a transaction was registered
      if (data.functionCall?.name === 'record_transaction') {
        const { args } = data.functionCall;
        
        // Save transaction to local database
        await addTransaction({
          amount: args.amount,
          type: args.type as 'income' | 'expense',
          category: args.category,
          description: args.description,
          date: new Date(),
          userId: user.userId,
        });

        toast.success('Transação registrada!', {
          description: `${args.type === 'expense' ? 'Gasto' : 'Ganho'} de R$ ${args.amount.toFixed(2)}`,
        });
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        transactionRegistered: data.functionCall?.name === 'record_transaction',
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error calling AI:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente em alguns segundos. 🔄',
      };

      setMessages((prev) => [...prev, errorMessage]);
      toast.error('Erro ao conectar com a IA');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Reconhecimento de voz não suportado neste navegador');
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
      toast.info('Ouvindo...', { duration: 2000 });
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
      
      // Auto-send after voice input
      setTimeout(() => {
        const submitBtn = document.querySelector('[data-submit-btn]') as HTMLButtonElement;
        submitBtn?.click();
      }, 500);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      toast.error('Erro no reconhecimento de voz');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <motion.div
      className="min-h-screen pb-28 px-4 pt-6 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center glow-primary">
          <Sparkles className="w-7 h-7" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Assistente IA</h1>
          <p className="text-muted-foreground text-sm flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Powered by Gemini
          </p>
        </div>
      </div>

      {/* Voice Wave Indicator */}
      {isListening && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="mb-6"
        >
          <GlassCard className="p-6 flex items-center justify-center gap-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="wave-bar"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
            <span className="ml-4 text-sm text-muted-foreground">Ouvindo...</span>
          </GlassCard>
        </motion.div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((message, index) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`flex gap-3 ${
              message.role === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                message.role === 'assistant'
                  ? 'bg-gradient-primary'
                  : 'bg-muted'
              }`}
            >
              {message.role === 'assistant' ? (
                <Bot className="w-5 h-5" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
            <div
              className={`max-w-[80%] rounded-2xl p-4 ${
                message.role === 'assistant'
                  ? 'glass-card'
                  : 'bg-primary text-primary-foreground'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              {message.transactionRegistered && (
                <div className="flex items-center gap-1 mt-2 text-xs text-green-400">
                  <CheckCircle2 className="w-3 h-3" />
                  Transação salva
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div className="glass-card rounded-2xl p-4">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                <div
                  className="w-2 h-2 bg-primary rounded-full animate-bounce"
                  style={{ animationDelay: '0.1s' }}
                />
                <div
                  className="w-2 h-2 bg-primary rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s' }}
                />
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex gap-3">
        <button
          onClick={toggleListening}
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
            isListening
              ? 'bg-destructive text-white animate-pulse'
              : 'bg-muted hover:bg-muted/80'
          }`}
        >
          {isListening ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>
        <div className="flex-1 relative">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Digite ou fale sua mensagem..."
            className="h-12 pr-12 bg-muted/50 border-border rounded-xl"
          />
          <button
            data-submit-btn
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tips */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-4 flex gap-2 overflow-x-auto pb-2"
      >
        {['Gastei 30 no almoço', 'Qual meu saldo?', 'Resumo do mês'].map((tip) => (
          <button
            key={tip}
            onClick={() => setInput(tip)}
            className="px-3 py-1.5 text-xs bg-muted/50 rounded-full whitespace-nowrap hover:bg-muted transition-colors"
          >
            {tip}
          </button>
        ))}
      </motion.div>
    </motion.div>
  );
}

// Add type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
