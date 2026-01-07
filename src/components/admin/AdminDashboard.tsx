import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardStats } from "@/lib/adminDb";
import { 
  Users, 
  UserX, 
  Wallet, 
  TrendingDown, 
  CalendarCheck, 
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Loader2,
  Activity,
  PieChart as PieChartIcon,
  BarChart3
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

interface DashboardStats {
  activeUsers: number;
  blockedUsers: number;
  totalBalance: number;
  totalTodayExpenses: number;
  totalScheduledPayments: number;
  totalSalaryCredits: number;
  usersWithSalaryToday: Array<{ full_name: string; salary_amount: number }>;
  paymentsToday: Array<{ name: string; amount: number; user_matricula: number }>;
  totalImpact: number;
}

const CHART_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6', '#ec4899'];

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    const data = await getDashboardStats();
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
      title: "Clientes Ativos",
      value: stats.activeUsers,
      icon: Users,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/20"
    },
    {
      title: "Clientes Bloqueados",
      value: stats.blockedUsers,
      icon: UserX,
      color: "text-red-400",
      bgColor: "bg-red-500/20"
    },
    {
      title: "Saldo Total sob Gestão",
      value: formatCurrency(stats.totalBalance),
      icon: Wallet,
      color: "text-blue-400",
      bgColor: "bg-blue-500/20"
    },
    {
      title: "Gastos de Hoje",
      value: formatCurrency(stats.totalTodayExpenses),
      icon: TrendingDown,
      color: "text-orange-400",
      bgColor: "bg-orange-500/20"
    },
    {
      title: "Pagamentos Agendados (Mês)",
      value: formatCurrency(stats.totalScheduledPayments),
      icon: CalendarCheck,
      color: "text-purple-400",
      bgColor: "bg-purple-500/20"
    },
    {
      title: "Impacto Geral do Banco",
      value: formatCurrency(stats.totalImpact),
      icon: TrendingUp,
      color: "text-primary",
      bgColor: "bg-primary/20"
    }
  ];

  // Data for pie chart - Users distribution
  const usersPieData = [
    { name: 'Ativos', value: stats.activeUsers, color: '#10b981' },
    { name: 'Bloqueados', value: stats.blockedUsers, color: '#ef4444' }
  ].filter(item => item.value > 0);

  // Data for financial overview bar chart
  const financialBarData = [
    { name: 'Saldo Total', value: stats.totalBalance, fill: '#3b82f6' },
    { name: 'Salários', value: stats.totalSalaryCredits, fill: '#10b981' },
    { name: 'Agendados', value: stats.totalScheduledPayments, fill: '#8b5cf6' },
    { name: 'Gastos Hoje', value: stats.totalTodayExpenses, fill: '#f59e0b' }
  ];

  // Mock data for area chart - Last 7 days activity (you can replace with real data)
  const weeklyActivityData = [
    { day: 'Seg', transacoes: 12, pagamentos: 5 },
    { day: 'Ter', transacoes: 19, pagamentos: 8 },
    { day: 'Qua', transacoes: 15, pagamentos: 3 },
    { day: 'Qui', transacoes: 22, pagamentos: 12 },
    { day: 'Sex', transacoes: 28, pagamentos: 7 },
    { day: 'Sáb', transacoes: 8, pagamentos: 2 },
    { day: 'Dom', transacoes: 5, pagamentos: 1 }
  ];

  // Payments by amount for pie chart
  const paymentsDistribution = stats.paymentsToday.length > 0 
    ? stats.paymentsToday.slice(0, 5).map((p, index) => ({
        name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
        value: Number(p.amount),
        color: CHART_COLORS[index % CHART_COLORS.length]
      }))
    : [{ name: 'Sem pagamentos', value: 1, color: '#475569' }];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">{stat.title}</p>
                    <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Users Distribution Pie Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-white">
                <PieChartIcon className="w-4 h-4 text-emerald-400" />
                Distribuição de Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={usersPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {usersPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
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

        {/* Financial Overview Bar Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2"
        >
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-white">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                Visão Financeira Geral
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financialBarData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      type="number" 
                      tickFormatter={formatCompactCurrency}
                      stroke="#94a3b8"
                      fontSize={11}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      stroke="#94a3b8"
                      fontSize={11}
                      width={80}
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
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Activity Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-white">
              <Activity className="w-4 h-4 text-purple-400" />
              Atividade da Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyActivityData}>
                  <defs>
                    <linearGradient id="colorTransacoes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorPagamentos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                  <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
                  <Area 
                    type="monotone" 
                    dataKey="transacoes" 
                    stroke="#8b5cf6" 
                    fillOpacity={1} 
                    fill="url(#colorTransacoes)"
                    name="Transações"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="pagamentos" 
                    stroke="#10b981" 
                    fillOpacity={1} 
                    fill="url(#colorPagamentos)"
                    name="Pagamentos"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Lists Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Salary Today */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                Salários Creditados Hoje
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.usersWithSalaryToday.length === 0 ? (
                <p className="text-slate-400 text-sm">Nenhum salário creditado hoje</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {stats.usersWithSalaryToday.map((user, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                    >
                      <span className="text-white">{user.full_name || 'Cliente'}</span>
                      <span className="text-emerald-400 font-semibold">
                        {formatCurrency(user.salary_amount || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Payments Today */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <CalendarCheck className="w-5 h-5 text-purple-400" />
                Pagamentos Agendados para Hoje
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.paymentsToday.length === 0 ? (
                <p className="text-slate-400 text-sm">Nenhum pagamento para hoje</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {stats.paymentsToday.map((payment, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                    >
                      <div>
                        <span className="text-white">{payment.name}</span>
                        <span className="text-xs text-slate-400 block">
                          Matrícula: {payment.user_matricula}
                        </span>
                      </div>
                      <span className="text-red-400 font-semibold">
                        {formatCurrency(Number(payment.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Alert for blocked users */}
      {stats.blockedUsers > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-400" />
                <div>
                  <p className="text-red-400 font-semibold">Atenção!</p>
                  <p className="text-slate-300 text-sm">
                    Existem {stats.blockedUsers} conta(s) bloqueada(s) que podem precisar de atenção.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
