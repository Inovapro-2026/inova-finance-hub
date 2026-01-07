import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getFinancialStats } from "@/lib/adminDb";
import { 
  Wallet, 
  TrendingUp, 
  CalendarCheck, 
  Users,
  Receipt,
  ArrowUpCircle,
  ArrowDownCircle,
  Clock,
  Loader2,
  Download,
  PieChart as PieChartIcon,
  BarChart3,
  TrendingDown
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from "recharts";

interface FinancialStats {
  totalBalance: number;
  averageBalance: number;
  totalSalaryCredits: number;
  totalScheduledPayments: number;
  totalTransactions: number;
  salaryCredits: Array<{ amount: number; month_year: string; credited_at: string }>;
  incomeTransactions: Array<{ amount: number; description: string; date: string }>;
  expenseTransactions: Array<{ amount: number; description: string; date: string }>;
  paymentLogs: Array<{ amount: number; name: string; paid_at: string }>;
  pendingPayments: Array<{ amount: number; name: string; due_day: number }>;
}

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function AdminFinancial() {
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewPeriod, setViewPeriod] = useState('month');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    const data = await getFinancialStats();
    setStats(data);
    setIsLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatCompactCurrency = (value: number) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(1)}K`;
    }
    return formatCurrency(value);
  };

  const exportFinancialReport = () => {
    if (!stats) return;
    
    const report = [
      ['Relatório Financeiro - INOVABANK'],
      ['Data:', new Date().toLocaleDateString('pt-BR')],
      [''],
      ['Resumo Geral'],
      ['Saldo Total:', formatCurrency(stats.totalBalance)],
      ['Média por Cliente:', formatCurrency(stats.averageBalance)],
      ['Salários Creditados (Mês):', formatCurrency(stats.totalSalaryCredits)],
      ['Pagamentos Planejados:', formatCurrency(stats.totalScheduledPayments)],
      ['Total de Transações:', stats.totalTransactions],
      [''],
      ['Transações de Entrada (Mês)'],
      ...stats.incomeTransactions.map(t => [t.description || 'Entrada', formatCurrency(Number(t.amount)), t.date]),
      [''],
      ['Transações de Saída (Mês)'],
      ...stats.expenseTransactions.map(t => [t.description || 'Saída', formatCurrency(Number(t.amount)), t.date]),
    ];

    const csvContent = report.map(row => (Array.isArray(row) ? row.join(',') : row)).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_financeiro_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    {
      title: "Saldo Geral",
      value: formatCurrency(stats.totalBalance),
      icon: Wallet,
      color: "text-blue-400",
      bgColor: "bg-blue-500/20"
    },
    {
      title: "Salários Creditados (Mês)",
      value: formatCurrency(stats.totalSalaryCredits),
      icon: TrendingUp,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/20"
    },
    {
      title: "Pagamentos Planejados (Mês)",
      value: formatCurrency(stats.totalScheduledPayments),
      icon: CalendarCheck,
      color: "text-purple-400",
      bgColor: "bg-purple-500/20"
    },
    {
      title: "Média de Saldo por Cliente",
      value: formatCurrency(stats.averageBalance),
      icon: Users,
      color: "text-orange-400",
      bgColor: "bg-orange-500/20"
    },
    {
      title: "Total de Transações",
      value: stats.totalTransactions.toString(),
      icon: Receipt,
      color: "text-pink-400",
      bgColor: "bg-pink-500/20"
    }
  ];

  // Calculate totals for pie chart
  const totalIncome = stats.incomeTransactions.reduce((acc, t) => acc + Number(t.amount), 0);
  const totalExpense = stats.expenseTransactions.reduce((acc, t) => acc + Number(t.amount), 0);
  const totalPaid = stats.paymentLogs.reduce((acc, p) => acc + Number(p.amount), 0);

  const flowPieData = [
    { name: 'Entradas', value: totalIncome + stats.totalSalaryCredits, color: '#10b981' },
    { name: 'Saídas', value: totalExpense, color: '#ef4444' },
    { name: 'Pagamentos', value: totalPaid, color: '#f59e0b' }
  ].filter(item => item.value > 0);

  // Payments by category
  const paymentsByCategory = stats.pendingPayments.reduce((acc, p) => {
    const existing = acc.find(item => item.name === (p.name.split(' ')[0] || 'Outros'));
    if (existing) {
      existing.value += Number(p.amount);
    } else {
      acc.push({ name: p.name.split(' ')[0] || 'Outros', value: Number(p.amount) });
    }
    return acc;
  }, [] as Array<{ name: string; value: number }>).slice(0, 5);

  // Daily transactions for bar chart
  const dailyData = [
    { day: '1-5', entradas: 0, saidas: 0 },
    { day: '6-10', entradas: 0, saidas: 0 },
    { day: '11-15', entradas: 0, saidas: 0 },
    { day: '16-20', entradas: 0, saidas: 0 },
    { day: '21-25', entradas: 0, saidas: 0 },
    { day: '26-31', entradas: 0, saidas: 0 }
  ];

  stats.incomeTransactions.forEach(t => {
    const day = new Date(t.date).getDate();
    const index = Math.min(Math.floor((day - 1) / 5), 5);
    dailyData[index].entradas += Number(t.amount);
  });

  stats.expenseTransactions.forEach(t => {
    const day = new Date(t.date).getDate();
    const index = Math.min(Math.floor((day - 1) / 5), 5);
    dailyData[index].saidas += Number(t.amount);
  });

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Visão Financeira</h2>
          <p className="text-sm text-slate-400">Acompanhe as métricas financeiras do banco</p>
        </div>
        <div className="flex gap-2">
          <Select value={viewPeriod} onValueChange={setViewPeriod}>
            <SelectTrigger className="w-32 bg-slate-800/50 border-slate-700 text-white">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="month">Mês</SelectItem>
              <SelectItem value="year">Ano</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={exportFinancialReport}
            className="bg-slate-800/50 border-slate-700 text-white hover:bg-slate-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400 truncate">{stat.title}</p>
                    <p className={`text-lg font-bold ${stat.color} truncate`}>{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cash Flow Pie Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-white">
                <PieChartIcon className="w-4 h-4 text-emerald-400" />
                Fluxo de Caixa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={flowPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {flowPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        border: '1px solid #475569',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Transactions by Period Bar Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-white">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                Movimentação por Período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                    <YAxis 
                      tickFormatter={formatCompactCurrency}
                      stroke="#94a3b8" 
                      fontSize={11} 
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        border: '1px solid #475569',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                    />
                    <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
                    <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-emerald-500/10 border-emerald-500/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <ArrowUpCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-emerald-300">Total de Entradas</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {formatCurrency(totalIncome + stats.totalSalaryCredits)}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
        >
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <ArrowDownCircle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p className="text-sm text-red-300">Total de Saídas</p>
                <p className="text-2xl font-bold text-red-400">
                  {formatCurrency(totalExpense + totalPaid)}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className={`${(totalIncome + stats.totalSalaryCredits - totalExpense - totalPaid) >= 0 ? 'bg-blue-500/10 border-blue-500/30' : 'bg-orange-500/10 border-orange-500/30'}`}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full ${(totalIncome + stats.totalSalaryCredits - totalExpense - totalPaid) >= 0 ? 'bg-blue-500/20' : 'bg-orange-500/20'} flex items-center justify-center`}>
                <TrendingUp className={`w-6 h-6 ${(totalIncome + stats.totalSalaryCredits - totalExpense - totalPaid) >= 0 ? 'text-blue-400' : 'text-orange-400'}`} />
              </div>
              <div>
                <p className={`text-sm ${(totalIncome + stats.totalSalaryCredits - totalExpense - totalPaid) >= 0 ? 'text-blue-300' : 'text-orange-300'}`}>Balanço do Mês</p>
                <p className={`text-2xl font-bold ${(totalIncome + stats.totalSalaryCredits - totalExpense - totalPaid) >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                  {formatCurrency(totalIncome + stats.totalSalaryCredits - totalExpense - totalPaid)}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Lists Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Salary Credits */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
        >
          <Card className="bg-slate-800/50 border-slate-700 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <ArrowUpCircle className="w-5 h-5 text-emerald-400" />
                Entradas (Salários) do Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {stats.salaryCredits.length === 0 ? (
                  <p className="text-slate-400 text-sm">Nenhum salário creditado este mês.</p>
                ) : (
                  stats.salaryCredits.map((credit, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                    >
                      <div>
                        <span className="text-white text-sm">Salário</span>
                        <span className="text-xs text-slate-400 block">
                          {new Date(credit.credited_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <span className="text-emerald-400 font-semibold">
                        +{formatCurrency(Number(credit.amount))}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Expenses */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card className="bg-slate-800/50 border-slate-700 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <ArrowDownCircle className="w-5 h-5 text-red-400" />
                Saídas do Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {stats.expenseTransactions.length === 0 && stats.paymentLogs.length === 0 ? (
                  <p className="text-slate-400 text-sm">Nenhuma saída registrada este mês.</p>
                ) : (
                  <>
                    {stats.expenseTransactions.slice(0, 5).map((expense, index) => (
                      <div 
                        key={`exp-${index}`} 
                        className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                      >
                        <div>
                          <span className="text-white text-sm">{expense.description || 'Gasto'}</span>
                          <span className="text-xs text-slate-400 block">{expense.date}</span>
                        </div>
                        <span className="text-red-400 font-semibold">
                          -{formatCurrency(Number(expense.amount))}
                        </span>
                      </div>
                    ))}
                    {stats.paymentLogs.slice(0, 5).map((payment, index) => (
                      <div 
                        key={`pay-${index}`} 
                        className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                      >
                        <div>
                          <span className="text-white text-sm">{payment.name}</span>
                          <span className="text-xs text-slate-400 block">
                            {new Date(payment.paid_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <span className="text-red-400 font-semibold">
                          -{formatCurrency(Number(payment.amount))}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pending Payments */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
        >
          <Card className="bg-slate-800/50 border-slate-700 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <Clock className="w-5 h-5 text-orange-400" />
                Pagamentos Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {stats.pendingPayments.length === 0 ? (
                  <p className="text-slate-400 text-sm">Nenhum pagamento pendente.</p>
                ) : (
                  stats.pendingPayments.slice(0, 10).map((payment, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                    >
                      <div>
                        <span className="text-white text-sm">{payment.name}</span>
                        <span className="text-xs text-slate-400 block">Dia {payment.due_day}</span>
                      </div>
                      <span className="text-orange-400 font-semibold">
                        {formatCurrency(Number(payment.amount))}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
