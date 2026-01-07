import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, User, Wallet, Mail, Phone, CreditCard, Calendar, UserPlus, CheckCircle, Sparkles, Fingerprint, Briefcase, DollarSign, CalendarDays } from 'lucide-react';
import { NumericKeypad } from '@/components/NumericKeypad';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { 
  isBiometricSupported, 
  isPlatformAuthenticatorAvailable, 
  isBiometricEnabled,
  authenticateWithBiometric,
  getBiometricMatricula
} from '@/services/biometricService';

type Step = 'matricula' | 'register' | 'success';

export default function Login() {
  const [step, setStep] = useState<Step>('matricula');
  const [matricula, setMatricula] = useState('');
  const [generatedMatricula, setGeneratedMatricula] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [creditDueDay, setCreditDueDay] = useState('');
  const [creditAvailable, setCreditAvailable] = useState('');
  const [hasCreditCard, setHasCreditCard] = useState<boolean | null>(null);
  const [isClt, setIsClt] = useState<boolean | null>(null);
  const [salaryAmount, setSalaryAmount] = useState('');
  const [salaryDay, setSalaryDay] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceDay, setAdvanceDay] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  
  const navigate = useNavigate();
  const { login } = useAuth();

  // Check biometric availability on mount
  useEffect(() => {
    const checkBiometric = async () => {
      const supported = isBiometricSupported();
      const available = await isPlatformAuthenticatorAvailable();
      const enabled = isBiometricEnabled();
      
      setBiometricAvailable(supported && available);
      setBiometricEnabled(enabled);
    };
    checkBiometric();
  }, []);

  // Handle biometric login
  const handleBiometricLogin = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const storedMatricula = await authenticateWithBiometric();
      
      if (storedMatricula) {
        // Verify user exists in Supabase
        const { data: existingUser, error: fetchError } = await supabase
          .from('users_matricula')
          .select('*')
          .eq('matricula', storedMatricula)
          .maybeSingle();
        
        if (fetchError) throw fetchError;
        
        if (existingUser) {
          const success = await login(storedMatricula, existingUser.full_name || '');
          if (success) {
            navigate('/');
          } else {
            setError('Erro ao fazer login');
          }
        } else {
          setError('Usuário não encontrado');
        }
      } else {
        setError('Autenticação biométrica cancelada');
      }
    } catch (err) {
      console.error(err);
      setError('Erro na autenticação biométrica');
    } finally {
      setIsLoading(false);
    }
  };

  // Gerar matrícula única de 6 dígitos
  const generateMatricula = async (): Promise<number> => {
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const newMatricula = Math.floor(100000 + Math.random() * 900000);
      
      // Verificar se já existe no Supabase
      const { data } = await supabase
        .from('users_matricula')
        .select('matricula')
        .eq('matricula', newMatricula)
        .maybeSingle();
      
      if (!data) {
        return newMatricula;
      }
      attempts++;
    }
    
    throw new Error('Não foi possível gerar matrícula única');
  };

  const handleMatriculaSubmit = async () => {
    if (matricula.length !== 6) {
      setError('Digite os 6 dígitos da matrícula');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Verificar se usuário existe no Supabase
      const { data: existingUser, error: fetchError } = await supabase
        .from('users_matricula')
        .select('*')
        .eq('matricula', parseInt(matricula))
        .maybeSingle();
      
      if (fetchError) throw fetchError;
      
      if (existingUser) {
        // Login do usuário existente
        const success = await login(parseInt(matricula), existingUser.full_name || '');
        if (success) {
          navigate('/');
        } else {
          setError('Erro ao fazer login');
        }
      } else {
        setError('Matrícula não encontrada. Crie uma conta.');
      }
    } catch (err) {
      console.error(err);
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
    if (!email.trim()) {
      setError('Digite seu email');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Gerar matrícula única
      const newMatricula = await generateMatricula();
      
      // Criar usuário no Supabase
      const { error: insertError } = await supabase
        .from('users_matricula')
        .insert({
          matricula: newMatricula,
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          initial_balance: parseFloat(initialBalance) || 0,
          has_credit_card: hasCreditCard === true,
          credit_limit: hasCreditCard ? (parseFloat(creditLimit) || 0) : 0,
          credit_available: hasCreditCard ? (parseFloat(creditAvailable) || 0) : 0,
          credit_due_day: hasCreditCard ? (parseInt(creditDueDay) || 5) : null,
          salary_amount: isClt ? (parseFloat(salaryAmount) || 0) : 0,
          salary_day: isClt ? (parseInt(salaryDay) || 5) : 5,
          advance_amount: isClt ? (parseFloat(advanceAmount) || 0) : 0,
          advance_day: isClt && advanceDay ? (parseInt(advanceDay) || null) : null,
        });
      
      if (insertError) throw insertError;
      
      // Calcular próxima data de vencimento baseado no dia
      const dueDay = parseInt(creditDueDay) || 5;
      const today = new Date();
      let dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);
      if (dueDate <= today) {
        dueDate = new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
      }
      
      // Login local com os dados extras
      const success = await login(
        newMatricula, 
        fullName.trim(),
        email.trim(),
        phone.trim(),
        parseFloat(initialBalance) || 0,
        parseFloat(creditLimit) || 5000,
        dueDay
      );
      
      if (success) {
        setGeneratedMatricula(newMatricula.toString());
        setStep('success');
      } else {
        setError('Erro ao criar conta');
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao registrar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToLogin = () => {
    setMatricula(generatedMatricula);
    setStep('matricula');
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
      {/* Animated Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating gradient orbs */}
        <motion.div 
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px]"
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.2, 0.3, 0.2]
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-secondary/20 rounded-full blur-[100px]"
          animate={{ 
            scale: [1, 1.15, 1],
            opacity: [0.2, 0.25, 0.2]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <motion.div 
          className="absolute top-1/2 left-1/4 w-[300px] h-[300px] bg-emerald-500/15 rounded-full blur-[80px]"
          animate={{ 
            scale: [1, 1.2, 1],
            x: [0, 30, 0]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        
        {/* Floating coins animation */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={`coin-${i}`}
            className="absolute w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg"
            style={{
              left: `${15 + i * 15}%`,
              bottom: '-30px',
            }}
            animate={{
              y: [0, -150, -100],
              opacity: [0, 1, 0],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: i * 0.8,
              ease: "easeOut"
            }}
          >
            <span className="absolute inset-0 flex items-center justify-center text-yellow-800 font-bold text-xs">$</span>
          </motion.div>
        ))}
      </div>

      {/* Animated Piggy Bank Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 text-center mb-8"
      >
        <div className="flex flex-col items-center justify-center gap-4 mb-4">
          {/* Piggy Bank with filling animation */}
          <div className="relative">
            {/* Glow effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-primary rounded-2xl blur-xl opacity-50"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            
            {/* Main piggy container */}
            <motion.div 
              className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-pink-400 via-pink-500 to-rose-500 flex items-center justify-center shadow-xl overflow-hidden"
              animate={{ 
                scale: [1, 1.02, 1],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {/* Piggy face */}
              <svg viewBox="0 0 64 64" className="w-16 h-16 relative z-10">
                {/* Ears */}
                <ellipse cx="16" cy="18" rx="8" ry="10" fill="#f472b6" />
                <ellipse cx="48" cy="18" rx="8" ry="10" fill="#f472b6" />
                <ellipse cx="16" cy="18" rx="5" ry="7" fill="#fda4af" />
                <ellipse cx="48" cy="18" rx="5" ry="7" fill="#fda4af" />
                
                {/* Head */}
                <circle cx="32" cy="32" r="22" fill="#fb7185" />
                
                {/* Snout */}
                <ellipse cx="32" cy="40" rx="10" ry="7" fill="#fda4af" />
                <circle cx="28" cy="40" r="2" fill="#be185d" />
                <circle cx="36" cy="40" r="2" fill="#be185d" />
                
                {/* Eyes */}
                <circle cx="24" cy="28" r="4" fill="white" />
                <circle cx="40" cy="28" r="4" fill="white" />
                <circle cx="25" cy="28" r="2" fill="#1f2937" />
                <circle cx="41" cy="28" r="2" fill="#1f2937" />
                <circle cx="25.5" cy="27" r="0.8" fill="white" />
                <circle cx="41.5" cy="27" r="0.8" fill="white" />
                
                {/* Coin slot on top */}
                <rect x="26" y="8" width="12" height="3" rx="1.5" fill="#be185d" />
              </svg>
              
              {/* Coins falling into piggy */}
              <AnimatePresence>
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={`piggy-coin-${i}`}
                    className="absolute w-4 h-4 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 shadow-md flex items-center justify-center"
                    initial={{ y: -40, x: 0, opacity: 1, scale: 1 }}
                    animate={{ 
                      y: [- 40, 0, 20],
                      scale: [1, 1, 0.5],
                      opacity: [1, 1, 0]
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 1.2,
                      ease: "easeIn"
                    }}
                    style={{ top: '10px' }}
                  >
                    <span className="text-yellow-800 font-bold text-[8px]">$</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {/* Fill level indicator */}
              <motion.div
                className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-emerald-400/60 to-emerald-300/30"
                initial={{ height: '0%' }}
                animate={{ height: ['20%', '60%', '40%', '70%', '50%'] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
            
            {/* Sparkles around piggy */}
            {[...Array(4)].map((_, i) => (
              <motion.div
                key={`sparkle-${i}`}
                className="absolute"
                style={{
                  top: `${10 + Math.sin(i * 1.5) * 40}%`,
                  left: `${10 + Math.cos(i * 1.5) * 40}%`,
                }}
                animate={{
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.5,
                }}
              >
                <Sparkles className="w-4 h-4 text-yellow-400" />
              </motion.div>
            ))}
          </div>
          
          {/* Bank name with animated gradient */}
          <motion.h1 
            className="font-display text-4xl font-bold"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <span className="bg-gradient-to-r from-primary via-secondary to-emerald-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
              INOVABANK
            </span>
          </motion.h1>
        </div>
        
        <motion.p 
          className="text-muted-foreground text-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          Seu assistente financeiro inteligente
        </motion.p>
      </motion.div>

      <AnimatePresence mode="wait">
        {step === 'matricula' && (
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
              <div className="flex justify-center gap-2 mb-6">
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
                    {matricula[i] || ''}
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

              {/* Biometric Login Button */}
              {biometricAvailable && biometricEnabled && (
                <div className="mt-4">
                  <button
                    onClick={handleBiometricLogin}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-primary hover:opacity-90 transition-opacity text-white font-medium glow-primary"
                  >
                    <Fingerprint className="w-5 h-5" />
                    Entrar com biometria
                  </button>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Use sua digital ou Face ID
                  </p>
                </div>
              )}

              {/* Botão de Cadastro */}
              <div className="mt-6 pt-4 border-t border-border">
                <button
                  onClick={() => {
                    setStep('register');
                    setError('');
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-secondary/20 hover:bg-secondary/30 transition-colors text-secondary font-medium"
                >
                  <UserPlus className="w-5 h-5" />
                  Criar conta
                </button>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {step === 'register' && (
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
                    Nome completo *
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
                    Email *
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

                {/* Pergunta Cartão de Crédito */}
                <div className="space-y-3 pt-2 border-t border-border">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-secondary" />
                    Você tem cartão de crédito?
                  </label>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant={hasCreditCard === true ? "default" : "outline"}
                      className={`flex-1 ${hasCreditCard === true ? 'bg-gradient-primary' : ''}`}
                      onClick={() => setHasCreditCard(true)}
                    >
                      Sim
                    </Button>
                    <Button
                      type="button"
                      variant={hasCreditCard === false ? "default" : "outline"}
                      className={`flex-1 ${hasCreditCard === false ? 'bg-gradient-primary' : ''}`}
                      onClick={() => setHasCreditCard(false)}
                    >
                      Não
                    </Button>
                  </div>
                </div>

                {/* Campos condicionais Cartão de Crédito */}
                {hasCreditCard === true && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4"
                  >
                    {/* Limite Crédito */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-secondary" />
                        Limite total do cartão
                      </label>
                      <Input
                        type="number"
                        value={creditLimit}
                        onChange={(e) => setCreditLimit(e.target.value)}
                        placeholder="R$ 0,00"
                        className="bg-muted/50 border-border"
                      />
                    </div>

                    {/* Valor Disponível */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-emerald-500" />
                        Valor disponível atual
                      </label>
                      <Input
                        type="number"
                        value={creditAvailable}
                        onChange={(e) => setCreditAvailable(e.target.value)}
                        placeholder="R$ 0,00"
                        className="bg-muted/50 border-border"
                      />
                      <p className="text-xs text-muted-foreground">
                        Quanto você tem disponível no cartão agora
                      </p>
                    </div>

                    {/* Dia Vencimento Crédito */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-warning" />
                        Dia de vencimento da fatura
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={creditDueDay}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!e.target.value || (val >= 1 && val <= 31)) {
                            setCreditDueDay(e.target.value);
                          }
                        }}
                        placeholder="Ex: 15"
                        className="bg-muted/50 border-border"
                      />
                      <p className="text-xs text-muted-foreground">
                        No vencimento, o limite será restaurado para o valor total
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Pergunta CLT */}
                <div className="space-y-3 pt-2 border-t border-border">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-primary" />
                    Você é CLT?
                  </label>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant={isClt === true ? "default" : "outline"}
                      className={`flex-1 ${isClt === true ? 'bg-gradient-primary' : ''}`}
                      onClick={() => setIsClt(true)}
                    >
                      Sim
                    </Button>
                    <Button
                      type="button"
                      variant={isClt === false ? "default" : "outline"}
                      className={`flex-1 ${isClt === false ? 'bg-gradient-primary' : ''}`}
                      onClick={() => setIsClt(false)}
                    >
                      Não
                    </Button>
                  </div>
                </div>

                {/* Campos condicionais CLT */}
                {isClt === true && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4"
                  >
                    {/* Valor do Salário */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-500" />
                        Valor do salário
                      </label>
                      <Input
                        type="number"
                        value={salaryAmount}
                        onChange={(e) => setSalaryAmount(e.target.value)}
                        placeholder="R$ 0,00"
                        className="bg-muted/50 border-border"
                      />
                    </div>

                    {/* Dia do Pagamento do Salário */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-secondary" />
                        Dia do pagamento do salário
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={salaryDay}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!e.target.value || (val >= 1 && val <= 31)) {
                            setSalaryDay(e.target.value);
                          }
                        }}
                        placeholder="Ex: 5"
                        className="bg-muted/50 border-border"
                      />
                    </div>

                    {/* Valor do Adiantamento */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-blue-500" />
                        Valor do adiantamento
                      </label>
                      <Input
                        type="number"
                        value={advanceAmount}
                        onChange={(e) => setAdvanceAmount(e.target.value)}
                        placeholder="R$ 0,00 (opcional)"
                        className="bg-muted/50 border-border"
                      />
                      <p className="text-xs text-muted-foreground">
                        Deixe em branco se não recebe adiantamento
                      </p>
                    </div>

                    {/* Dia do Adiantamento */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-blue-500" />
                        Dia do adiantamento
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={advanceDay}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!e.target.value || (val >= 1 && val <= 31)) {
                            setAdvanceDay(e.target.value);
                          }
                        }}
                        placeholder="Ex: 20"
                        className="bg-muted/50 border-border"
                      />
                    </div>
                  </motion.div>
                )}

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
                    setError('');
                  }}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Já tenho conta
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

        {step === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative z-10 w-full max-w-sm"
          >
            <GlassCard className="p-8 text-center">
              {/* Success Animation */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center"
              >
                <CheckCircle className="w-10 h-10 text-white" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <h2 className="text-2xl font-bold mb-2 flex items-center justify-center gap-2">
                  <Sparkles className="w-6 h-6 text-yellow-500" />
                  Parabéns!
                  <Sparkles className="w-6 h-6 text-yellow-500" />
                </h2>
                <p className="text-muted-foreground mb-6">
                  Sua conta foi criada com sucesso!<br />
                  Você está pronto para economizar.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="mb-6"
              >
                <p className="text-sm text-muted-foreground mb-2">
                  Sua matrícula é:
                </p>
                <div className="flex justify-center gap-2">
                  {generatedMatricula.split('').map((digit, i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.8 + i * 0.1, type: 'spring' }}
                      className="w-12 h-14 rounded-xl bg-gradient-primary flex items-center justify-center text-2xl font-bold text-white glow-primary"
                    >
                      {digit}
                    </motion.div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Guarde esse número! Você usará ele para fazer login.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.4 }}
              >
                <Button
                  onClick={handleGoToLogin}
                  className="w-full bg-gradient-primary hover:opacity-90 glow-primary"
                >
                  Fazer login
                </Button>
              </motion.div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
