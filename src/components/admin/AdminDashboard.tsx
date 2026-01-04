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
  Loader2
} from "lucide-react";

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

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Salary Today */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
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
                <div className="space-y-2">
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
          transition={{ delay: 0.5 }}
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
                <div className="space-y-2">
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

      {/* Alert for overdue */}
      {stats.blockedUsers > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
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
