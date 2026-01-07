import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Receipt,
  ChevronRight
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuth } from '@/contexts/AuthContext';
import { calculateBalance, getTransactions, type Transaction } from '@/lib/db';
import { AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useLoginGreeting } from '@/hooks/useLoginGreeting';

const CHART_COLORS = ['#7A5CFA', '#4A90FF', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [balance, setBalance] = useState(0);
  const [debitBalance, setDebitBalance] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categoryData, setCategoryData] = useState<{ name: string; value: number }[]>([]);
  const [chartData, setChartData] = useState<{ date: string; balance: number }[]>([]);

  // INOVA AI greeting on login
  useLoginGreeting({
    userId: user?.userId || 0,
    userName: user?.fullName || '',
    initialBalance: user?.initialBalance || 0,
    enabled: !!user
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    const { balance: bal, totalIncome: inc, totalExpense: exp, debitBalance: debit } = await calculateBalance(
      user.userId,
      user.initialBalance
    );
    setBalance(bal);
    setDebitBalance(Math.max(0, debit)); // Never show negative debit balance
    setTotalIncome(inc);
    setTotalExpense(exp);

    const txns = await getTransactions(user.userId);
    setTransactions(txns);

    // Process category data for pie chart
    const categoryMap = new Map<string, number>();
    txns.filter(t => t.type === 'expense').forEach(t => {
      const current = categoryMap.get(t.category) || 0;
      categoryMap.set(t.category, current + t.amount);
    });
    
    const catData = Array.from(categoryMap.entries()).map(([name, value]) => ({
      name,
      value,
    }));
    setCategoryData(catData);

    // Process chart data for area chart (last 7 days)
    const last7Days: { date: string; balance: number }[] = [];
    let runningBalance = user.initialBalance;
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      
      const dayTxns = txns.filter(t => {
        const txnDate = new Date(t.date);
        return txnDate.toDateString() === date.toDateString();
      });
      
      dayTxns.forEach(t => {
        if (t.type === 'income') {
          runningBalance += t.amount;
        } else if (t.paymentMethod === 'debit' || !t.paymentMethod) {
          runningBalance -= t.amount;
        }
      });
      
      last7Days.push({ date: dateStr, balance: runningBalance });
    }
    
    setChartData(last7Days);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, 'HH:mm', { locale: ptBR });
  };

  // Get last 5 expenses for the card
  const lastExpenses = transactions
    .filter(t => t.type === 'expense')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const getAIInsight = () => {
    if (totalExpense > totalIncome) {
      return "⚠️ Atenção! Seus gastos estão maiores que seus ganhos este mês.";
    } else if (totalIncome > 0 && totalExpense === 0) {
      return "🎯 Ótimo começo! Continue registrando suas transações.";
    } else if (debitBalance > user?.initialBalance! * 1.1) {
      return "🚀 Parabéns! Seu saldo cresceu mais de 10% desde o início!";
    }
    return "💡 Registre suas transações para receber insights personalizados.";
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      className="min-h-screen pb-28 px-4 pt-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-6">
        <p className="text-muted-foreground text-sm">Olá,</p>
        <h1 className="font-display text-2xl font-bold">
          {user?.fullName.split(' ')[0]} 👋
        </h1>
      </motion.div>

      {/* Bento Grid */}
      <div className="bento-grid">
        {/* Balance Card - Large (Saldo Débito) */}
        <motion.div variants={itemVariants} className="bento-item-large">
          <GlassCard className="p-6 relative overflow-hidden" glow>
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-5 h-5 text-emerald-500" />
                <span className="text-muted-foreground text-sm">Saldo Débito</span>
              </div>
              <h2 className="font-display text-4xl font-bold text-emerald-400">
                {formatCurrency(debitBalance)}
              </h2>
              <p className="text-xs text-muted-foreground mt-2">
                Disponível na conta
              </p>
            </div>
          </GlassCard>
        </motion.div>

        {/* Income Card */}
        <motion.div variants={itemVariants}>
          <GlassCard className="p-4 h-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-success" />
              </div>
            </div>
            <p className="text-muted-foreground text-xs mb-1">Ganhos</p>
            <p className="font-semibold text-lg text-success">
              {formatCurrency(totalIncome)}
            </p>
          </GlassCard>
        </motion.div>

        {/* Expense Card */}
        <motion.div variants={itemVariants}>
          <GlassCard className="p-4 h-full">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4 text-destructive" />
              </div>
            </div>
            <p className="text-muted-foreground text-xs mb-1">Gastos</p>
            <p className="font-semibold text-lg text-destructive">
              {formatCurrency(totalExpense)}
            </p>
          </GlassCard>
        </motion.div>

        {/* AI Insight Card */}
        <motion.div variants={itemVariants} className="bento-item-large">
          <GlassCard className="p-4 bg-gradient-to-r from-primary/10 to-secondary/10">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-primary font-medium mb-1">IA Insight</p>
                <p className="text-sm">{getAIInsight()}</p>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Area Chart - Balance Evolution */}
        <motion.div variants={itemVariants} className="bento-item-large">
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="font-medium">Evolução do Saldo</h3>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22C55E" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 10 }}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(222 47% 12%)',
                      border: '1px solid hsl(0 0% 100% / 0.1)',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'Saldo']}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="#22C55E"
                    strokeWidth={2}
                    fill="url(#balanceGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </motion.div>

        {/* Pie Chart - Categories */}
        <motion.div variants={itemVariants} className="bento-item-large">
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-5 h-5 text-primary" />
              <h3 className="font-medium">Gastos por Categoria</h3>
            </div>
            {categoryData.length > 0 ? (
              <div className="flex items-center gap-4">
                <div className="w-32 h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={50}
                        paddingAngle={5}
                      >
                        {categoryData.map((_, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={CHART_COLORS[index % CHART_COLORS.length]} 
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {categoryData.slice(0, 4).map((cat, index) => (
                    <div key={cat.name} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="text-xs text-muted-foreground capitalize">
                        {cat.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">
                Nenhum gasto registrado ainda
              </p>
            )}
          </GlassCard>
        </motion.div>

        {/* Last Expenses Card */}
        <motion.div variants={itemVariants} className="bento-item-large">
          <GlassCard className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" />
                <h3 className="font-medium">Últimos Gastos</h3>
              </div>
              <button 
                onClick={() => navigate('/statement')}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Extrato completo
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            {lastExpenses.length > 0 ? (
              <div className="space-y-3">
                {lastExpenses.map((expense) => (
                  <div 
                    key={expense.id} 
                    className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center">
                        <ArrowDownRight className="w-4 h-4 text-destructive" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {expense.description || expense.category}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {expense.category} • {formatTime(expense.date.toString())}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-destructive">
                      -{formatCurrency(expense.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">
                Nenhum gasto registrado ainda
              </p>
            )}
          </GlassCard>
        </motion.div>
      </div>
    </motion.div>
  );
}
