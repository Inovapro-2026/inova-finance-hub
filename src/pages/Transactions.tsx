import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownRight, 
  Filter,
  X,
  Utensils,
  Car,
  Gamepad2,
  ShoppingBag,
  Heart,
  GraduationCap,
  Receipt,
  MoreHorizontal,
  Briefcase,
  Laptop,
  TrendingUp,
  Gift,
  CreditCard,
  Wallet
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getTransactions, 
  addTransaction, 
  EXPENSE_CATEGORIES, 
  INCOME_CATEGORIES,
  type Transaction 
} from '@/lib/db';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Utensils,
  Car,
  Gamepad2,
  ShoppingBag,
  Heart,
  GraduationCap,
  Receipt,
  MoreHorizontal,
  Briefcase,
  Laptop,
  TrendingUp,
  Gift,
};

export default function Transactions() {
  const { user, refreshUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
  const [paymentMethod, setPaymentMethod] = useState<'debit' | 'credit'>('debit');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    if (user) {
      loadTransactions();
    }
  }, [user]);

  const loadTransactions = async () => {
    if (!user) return;
    const txns = await getTransactions(user.userId);
    setTransactions(txns);
  };

  const handleAddTransaction = async () => {
    if (!user || !amount || !selectedCategory) return;

    await addTransaction({
      amount: parseFloat(amount),
      type: transactionType,
      paymentMethod: transactionType === 'expense' ? paymentMethod : 'debit',
      category: selectedCategory,
      description: description || selectedCategory,
      date: new Date(),
      userId: user.userId,
    });

    await refreshUser();
    setAmount('');
    setDescription('');
    setSelectedCategory('');
    setPaymentMethod('debit');
    setShowAddModal(false);
    loadTransactions();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });
  };

  const filteredTransactions = transactions.filter((t) => {
    if (filter === 'all') return true;
    return t.type === filter;
  });

  const categories = transactionType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <motion.div
      className="min-h-screen pb-28 px-4 pt-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Transações</h1>
          <p className="text-muted-foreground text-sm">
            {transactions.length} transações registradas
          </p>
        </div>
        <button className="p-2 rounded-xl bg-muted/50 border border-border">
          <Filter className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'income', 'expense'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              filter === f
                ? 'bg-gradient-primary text-white'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            {f === 'all' ? 'Todas' : f === 'income' ? 'Ganhos' : 'Gastos'}
          </button>
        ))}
      </div>

      {/* Transactions List */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredTransactions.map((transaction, index) => {
            const category = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].find(
              (c) => c.id === transaction.category
            );
            const IconComponent = category ? iconMap[category.icon] : MoreHorizontal;

            return (
              <motion.div
                key={transaction.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
              >
                <GlassCard className="p-4" hover={false}>
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        transaction.type === 'income'
                          ? 'bg-success/20'
                          : 'bg-destructive/20'
                      }`}
                    >
                      <IconComponent
                        className={`w-6 h-6 ${
                          transaction.type === 'income'
                            ? 'text-success'
                            : 'text-destructive'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{transaction.description}</p>
                      <p className="text-muted-foreground text-xs flex items-center gap-1">
                        {formatDate(transaction.date)} • {category?.label || transaction.category}
                        {transaction.paymentMethod === 'credit' && (
                          <span className="text-secondary ml-1">• Crédito</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-semibold ${
                          transaction.type === 'income'
                            ? 'text-success'
                            : 'text-destructive'
                        }`}
                      >
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </p>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredTransactions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhuma transação encontrada</p>
          </div>
        )}
      </div>

      {/* FAB */}
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

      {/* Add Transaction Modal */}
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
              className="w-full max-w-lg bg-card rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-bold">Nova Transação</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 rounded-full bg-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Type Toggle */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => {
                    setTransactionType('expense');
                    setSelectedCategory('');
                  }}
                  className={`flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    transactionType === 'expense'
                      ? 'bg-destructive/20 text-destructive border border-destructive/50'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <ArrowDownRight className="w-5 h-5" />
                  Gasto
                </button>
                <button
                  onClick={() => {
                    setTransactionType('income');
                    setSelectedCategory('');
                  }}
                  className={`flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    transactionType === 'income'
                      ? 'bg-success/20 text-success border border-success/50'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <ArrowUpRight className="w-5 h-5" />
                  Ganho
                </button>
              </div>

              {/* Payment Method (only for expenses) */}
              {transactionType === 'expense' && (
                <div className="mb-6">
                  <label className="text-sm font-medium mb-3 block">Pagar com</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPaymentMethod('debit')}
                      className={cn(
                        "flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
                        paymentMethod === 'debit'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <Wallet className="w-5 h-5" />
                      Débito
                    </button>
                    <button
                      onClick={() => setPaymentMethod('credit')}
                      className={cn(
                        "flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
                        paymentMethod === 'credit'
                          ? 'bg-secondary/20 text-secondary border border-secondary/50'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <CreditCard className="w-5 h-5" />
                      Crédito
                    </button>
                  </div>
                </div>
              )}

              {/* Amount */}
              <div className="mb-6">
                <label className="text-sm font-medium mb-2 block">Valor</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    R$
                  </span>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                    className="pl-12 text-2xl font-bold h-14 bg-muted/50 border-border"
                  />
                </div>
              </div>

              {/* Categories */}
              <div className="mb-6">
                <label className="text-sm font-medium mb-3 block">Categoria</label>
                <div className="grid grid-cols-4 gap-2">
                  {categories.map((cat) => {
                    const IconComponent = iconMap[cat.icon];
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`p-3 rounded-xl flex flex-col items-center gap-1 transition-all ${
                          selectedCategory === cat.id
                            ? 'bg-primary/20 border border-primary'
                            : 'bg-muted/50 hover:bg-muted'
                        }`}
                      >
                        <IconComponent className="w-5 h-5" />
                        <span className="text-[10px] text-center">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <label className="text-sm font-medium mb-2 block">
                  Descrição (opcional)
                </label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Almoço com amigos"
                  className="bg-muted/50 border-border"
                />
              </div>

              {/* Submit */}
              <Button
                onClick={handleAddTransaction}
                disabled={!amount || !selectedCategory}
                className="w-full h-12 bg-gradient-primary hover:opacity-90"
              >
                Adicionar Transação
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
