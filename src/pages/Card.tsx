import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Wifi, Eye, EyeOff, Fingerprint } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuth } from '@/contexts/AuthContext';
import { calculateBalance } from '@/lib/db';

export default function Card() {
  const { user } = useAuth();
  const [isFlipped, setIsFlipped] = useState(false);
  const [showCVV, setShowCVV] = useState(false);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    if (user) {
      loadBalance();
    }
  }, [user]);

  const loadBalance = async () => {
    if (!user) return;
    const { balance: bal } = await calculateBalance(user.userId, user.initialBalance);
    setBalance(bal);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatCardNumber = () => {
    const baseNumber = user?.userId.padStart(16, '4532') || '4532000000000000';
    return baseNumber.match(/.{1,4}/g)?.join(' ') || '';
  };

  const getExpiryDate = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 3);
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)}`;
  };

  return (
    <motion.div
      className="min-h-screen pb-28 px-4 pt-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="font-display text-2xl font-bold">Inova Black</h1>
        <p className="text-muted-foreground text-sm">Seu cartão premium</p>
      </motion.div>

      {/* 3D Card Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-3d-container mb-8"
      >
        <div
          className={`card-3d relative w-full aspect-[1.586/1] max-w-sm mx-auto cursor-pointer ${
            isFlipped ? 'flipped' : ''
          }`}
          onClick={() => setIsFlipped(!isFlipped)}
        >
          {/* Front of Card */}
          <div className="card-3d-face absolute inset-0">
            <div className="w-full h-full rounded-2xl p-6 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f0f23] border border-white/10 shadow-2xl overflow-hidden">
              {/* Holographic Effect */}
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-secondary/20 opacity-50" />
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
              
              {/* Card Content */}
              <div className="relative z-10 flex flex-col h-full">
                {/* Top Row */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                      <Shield className="w-6 h-6" />
                    </div>
                    <span className="font-display font-bold text-lg">INOVA</span>
                  </div>
                  <Wifi className="w-6 h-6 text-white/60 rotate-90" />
                </div>

                {/* Chip */}
                <div className="mt-6">
                  <div className="w-12 h-9 rounded-md bg-gradient-to-br from-yellow-300/80 to-yellow-500/80 shadow-inner">
                    <div className="w-full h-full grid grid-cols-3 gap-0.5 p-1">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="bg-yellow-600/40 rounded-sm" />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card Number */}
                <div className="mt-6">
                  <p className="font-mono text-lg tracking-[0.2em] text-white/90">
                    {formatCardNumber()}
                  </p>
                </div>

                {/* Bottom Row */}
                <div className="mt-auto flex justify-between items-end">
                  <div>
                    <p className="text-[10px] text-white/50 uppercase mb-1">Titular</p>
                    <p className="font-medium text-sm uppercase tracking-wide">
                      {user?.fullName || 'NOME DO TITULAR'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-white/50 uppercase mb-1">Validade</p>
                    <p className="font-mono text-sm">{getExpiryDate()}</p>
                  </div>
                </div>
              </div>

              {/* Decorative Lines */}
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-primary" />
            </div>
          </div>

          {/* Back of Card */}
          <div className="card-3d-face card-3d-back absolute inset-0">
            <div className="w-full h-full rounded-2xl bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f0f23] border border-white/10 shadow-2xl overflow-hidden">
              {/* Magnetic Strip */}
              <div className="mt-8 h-12 bg-black/80" />

              {/* CVV Area */}
              <div className="mt-6 px-6">
                <div className="bg-white/90 rounded-md p-3 flex items-center justify-between">
                  <div className="flex-1 bg-gray-200 h-8 rounded flex items-center justify-end px-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCVV(!showCVV);
                      }}
                      className="flex items-center gap-2"
                    >
                      <span className="font-mono text-gray-800 font-bold">
                        {showCVV ? '742' : '***'}
                      </span>
                      {showCVV ? (
                        <EyeOff className="w-4 h-4 text-gray-600" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-white/50 mt-2 text-center">
                  Código de Segurança (CVV)
                </p>
              </div>

              {/* Balance */}
              <div className="mt-6 px-6 text-center">
                <p className="text-[10px] text-white/50 uppercase mb-1">Saldo Disponível</p>
                <p className="font-display text-2xl font-bold gradient-text">
                  {formatCurrency(balance)}
                </p>
              </div>

              {/* Footer */}
              <div className="absolute bottom-6 left-0 right-0 px-6 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="text-xs text-white/50">Protegido</span>
                </div>
                <Fingerprint className="w-6 h-6 text-primary/50" />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tip */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center text-muted-foreground text-sm mb-8"
      >
        Toque no cartão para virar
      </motion.p>

      {/* Card Info */}
      <div className="space-y-4">
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-xs">Limite do Cartão</p>
              <p className="font-semibold text-lg">{formatCurrency(5000)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-xs">Fatura Atual</p>
              <p className="font-semibold text-lg">{formatCurrency(0)}</p>
            </div>
            <span className="text-xs text-success bg-success/20 px-2 py-1 rounded-full">
              Em dia
            </span>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-4">
            <Fingerprint className="w-8 h-8 text-primary" />
            <div>
              <p className="font-medium text-sm">Biometria</p>
              <p className="text-muted-foreground text-xs">
                Ative para maior segurança
              </p>
            </div>
            <div className="ml-auto">
              <div className="w-10 h-6 bg-muted rounded-full flex items-center px-1">
                <div className="w-4 h-4 rounded-full bg-muted-foreground" />
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </motion.div>
  );
}
