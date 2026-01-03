import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send, Sparkles, Bot, User, CheckCircle2, Volume2, VolumeX, Zap, Brain, Cpu } from 'lucide-react';
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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Text-to-Speech function using ElevenLabs
  const speak = useCallback(async (text: string) => {
    if (!voiceEnabled) return;

    // Clean text for speech (remove emojis and markdown)
    const cleanText = text
      .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
      .replace(/\*\*/g, '')
      .replace(/\n+/g, '. ')
      .replace(/•/g, '')
      .trim();

    if (!cleanText) return;

    try {
      setIsSpeaking(true);

      const response = await fetch(
        'https://pahvovxnhqsmcnqncmys.supabase.co/functions/v1/elevenlabs-tts',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText }),
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Play audio using data URI
      const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      const audio = new Audio(audioUrl);
      
      audio.onended = () => setIsSpeaking(false);
      audio.onerror = () => setIsSpeaking(false);
      
      audioRef.current = audio;
      await audio.play();
    } catch (error) {
      console.error('ElevenLabs TTS error:', error);
      setIsSpeaking(false);
      // Fallback to Web Speech API
      fallbackSpeak(cleanText);
    }
  }, [voiceEnabled]);

  // Fallback to Web Speech API
  const fallbackSpeak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // Load voices when available
  useEffect(() => {
    const loadVoices = () => {
      window.speechSynthesis.getVoices();
    };
    
    if ('speechSynthesis' in window) {
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

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

      // Speak the response
      speak(data.message);
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
      className="min-h-screen pb-28 px-4 pt-6 flex flex-col relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Background Effects */}
      <div className="absolute inset-0 grid-pattern opacity-50" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-40 right-0 w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />
      
      {/* Floating Particles */}
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="particle"
          style={{
            left: `${15 + i * 15}%`,
            bottom: '20%',
            animationDelay: `${i * 0.7}s`,
          }}
        />
      ))}

      {/* Header */}
      <motion.div 
        className="flex items-center justify-between mb-6 relative z-10"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-4">
          {/* Animated AI Icon */}
          <div className="relative">
            <motion.div 
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center"
              animate={{ 
                boxShadow: [
                  '0 0 20px hsl(254 90% 67% / 0.4)',
                  '0 0 40px hsl(254 90% 67% / 0.6)',
                  '0 0 20px hsl(254 90% 67% / 0.4)',
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Brain className="w-8 h-8 brain-pulse" />
            </motion.div>
            {/* Orbiting dots */}
            <div className="absolute inset-0 orbit">
              <div className="absolute -top-1 left-1/2 w-2 h-2 bg-primary rounded-full" />
            </div>
            <div className="absolute inset-0 orbit-reverse">
              <div className="absolute -bottom-1 left-1/2 w-1.5 h-1.5 bg-secondary rounded-full" />
            </div>
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              NOVA
              <Cpu className="w-4 h-4 text-primary" />
            </h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-primary animate-pulse' : isLoading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
              {isSpeaking ? 'Falando...' : isLoading ? 'Processando...' : 'Pronta para ajudar'}
            </p>
          </div>
        </div>
        
        {/* Voice Toggle */}
        <motion.button
          onClick={() => {
            if (isSpeaking) stopSpeaking();
            setVoiceEnabled(!voiceEnabled);
            toast.info(voiceEnabled ? 'Voz desativada' : 'Voz ativada');
          }}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all border ${
            voiceEnabled 
              ? 'bg-primary/20 text-primary border-primary/30' 
              : 'bg-muted/50 text-muted-foreground border-muted'
          }`}
          whileTap={{ scale: 0.95 }}
        >
          {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </motion.button>
      </motion.div>

      {/* Speaking Indicator */}
      <AnimatePresence>
        {isSpeaking && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="mb-4 relative z-10"
          >
            <div className="ai-tech-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex gap-1 items-end h-8">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 bg-gradient-to-t from-primary to-secondary rounded-full"
                      animate={{ 
                        height: [8, 24, 12, 28, 8],
                      }}
                      transition={{ 
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.1,
                      }}
                    />
                  ))}
                </div>
                <div>
                  <span className="text-sm font-medium">NOVA está falando</span>
                  <p className="text-xs text-muted-foreground">Voz: Brian (Deep)</p>
                </div>
              </div>
              <button
                onClick={stopSpeaking}
                className="px-3 py-1.5 text-xs bg-destructive/20 text-destructive rounded-lg hover:bg-destructive/30 transition-colors"
              >
                Parar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice Wave Indicator - Enhanced */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="mb-6 relative z-10"
          >
            <div className="ai-tech-card p-8 relative overflow-hidden">
              {/* Scanning line effect */}
              <div className="scan-line" />
              
              {/* Center mic visualization */}
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="relative">
                  {/* Pulsing rings */}
                  <div className="pulse-ring w-24 h-24 -inset-2" style={{ animationDelay: '0s' }} />
                  <div className="pulse-ring w-32 h-32 -inset-6" style={{ animationDelay: '0.5s' }} />
                  <div className="pulse-ring w-40 h-40 -inset-10" style={{ animationDelay: '1s' }} />
                  
                  <motion.div 
                    className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center"
                    animate={{ 
                      scale: [1, 1.1, 1],
                      boxShadow: [
                        '0 0 30px hsl(254 90% 67% / 0.5)',
                        '0 0 60px hsl(254 90% 67% / 0.8)',
                        '0 0 30px hsl(254 90% 67% / 0.5)',
                      ]
                    }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Mic className="w-8 h-8" />
                  </motion.div>
                </div>
                
                <div className="flex gap-1 items-end h-12">
                  {[...Array(9)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1 bg-gradient-to-t from-primary/60 to-primary rounded-full"
                      animate={{ 
                        height: [4, 32, 16, 40, 8, 28, 4],
                      }}
                      transition={{ 
                        duration: 1.2,
                        repeat: Infinity,
                        delay: i * 0.08,
                      }}
                    />
                  ))}
                </div>
                
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Ouvindo sua voz...
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 relative z-10">
        {messages.map((message, index) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: index * 0.05, type: 'spring', stiffness: 200 }}
            className={`flex gap-3 ${
              message.role === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            <motion.div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                message.role === 'assistant'
                  ? 'bg-gradient-to-br from-primary to-secondary'
                  : 'bg-muted border border-border'
              }`}
              whileHover={{ scale: 1.1 }}
            >
              {message.role === 'assistant' ? (
                <Bot className="w-5 h-5" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </motion.div>
            <div
              className={`max-w-[80%] rounded-2xl p-4 ${
                message.role === 'assistant'
                  ? 'ai-tech-card'
                  : 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              {message.transactionRegistered && (
                <motion.div 
                  className="flex items-center gap-1 mt-2 text-xs text-green-400"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Transação salva
                </motion.div>
              )}
            </div>
          </motion.div>
        ))}

        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div className="ai-tech-card rounded-2xl p-4">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2.5 h-2.5 bg-primary rounded-full"
                    animate={{ 
                      y: [0, -8, 0],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{ 
                      duration: 0.8, 
                      repeat: Infinity,
                      delay: i * 0.15,
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Enhanced */}
      <motion.div 
        className="flex gap-3 relative z-10"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <motion.button
          onClick={toggleListening}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all border-2 ${
            isListening
              ? 'bg-gradient-to-br from-destructive to-destructive/80 text-white border-destructive shadow-lg shadow-destructive/30'
              : 'bg-muted/50 hover:bg-muted border-border hover:border-primary/50'
          }`}
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
        >
          {isListening ? (
            <MicOff className="w-6 h-6" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </motion.button>
        <div className="flex-1 relative">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Digite ou fale sua mensagem..."
            className="h-14 pr-14 bg-muted/30 border-border hover:border-primary/50 focus:border-primary rounded-2xl text-base backdrop-blur-sm"
          />
          <motion.button
            data-submit-btn
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
          >
            <Send className="w-5 h-5" />
          </motion.button>
        </div>
      </motion.div>

      {/* Tips - Enhanced */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-4 flex gap-2 overflow-x-auto pb-2 relative z-10"
      >
        {['Gastei 30 no almoço', 'Qual meu saldo?', 'Resumo do mês'].map((tip, i) => (
          <motion.button
            key={tip}
            onClick={() => setInput(tip)}
            className="px-4 py-2 text-xs bg-muted/30 rounded-full whitespace-nowrap hover:bg-primary/20 hover:text-primary transition-all border border-transparent hover:border-primary/30 backdrop-blur-sm"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.1 }}
          >
            <Sparkles className="w-3 h-3 inline mr-1.5" />
            {tip}
          </motion.button>
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
