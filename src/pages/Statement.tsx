import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  ArrowUpRight, 
  ArrowDownRight,
  Calendar,
  Clock,
  Filter,
  CreditCard,
  Banknote,
  Search
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuth } from '@/contexts/AuthContext';
import { getTransactions, type Transaction } from '@/lib/db';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type FilterType = 'all' | 'income' | 'expense';

export default function Statement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user) {
      loadTransactions();
    }
  }, [user]);

  const loadTransactions = async () => {
    if (!user) return;
    const txns = await getTransactions(user.userId);
    // Sort by date (most recent first)
    txns.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });
    setTransactions(txns);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "dd 'de' MMMM", { locale: ptBR });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, 'HH:mm', { locale: ptBR });
  };

  const filteredTransactions = transactions.filter(txn => {
    const matchesFilter = filter === 'all' || txn.type === filter;
    const matchesSearch = searchTerm === '' || 
      txn.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      txn.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Group transactions by date
  const groupedTransactions = filteredTransactions.reduce((groups, txn) => {
    const dateStr = new Date(txn.date).toISOString().split('T')[0];
    if (!groups[dateStr]) {
      groups[dateStr] = [];
    }
    groups[dateStr].push(txn);
    return groups;
  }, {} as Record<string, Transaction[]>);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
  };

  return (
    <motion.div
      className="min-h-screen pb-28 px-4 pt-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-card/50 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold">Extrato</h1>
          <p className="text-muted-foreground text-sm">
            {transactions.length} transações registradas
          </p>
        </div>
      </motion.div>

      {/* Search */}
      <motion.div variants={itemVariants} className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar transação..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-card/50 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
          />
        </div>
      </motion.div>

      {/* Filter Tabs */}
      <motion.div variants={itemVariants} className="flex gap-2 mb-6">
        {[
          { id: 'all', label: 'Todas' },
          { id: 'income', label: 'Entradas' },
          { id: 'expense', label: 'Saídas' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as FilterType)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              filter === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-card/50 text-muted-foreground hover:bg-card'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </motion.div>

      {/* Transactions by Date */}
      <div className="space-y-6">
        {Object.entries(groupedTransactions).map(([date, txns]) => (
          <motion.div key={date} variants={itemVariants}>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground capitalize">
                {formatDate(date)}
              </span>
            </div>
            
            <div className="space-y-3">
              <AnimatePresence>
                {txns.map((txn, index) => (
                  <motion.div
                    key={txn.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <GlassCard className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            txn.type === 'income' 
                              ? 'bg-success/20' 
                              : 'bg-destructive/20'
                          }`}>
                            {txn.type === 'income' 
                              ? <ArrowUpRight className="w-5 h-5 text-success" />
                              : <ArrowDownRight className="w-5 h-5 text-destructive" />
                            }
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {txn.description || txn.category}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-muted-foreground capitalize">
                                {txn.category}
                              </span>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {formatTime(txn.date.toString())}
                              </div>
                              {txn.paymentMethod && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  {txn.paymentMethod === 'credit' ? (
                                    <CreditCard className="w-3 h-3" />
                                  ) : (
                                    <Banknote className="w-3 h-3" />
                                  )}
                                  {txn.paymentMethod === 'credit' ? 'Crédito' : 'Débito'}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className={`text-right ${
                          txn.type === 'income' ? 'text-success' : 'text-destructive'
                        }`}>
                          <span className="font-semibold">
                            {txn.type === 'income' ? '+' : '-'} {formatCurrency(txn.amount)}
                          </span>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Empty State */}
      {filteredTransactions.length === 0 && (
        <motion.div 
          variants={itemVariants}
          className="text-center py-12"
        >
          <div className="w-16 h-16 rounded-full bg-card/50 flex items-center justify-center mx-auto mb-4">
            <Filter className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">
            Nenhuma transação encontrada
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
