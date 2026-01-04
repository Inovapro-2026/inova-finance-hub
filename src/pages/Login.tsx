import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, User, Wallet, Mail, Phone, CreditCard, Calendar } from 'lucide-react';
import { NumericKeypad } from '@/components/NumericKeypad';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getProfile } from '@/lib/db';

type Step = 'matricula' | 'register';

export default function Login() {
  const [step, setStep] = useState<Step>('matricula');
  const [matricula, setMatricula] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [creditDueDate, setCreditDueDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleMatriculaSubmit = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Check if user exists
      const existingProfile = await getProfile(matricula);
      
      if (existingProfile) {
        // Login existing user
        const success = await login(matricula);
        if (success) {
          navigate('/');
        } else {
          setError('Erro ao fazer login');
        }
      } else {
        // New user, go to registration
        setStep('register');
      }
    } catch (err) {
      setError('Erro ao verificar matrícula');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!fullName.trim()) {
      setError('Digite seu nome completo');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const success = await login(
        matricula, 
        fullName.trim(),
        email.trim(),
        phone.trim(),
        parseFloat(initialBalance) || 0,
        parseFloat(creditLimit) || 5000,
        creditDueDate ? new Date(creditDueDate) : undefined
      );
      
      if (success) {
        navigate('/');
      } else {
        setError('Erro ao criar conta');
      }
    } catch (err) {
      setError('Erro ao registrar');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return value;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-secondary/20 rounded-full blur-[100px]" />
      </div>

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 text-center mb-8"
      >
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center glow-primary">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="font-display text-3xl font-bold gradient-text">
            INOVAFINANCE
          </h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Seu controle financeiro inteligente
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {step === 'matricula' ? (
          <motion.div
            key="matricula"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative z-10 w-full max-w-sm"
          >
            <GlassCard className="p-6">
              <h2 className="text-xl font-semibold text-center mb-2">
                Digite sua matrícula
              </h2>
              <p className="text-muted-foreground text-sm text-center mb-6">
                Use seu ID de 6 dígitos para acessar
              </p>

              {/* PIN Display */}
              <div className="flex justify-center gap-2 mb-8">
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    className={`w-10 h-12 rounded-lg border-2 flex items-center justify-center text-xl font-bold transition-colors ${
                      matricula[i] 
                        ? 'border-primary bg-primary/20' 
                        : 'border-border bg-muted/30'
                    }`}
                    animate={matricula[i] ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 0.2 }}
                  >
                    {matricula[i] ? '•' : ''}
                  </motion.div>
                ))}
              </div>

              <NumericKeypad
                value={matricula}
                onChange={setMatricula}
                onSubmit={handleMatriculaSubmit}
                maxLength={6}
              />

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-destructive text-sm text-center mt-4"
                >
                  {error}
                </motion.p>
              )}

              {isLoading && (
                <div className="flex justify-center mt-4">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </GlassCard>
          </motion.div>
        ) : (
          <motion.div
            key="register"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative z-10 w-full max-w-sm max-h-[80vh] overflow-y-auto"
          >
            <GlassCard className="p-6">
              <h2 className="text-xl font-semibold text-center mb-2">
                Criar conta
              </h2>
              <p className="text-muted-foreground text-sm text-center mb-6">
                Complete seu cadastro para continuar
              </p>

              <div className="space-y-4">
                {/* Nome */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    Nome completo
                  </label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Digite seu nome"
                    className="bg-muted/50 border-border"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />
                    Email
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="bg-muted/50 border-border"
                  />
                </div>

                {/* Telefone */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Phone className="w-4 h-4 text-primary" />
                    Número de telefone
                  </label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    className="bg-muted/50 border-border"
                    maxLength={15}
                  />
                </div>

                {/* Saldo Débito */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-500" />
                    Saldo débito (conta)
                  </label>
                  <Input
                    type="number"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                    placeholder="R$ 0,00"
                    className="bg-muted/50 border-border"
                  />
                </div>

                {/* Limite Crédito */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-secondary" />
                    Limite de crédito
                  </label>
                  <Input
                    type="number"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    placeholder="R$ 5.000,00"
                    className="bg-muted/50 border-border"
                  />
                </div>

                {/* Data Limite Crédito */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-warning" />
                    Data limite do crédito
                  </label>
                  <Input
                    type="date"
                    value={creditDueDate}
                    onChange={(e) => setCreditDueDate(e.target.value)}
                    className="bg-muted/50 border-border"
                  />
                </div>

                <Button
                  onClick={handleRegister}
                  disabled={isLoading}
                  className="w-full bg-gradient-primary hover:opacity-90 glow-primary"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Criar conta'
                  )}
                </Button>

                <button
                  onClick={() => {
                    setStep('matricula');
                    setMatricula('');
                    setError('');
                  }}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Voltar
                </button>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-destructive text-sm text-center mt-4"
                >
                  {error}
                </motion.p>
              )}
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
