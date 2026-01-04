import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Loader2
} from "lucide-react";

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

export function AdminFinancial() {
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <div className="space-y-6">
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

      {/* Lists Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Salary Credits */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
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
          transition={{ delay: 0.6 }}
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
          transition={{ delay: 0.7 }}
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
