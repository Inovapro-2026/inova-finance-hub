import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Target, Trophy, Calendar, X, User, Mail, Phone, CreditCard, Wallet, Lock, Edit3, Check, Hash, DollarSign, CalendarDays, LogOut } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getGoals, addGoal, updateGoal, updateProfile, type Goal } from '@/lib/db';
import { updateUserSalaryInfo, getUserSalaryInfo } from '@/lib/plannerDb';
import { toast } from 'sonner';
import { useIsaGreeting } from '@/hooks/useIsaGreeting';

export default function Goals() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'goals'>('profile');
  const [editingName, setEditingName] = useState(false);
  const [editingBalance, setEditingBalance] = useState(false);
  const [editingSalary, setEditingSalary] = useState(false);
  const [editingSalaryDay, setEditingSalaryDay] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBalance, setNewBalance] = useState('');
  const [newSalary, setNewSalary] = useState('');
  const [newSalaryDay, setNewSalaryDay] = useState('');
  const [salaryInfo, setSalaryInfo] = useState<{ salaryAmount: number; salaryDay: number } | null>(null);
  const [newGoal, setNewGoal] = useState({
    title: '',
    targetAmount: '',
    currentAmount: '',
    deadline: '',
  });

  // ISA greeting for Goals/Profile page
  useIsaGreeting({
    pageType: 'goals',
    userId: user?.userId || 0,
    userName: user?.fullName || '',
    initialBalance: user?.initialBalance || 0,
    enabled: !!user && activeTab === 'goals'
  });

  useEffect(() => {
    if (user) {
      loadGoals();
      loadSalaryInfo();
      setNewName(user.fullName || '');
      setNewBalance(user.initialBalance?.toString() || '0');
    }
  }, [user]);

  const loadSalaryInfo = async () => {
    if (!user) return;
    const info = await getUserSalaryInfo(user.userId);
    if (info) {
      setSalaryInfo(info);
      setNewSalary(info.salaryAmount.toString());
      setNewSalaryDay(info.salaryDay.toString());
    }
  };

  const loadGoals = async () => {
    if (!user) return;
    const g = await getGoals(user.userId);
    setGoals(g);
  };

  const handleSaveName = async () => {
    if (!user || !newName.trim()) return;
    await updateProfile(user.userId, { fullName: newName.trim() });
    await refreshUser();
    setEditingName(false);
    toast.success('Nome atualizado!');
  };

  const handleSaveBalance = async () => {
    if (!user) return;
    const balance = parseFloat(newBalance);
    if (isNaN(balance) || balance < 0) {
      toast.error('Valor inválido');
      return;
    }
    await updateProfile(user.userId, { initialBalance: balance });
    await refreshUser();
    setEditingBalance(false);
    toast.success('Saldo atualizado!');
  };

  const handleSaveSalary = async () => {
    if (!user) return;
    const salary = parseFloat(newSalary.replace(',', '.'));
    if (isNaN(salary) || salary < 0) {
      toast.error('Valor inválido');
      return;
    }
    await updateUserSalaryInfo(user.userId, salary, salaryInfo?.salaryDay || 5);
    await loadSalaryInfo();
    setEditingSalary(false);
    toast.success('Salário atualizado!');
  };

  const handleSaveSalaryDay = async () => {
    if (!user) return;
    const day = parseInt(newSalaryDay);
    if (isNaN(day) || day < 1 || day > 31) {
      toast.error('Dia inválido (1-31)');
      return;
    }
    await updateUserSalaryInfo(user.userId, salaryInfo?.salaryAmount || 0, day);
    await loadSalaryInfo();
    setEditingSalaryDay(false);
    toast.success('Dia do salário atualizado!');
  };

  const handleAddGoal = async () => {
    if (!user || !newGoal.title || !newGoal.targetAmount) return;

    await addGoal({
      title: newGoal.title,
      targetAmount: parseFloat(newGoal.targetAmount),
      currentAmount: parseFloat(newGoal.currentAmount) || 0,
      deadline: newGoal.deadline ? new Date(newGoal.deadline) : new Date(),
      userId: user.userId,
    });

    setNewGoal({ title: '', targetAmount: '', currentAmount: '', deadline: '' });
    setShowAddModal(false);
    loadGoals();
    toast.success('Meta criada!');
  };

  const handleUpdateGoal = async (id: string, amount: number) => {
    await updateGoal(id, { currentAmount: amount });
    loadGoals();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getProgress = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const getDaysRemaining = (deadline: Date) => {
    const now = new Date();
    const end = new Date(deadline);
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const formatPhone = (phone: string | undefined) => {
    if (!phone) return 'Não informado';
    return phone;
  };

  return (
    <motion.div
      className="min-h-screen pb-28 px-4 pt-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Perfil</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie sua conta e metas
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
          <User className="w-6 h-6" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all ${
            activeTab === 'profile'
              ? 'bg-gradient-primary text-white'
              : 'bg-muted/50 text-muted-foreground'
          }`}
        >
          Dados da Conta
        </button>
        <button
          onClick={() => setActiveTab('goals')}
          className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all ${
            activeTab === 'goals'
              ? 'bg-gradient-primary text-white'
              : 'bg-muted/50 text-muted-foreground'
          }`}
        >
          Metas ({goals.length})
        </button>
      </div>

      {activeTab === 'profile' ? (
        <div className="space-y-4">
          {/* Matrícula */}
          <GlassCard className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Hash className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Matrícula</p>
                <p className="font-mono text-xl font-bold gradient-text">{user?.userId || '------'}</p>
              </div>
              <Lock className="w-5 h-5 text-muted-foreground" />
            </div>
          </GlassCard>

          {/* Nome - Editável */}
          <GlassCard className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center">
                <User className="w-6 h-6 text-secondary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Nome completo</p>
                {editingName ? (
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-8 bg-muted/50 border-primary"
                    autoFocus
                  />
                ) : (
                  <p className="font-medium">{user?.fullName || 'Não informado'}</p>
                )}
              </div>
              {editingName ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingName(false)}
                    className="p-2 rounded-lg bg-muted hover:bg-muted/80"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleSaveName}
                    className="p-2 rounded-lg bg-primary text-primary-foreground"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingName(true)}
                  className="p-2 rounded-lg bg-muted hover:bg-muted/80"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>
          </GlassCard>

          {/* Email - Bloqueado */}
          <GlassCard className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Mail className="w-6 h-6 text-blue-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Email</p>
                <p className="font-medium">{user?.email || 'Não informado'}</p>
              </div>
              <Lock className="w-5 h-5 text-muted-foreground" />
            </div>
          </GlassCard>

          {/* Telefone - Bloqueado */}
          <GlassCard className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Phone className="w-6 h-6 text-emerald-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Telefone</p>
                <p className="font-medium">{formatPhone(user?.phone)}</p>
              </div>
              <Lock className="w-5 h-5 text-muted-foreground" />
            </div>
          </GlassCard>

          {/* Saldo Débito - Editável */}
          <GlassCard className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-success" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Saldo Inicial (Débito)</p>
                {editingBalance ? (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">R$</span>
                    <Input
                      type="number"
                      value={newBalance}
                      onChange={(e) => setNewBalance(e.target.value)}
                      className="h-8 bg-muted/50 border-primary w-32"
                      autoFocus
                    />
                  </div>
                ) : (
                  <p className="font-semibold text-lg text-success">
                    {formatCurrency(user?.initialBalance || 0)}
                  </p>
                )}
              </div>
              {editingBalance ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingBalance(false);
                      setNewBalance(user?.initialBalance?.toString() || '0');
                    }}
                    className="p-2 rounded-lg bg-muted hover:bg-muted/80"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleSaveBalance}
                    className="p-2 rounded-lg bg-primary text-primary-foreground"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingBalance(true)}
                  className="p-2 rounded-lg bg-muted hover:bg-muted/80"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>
          </GlassCard>

          {/* Limite Crédito - Bloqueado */}
          <GlassCard className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-warning" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Limite de Crédito</p>
                <p className="font-semibold text-lg">{formatCurrency(user?.creditLimit || 0)}</p>
              </div>
              <Lock className="w-5 h-5 text-muted-foreground" />
            </div>
          </GlassCard>

          {/* Valor do Salário - Editável */}
          <GlassCard className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Valor do Salário</p>
                {editingSalary ? (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">R$</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={newSalary}
                      onChange={(e) => setNewSalary(e.target.value)}
                      className="h-8 bg-muted/50 border-primary w-32"
                      autoFocus
                    />
                  </div>
                ) : (
                  <p className="font-semibold text-lg text-green-500">
                    {formatCurrency(salaryInfo?.salaryAmount || 0)}
                  </p>
                )}
              </div>
              {editingSalary ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingSalary(false);
                      setNewSalary(salaryInfo?.salaryAmount?.toString() || '0');
                    }}
                    className="p-2 rounded-lg bg-muted hover:bg-muted/80"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleSaveSalary}
                    className="p-2 rounded-lg bg-primary text-primary-foreground"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingSalary(true)}
                  className="p-2 rounded-lg bg-muted hover:bg-muted/80"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>
          </GlassCard>

          {/* Dia do Salário - Editável */}
          <GlassCard className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <CalendarDays className="w-6 h-6 text-purple-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Dia do Pagamento</p>
                {editingSalaryDay ? (
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={newSalaryDay}
                    onChange={(e) => setNewSalaryDay(e.target.value)}
                    className="h-8 bg-muted/50 border-primary w-20"
                    autoFocus
                  />
                ) : (
                  <p className="font-semibold text-lg text-purple-500">
                    Dia {salaryInfo?.salaryDay || 5}
                  </p>
                )}
              </div>
              {editingSalaryDay ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingSalaryDay(false);
                      setNewSalaryDay(salaryInfo?.salaryDay?.toString() || '5');
                    }}
                    className="p-2 rounded-lg bg-muted hover:bg-muted/80"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleSaveSalaryDay}
                    className="p-2 rounded-lg bg-primary text-primary-foreground"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingSalaryDay(true)}
                  className="p-2 rounded-lg bg-muted hover:bg-muted/80"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>
          </GlassCard>

          {/* Logout Button */}
          <Button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            variant="outline"
            className="w-full mt-6 py-6 border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Sair da conta
          </Button>
        </div>
      ) : (
        <>
          {/* Goals List */}
          <div className="space-y-4">
            <AnimatePresence>
              {goals.map((goal, index) => {
                const progress = getProgress(goal.currentAmount, goal.targetAmount);
                const daysRemaining = getDaysRemaining(goal.deadline);
                const isCompleted = progress >= 100;

                return (
                  <motion.div
                    key={goal.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <GlassCard 
                      className={`p-5 ${isCompleted ? 'border-success/50' : ''}`}
                      glow={isCompleted}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              isCompleted
                                ? 'bg-success/20'
                                : 'bg-primary/20'
                            }`}
                          >
                            {isCompleted ? (
                              <Trophy className="w-5 h-5 text-success" />
                            ) : (
                              <Target className="w-5 h-5 text-primary" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold">{goal.title}</h3>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {daysRemaining > 0 ? (
                                <span>{daysRemaining} dias restantes</span>
                              ) : (
                                <span className="text-warning">Prazo expirado</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {isCompleted && (
                          <span className="text-xs bg-success/20 text-success px-2 py-1 rounded-full">
                            Concluída! 🎉
                          </span>
                        )}
                      </div>

                      {/* Progress */}
                      <div className="mb-3">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-muted-foreground">Progresso</span>
                          <span className="font-medium">{progress.toFixed(0)}%</span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 1, delay: index * 0.1 }}
                            className={`h-full rounded-full ${
                              isCompleted
                                ? 'bg-success glow-success'
                                : 'bg-gradient-primary'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Amounts */}
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-muted-foreground text-xs">Atual</span>
                          <p className="font-semibold gradient-text">
                            {formatCurrency(goal.currentAmount)}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-muted-foreground text-xs">Meta</span>
                          <p className="font-semibold">
                            {formatCurrency(goal.targetAmount)}
                          </p>
                        </div>
                      </div>

                      {/* Quick Add */}
                      {!isCompleted && (
                        <div className="mt-4 flex gap-2">
                          {[50, 100, 200].map((amount) => (
                            <button
                              key={amount}
                              onClick={() =>
                                handleUpdateGoal(goal.id!, goal.currentAmount + amount)
                              }
                              className="flex-1 py-2 rounded-lg bg-muted/50 hover:bg-muted text-sm font-medium transition-colors"
                            >
                              +R${amount}
                            </button>
                          ))}
                        </div>
                      )}
                    </GlassCard>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {goals.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[40vh] text-center py-12">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <Target className="w-10 h-10 text-primary/50" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Nenhuma meta criada</h3>
                <p className="text-muted-foreground mb-6 max-w-xs">
                  Crie suas metas financeiras e acompanhe seu progresso
                </p>
                <Button
                  onClick={() => setShowAddModal(true)}
                  className="bg-gradient-primary"
                  size="lg"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Criar primeira meta
                </Button>
              </div>
            )}
          </div>

          {/* FAB */}
          {goals.length > 0 && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAddModal(true)}
              className="fixed bottom-28 right-6 w-14 h-14 rounded-full bg-gradient-primary flex items-center justify-center shadow-lg glow-primary z-40"
            >
              <Plus className="w-6 h-6" />
            </motion.button>
          )}
        </>
      )}

      {/* Add Goal Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="w-full max-w-lg bg-card rounded-t-3xl p-6 max-h-[calc(100dvh-5rem)] overflow-y-auto pb-28"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-bold">Nova Meta</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 rounded-full bg-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Nome da meta
                  </label>
                  <Input
                    value={newGoal.title}
                    onChange={(e) =>
                      setNewGoal({ ...newGoal, title: e.target.value })
                    }
                    placeholder="Ex: Viagem para Europa"
                    className="bg-muted/50 border-border"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Valor da meta
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                      R$
                    </span>
                    <Input
                      type="number"
                      value={newGoal.targetAmount}
                      onChange={(e) =>
                        setNewGoal({ ...newGoal, targetAmount: e.target.value })
                      }
                      placeholder="0,00"
                      className="pl-12 bg-muted/50 border-border"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Valor inicial (opcional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                      R$
                    </span>
                    <Input
                      type="number"
                      value={newGoal.currentAmount}
                      onChange={(e) =>
                        setNewGoal({ ...newGoal, currentAmount: e.target.value })
                      }
                      placeholder="0,00"
                      className="pl-12 bg-muted/50 border-border"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Prazo
                  </label>
                  <Input
                    type="date"
                    value={newGoal.deadline}
                    onChange={(e) =>
                      setNewGoal({ ...newGoal, deadline: e.target.value })
                    }
                    className="bg-muted/50 border-border"
                  />
                </div>

                <Button
                  onClick={handleAddGoal}
                  disabled={!newGoal.title || !newGoal.targetAmount}
                  className="w-full h-12 bg-gradient-primary hover:opacity-90 mt-4"
                >
                  Salvar
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
