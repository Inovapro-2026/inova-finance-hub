import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  Wallet, 
  TrendingDown, 
  TrendingUp, 
  Bell, 
  Plus, 
  Repeat, 
  CalendarCheck,
  AlertTriangle,
  Check,
  X,
  ChevronRight,
  Settings,
  DollarSign,
  Pencil,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SchedulePaymentModal } from '@/components/SchedulePaymentModal';
import { 
  getScheduledPayments, 
  addScheduledPayment, 
  updateScheduledPayment,
  deleteScheduledPayment,
  getTodaysDuePayments,
  calculateMonthlySummary,
  getUserSalaryInfo,
  updateUserSalaryInfo,
  addPaymentLog,
  checkSalaryCredited,
  addSalaryCredit,
  type ScheduledPayment 
} from '@/lib/plannerDb';
import { addTransaction, calculateBalance } from '@/lib/db';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { speakNative } from '@/services/nativeTtsService';

const CATEGORY_ICONS: Record<string, string> = {
  aluguel: '🏠',
  energia: '⚡',
  agua: '💧',
  internet: '🌐',
  telefone: '📱',
  academia: '🏋️',
  streaming: '📺',
  seguro: '🛡️',
  escola: '📚',
  outros: '📋',
};

export default function Planner() {
  const { user, refreshUser } = useAuth();
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [payments, setPayments] = useState<ScheduledPayment[]>([]);
  const [todaysDue, setTodaysDue] = useState<ScheduledPayment[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<{
    totalPayments: number;
    projectedBalance: number;
    heaviestPayment: ScheduledPayment | null;
  } | null>(null);
  const [salaryInfo, setSalaryInfo] = useState<{ salaryAmount: number; salaryDay: number } | null>(null);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [salaryAmountInput, setSalaryAmountInput] = useState('');
  const [salaryDayInput, setSalaryDayInput] = useState('5');
  const [pendingPayment, setPendingPayment] = useState<ScheduledPayment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const loadData = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const [paymentsData, salaryData, balanceData] = await Promise.all([
        getScheduledPayments(user.userId),
        getUserSalaryInfo(user.userId),
        calculateBalance(user.userId, user.initialBalance),
      ]);

      setPayments(paymentsData);
      setSalaryInfo(salaryData);
      setCurrentBalance(balanceData.debitBalance);

      if (salaryData) {
        setSalaryAmountInput(salaryData.salaryAmount.toString());
        setSalaryDayInput(salaryData.salaryDay.toString());
        
        const summary = await calculateMonthlySummary(user.userId, salaryData.salaryAmount, salaryData.salaryDay);
        setMonthlySummary({
          totalPayments: summary.totalPayments,
          projectedBalance: summary.projectedBalance,
          heaviestPayment: summary.heaviestPayment,
        });

        // Check for today's due payments
        const todayPayments = await getTodaysDuePayments(user.userId);
        setTodaysDue(todayPayments);

        // Auto-credit salary if it's the salary day and not yet credited
        await checkAndCreditSalary(user.userId, salaryData.salaryAmount, salaryData.salaryDay);

        // Announce today's payments
        if (todayPayments.length > 0) {
          const total = todayPayments.reduce((sum, p) => sum + p.amount, 0);
          const message = `Você tem ${todayPayments.length} ${todayPayments.length === 1 ? 'pagamento agendado' : 'pagamentos agendados'} para hoje, totalizando ${formatCurrency(total)}`;
          speakNative(message);
        }
      }
    } catch (error) {
      console.error('Error loading planner data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const checkAndCreditSalary = async (userId: number, salaryAmount: number, salaryDay: number) => {
    const today = new Date();
    if (today.getDate() !== salaryDay || salaryAmount <= 0) return;

    const monthYear = today.toISOString().slice(0, 7);
    const alreadyCredited = await checkSalaryCredited(userId, monthYear);
    
    if (!alreadyCredited) {
      // Credit salary
      await addSalaryCredit({
        userId,
        amount: salaryAmount,
        creditedAt: new Date(),
        monthYear,
      });

      // Add as income transaction
      await addTransaction({
        amount: salaryAmount,
        type: 'income',
        paymentMethod: 'debit',
        category: 'Salário',
        description: `Salário ${format(today, 'MMMM yyyy', { locale: ptBR })}`,
        date: new Date(),
        userId,
      });

      await refreshUser();
      toast.success('Salário creditado!', {
        description: `${formatCurrency(salaryAmount)} foi adicionado ao seu saldo`,
      });
      speakNative(`Hoje é dia ${salaryDay}, seu salário foi creditado no valor de ${formatCurrency(salaryAmount)}`);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      loadData();
    } else {
      toast.error('Erro ao agendar pagamento');
    }
  };

  const handleSaveSalary = async () => {
    if (!user) return;

    const amount = parseFloat(salaryAmountInput.replace(',', '.'));
    const day = parseInt(salaryDayInput);

    if (isNaN(amount) || amount < 0 || isNaN(day) || day < 1 || day > 31) {
      toast.error('Valores inválidos');
      return;
    }

    const success = await updateUserSalaryInfo(user.userId, amount, day);
    if (success) {
      toast.success('Informações do salário atualizadas!');
      setIsSalaryModalOpen(false);
      loadData();
    } else {
      toast.error('Erro ao salvar');
    }
  };

  const handleConfirmPayment = async (payment: ScheduledPayment) => {
    if (!user || !payment.id) return;

    // Register as expense transaction
    await addTransaction({
      amount: payment.amount,
      type: 'expense',
      paymentMethod: 'debit',
      category: payment.category,
      description: payment.name,
      date: new Date(),
      userId: user.userId,
    });

    // Log the payment
    await addPaymentLog({
      userId: user.userId,
      scheduledPaymentId: payment.id,
      name: payment.name,
      amount: payment.amount,
      paidAt: new Date(),
      paymentType: 'scheduled',
    });

    // Update last paid date
    await updateScheduledPayment(payment.id, { lastPaidAt: new Date() });

    // If it's a one-time payment, deactivate it
    if (!payment.isRecurring) {
      await deleteScheduledPayment(payment.id);
    }

    await refreshUser();
    toast.success('Pagamento registrado!');
    speakNative(`Pagamento ${payment.name} de ${formatCurrency(payment.amount)} registrado com sucesso`);
    setPendingPayment(null);
    loadData();
  };

  const handleDeletePayment = async (paymentId: string) => {
    const success = await deleteScheduledPayment(paymentId);
    if (success) {
      toast.success('Pagamento removido');
      loadData();
    }
  };

  const recurringPayments = payments.filter(p => p.isRecurring);
  const oneTimePayments = payments.filter(p => !p.isRecurring);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Faça login para acessar o planejamento</p>
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen pb-28 px-4 pt-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold gradient-text">INOVA Pay Planner</h1>
          <p className="text-sm text-muted-foreground">Planejamento financeiro inteligente</p>
        </div>
        <Button
          size="icon"
          variant="outline"
          className="rounded-full"
          onClick={() => setIsSalaryModalOpen(true)}
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-green-500" />
            </div>
            <span className="text-xs text-muted-foreground">Salário</span>
          </div>
          <p className="text-lg font-bold text-green-500">
            {salaryInfo ? formatCurrency(salaryInfo.salaryAmount) : 'R$ 0,00'}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Dia {salaryInfo?.salaryDay || 5}
          </p>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-red-500" />
            </div>
            <span className="text-xs text-muted-foreground">Pagamentos</span>
          </div>
          <p className="text-lg font-bold text-red-500">
            {monthlySummary ? formatCurrency(monthlySummary.totalPayments) : 'R$ 0,00'}
          </p>
          <p className="text-[10px] text-muted-foreground">Este mês</p>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-blue-500" />
            </div>
            <span className="text-xs text-muted-foreground">Saldo Previsto</span>
          </div>
          <p className={cn(
            "text-lg font-bold",
            (monthlySummary?.projectedBalance || 0) >= 0 ? "text-blue-500" : "text-red-500"
          )}>
            {monthlySummary ? formatCurrency(monthlySummary.projectedBalance) : 'R$ 0,00'}
          </p>
          <p className="text-[10px] text-muted-foreground">Fim do mês</p>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
            </div>
            <span className="text-xs text-muted-foreground">Maior Gasto</span>
          </div>
          <p className="text-sm font-bold text-yellow-600 truncate">
            {monthlySummary?.heaviestPayment?.name || '-'}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {monthlySummary?.heaviestPayment ? formatCurrency(monthlySummary.heaviestPayment.amount) : '-'}
          </p>
        </GlassCard>
      </div>

      {/* Today's Due Payments Alert */}
      <AnimatePresence>
        {todaysDue.length > 0 && !pendingPayment && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6"
          >
            <GlassCard className="p-4 border-2 border-yellow-500/50 bg-yellow-500/10">
              <div className="flex items-center gap-3 mb-3">
                <Bell className="w-5 h-5 text-yellow-500 animate-bounce" />
                <span className="font-semibold text-yellow-600">Pagamentos para hoje!</span>
              </div>
              <div className="space-y-2">
                {todaysDue.map((payment) => (
                  <button
                    key={payment.id}
                    onClick={() => setPendingPayment(payment)}
                    className="w-full flex items-center justify-between p-3 bg-background/50 rounded-xl hover:bg-background transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{CATEGORY_ICONS[payment.category] || '📋'}</span>
                      <div className="text-left">
                        <p className="font-medium text-sm">{payment.name}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(payment.amount)}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending Payment Confirmation */}
      <AnimatePresence>
        {pendingPayment && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <GlassCard className="w-full max-w-sm p-6">
              <h3 className="text-lg font-bold mb-4 text-center">Confirmar Pagamento</h3>
              <div className="text-center mb-6">
                <span className="text-4xl mb-3 block">{CATEGORY_ICONS[pendingPayment.category] || '📋'}</span>
                <p className="font-semibold text-lg">{pendingPayment.name}</p>
                <p className="text-2xl font-bold text-primary mt-2">{formatCurrency(pendingPayment.amount)}</p>
                <p className="text-sm text-muted-foreground mt-1">Agendado para hoje</p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-12"
                  onClick={() => setPendingPayment(null)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Pular
                </Button>
                <Button
                  className="flex-1 h-12 bg-gradient-to-r from-primary to-secondary"
                  onClick={() => handleConfirmPayment(pendingPayment)}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Confirmar
                </Button>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recurring Payments */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Repeat className="w-4 h-4 text-primary" />
            Pagamentos Fixos
          </h2>
          <span className="text-xs text-muted-foreground">{recurringPayments.length} itens</span>
        </div>
        
        {recurringPayments.length === 0 ? (
          <GlassCard className="p-6 text-center">
            <p className="text-muted-foreground text-sm">Nenhum pagamento recorrente cadastrado</p>
          </GlassCard>
        ) : (
          <div className="space-y-2">
            {recurringPayments.map((payment) => (
              <GlassCard key={payment.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{CATEGORY_ICONS[payment.category] || '📋'}</span>
                    <div>
                      <p className="font-medium">{payment.name}</p>
                      <p className="text-xs text-muted-foreground">Todo dia {payment.dueDay}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-destructive">{formatCurrency(payment.amount)}</p>
                    <button
                      onClick={() => payment.id && handleDeletePayment(payment.id)}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {/* One-time Payments */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-secondary" />
            Pagamentos Únicos
          </h2>
          <span className="text-xs text-muted-foreground">{oneTimePayments.length} itens</span>
        </div>
        
        {oneTimePayments.length === 0 ? (
          <GlassCard className="p-6 text-center">
            <p className="text-muted-foreground text-sm">Nenhum pagamento único cadastrado</p>
          </GlassCard>
        ) : (
          <div className="space-y-2">
            {oneTimePayments.map((payment) => (
              <GlassCard key={payment.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{CATEGORY_ICONS[payment.category] || '📋'}</span>
                    <div>
                      <p className="font-medium">{payment.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {payment.specificMonth ? format(payment.specificMonth, "dd/MM/yyyy", { locale: ptBR }) : `Dia ${payment.dueDay}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-destructive">{formatCurrency(payment.amount)}</p>
                    <button
                      onClick={() => payment.id && handleDeletePayment(payment.id)}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {/* Add Payment FAB */}
      <motion.button
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center shadow-lg"
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsScheduleModalOpen(true)}
      >
        <Plus className="w-6 h-6 text-white" />
      </motion.button>

      {/* Schedule Payment Modal */}
      <SchedulePaymentModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onSchedule={handleSchedulePayment}
      />

      {/* Salary Settings Modal */}
      <AnimatePresence>
        {isSalaryModalOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSalaryModalOpen(false)}
            />
            <motion.div
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-md"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
            >
              <GlassCard className="p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  Configurar Salário
                </h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Valor do Salário (R$)</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={salaryAmountInput}
                      onChange={(e) => setSalaryAmountInput(e.target.value)}
                      className="h-12"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Dia do Recebimento</Label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={salaryDayInput}
                      onChange={(e) => setSalaryDayInput(e.target.value)}
                      className="h-12"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsSalaryModalOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-primary to-secondary"
                    onClick={handleSaveSalary}
                  >
                    Salvar
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
