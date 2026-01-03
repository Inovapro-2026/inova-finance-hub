import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Send, Sparkles, Bot, User } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function AI() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Olá ${user?.fullName.split(' ')[0]}! 👋 Sou sua assistente financeira. Posso ajudar você a registrar transações, consultar seu saldo e dar dicas personalizadas. Como posso ajudar?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate AI response (replace with actual Gemini integration when Cloud is enabled)
    setTimeout(() => {
      const responses = [
        'Entendi! Para registrar essa transação, vá até a aba de Transações e clique no botão +.',
        'Seu saldo atual está disponível no Dashboard. Quer que eu te dê uma análise detalhada?',
        'Baseado nas suas transações, você está gastando mais com alimentação. Considere definir um orçamento mensal.',
        'Ótima pergunta! Para criar uma meta de economia, acesse a aba Metas e defina seu objetivo.',
        'Posso ajudar você a organizar melhor suas finanças. Que tal começarmos definindo suas prioridades?',
      ];

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responses[Math.floor(Math.random() * responses.length)],
      };

      setMessages((prev) => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const toggleListening = () => {
    setIsListening(!isListening);
    // Web Speech API would be implemented here when Cloud is enabled
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
          <p className="text-muted-foreground text-sm">Powered by Gemini</p>
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
            transition={{ delay: index * 0.1 }}
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
              className={`max-w-[75%] rounded-2xl p-4 ${
                message.role === 'assistant'
                  ? 'glass-card'
                  : 'bg-primary text-primary-foreground'
              }`}
            >
              <p className="text-sm">{message.content}</p>
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
            placeholder="Digite sua mensagem..."
            className="h-12 pr-12 bg-muted/50 border-border rounded-xl"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Cloud Notice */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-4 text-center"
      >
        <p className="text-xs text-muted-foreground">
          💡 Ative o Lovable Cloud para funcionalidades completas de IA
        </p>
      </motion.div>
    </motion.div>
  );
}
