import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Target, Trophy, Calendar, X } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { getGoals, addGoal, updateGoal, type Goal } from '@/lib/db';

export default function Goals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    targetAmount: '',
    currentAmount: '',
    deadline: '',
  });

  useEffect(() => {
    if (user) {
      loadGoals();
    }
  }, [user]);

  const loadGoals = async () => {
    if (!user) return;
    const g = await getGoals(user.userId);
    setGoals(g);
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
  };

  const handleUpdateGoal = async (id: number, amount: number) => {
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

  return (
    <motion.div
      className="min-h-screen pb-28 px-4 pt-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Metas</h1>
          <p className="text-muted-foreground text-sm">
            {goals.length} metas ativas
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
          <Target className="w-6 h-6" />
        </div>
      </div>

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
                        } ${progress >= 100 ? 'progress-glow' : ''}`}
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
          <div className="text-center py-12">
            <Target className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground mb-4">Nenhuma meta criada ainda</p>
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
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

      {/* Add Goal Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="w-full max-w-lg bg-card rounded-t-3xl p-6"
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
                  className="w-full h-12 bg-gradient-primary hover:opacity-90"
                >
                  Criar Meta
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
