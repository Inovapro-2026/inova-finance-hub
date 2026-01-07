import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  getAllScheduledPayments, 
  updateScheduledPayment, 
  deleteScheduledPaymentAdmin,
  markPaymentAsPaid,
  addAdminLog
} from "@/lib/adminDb";
import { 
  CalendarDays, 
  Repeat, 
  CalendarCheck2,
  Edit,
  Trash2,
  CheckCircle,
  SkipForward,
  Loader2,
  Search,
  Filter,
  Download,
  AlertCircle,
  Clock,
  DollarSign
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

interface ScheduledPayment {
  id: string;
  user_matricula: number;
  name: string;
  amount: number;
  due_day: number;
  is_recurring: boolean;
  category: string | null;
  last_paid_at: string | null;
}

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function AdminPlanning() {
  const [payments, setPayments] = useState<ScheduledPayment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<ScheduledPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<ScheduledPayment | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMarkPaidDialog, setShowMarkPaidDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'recurring' | 'one-time'>('all');
  const [editForm, setEditForm] = useState({
    name: "",
    amount: "",
    due_day: "",
    is_recurring: true
  });
  const { toast } = useToast();

  useEffect(() => {
    loadPayments();
  }, []);

  useEffect(() => {
    filterPayments();
  }, [searchQuery, payments, filterType]);

  const loadPayments = async () => {
    setIsLoading(true);
    const data = await getAllScheduledPayments();
    setPayments(data as ScheduledPayment[]);
    setFilteredPayments(data as ScheduledPayment[]);
    setIsLoading(false);
  };

  const filterPayments = () => {
    let filtered = [...payments];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.user_matricula.toString().includes(query)
      );
    }

    if (filterType === 'recurring') {
      filtered = filtered.filter(p => p.is_recurring);
    } else if (filterType === 'one-time') {
      filtered = filtered.filter(p => !p.is_recurring);
    }

    setFilteredPayments(filtered);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const recurringPayments = filteredPayments.filter(p => p.is_recurring);
  const oneTimePayments = filteredPayments.filter(p => !p.is_recurring);

  const totalRecurring = recurringPayments.reduce((acc, p) => acc + Number(p.amount), 0);
  const totalOneTime = oneTimePayments.reduce((acc, p) => acc + Number(p.amount), 0);
  const totalPayments = totalRecurring + totalOneTime;

  // Data for charts
  const paymentsByDay = Array.from({ length: 31 }, (_, i) => ({
    day: i + 1,
    valor: payments.filter(p => p.due_day === i + 1).reduce((acc, p) => acc + Number(p.amount), 0)
  })).filter(d => d.valor > 0);

  const typeDistribution = [
    { name: 'Recorrentes', value: totalRecurring, color: '#8b5cf6' },
    { name: 'Únicos', value: totalOneTime, color: '#3b82f6' }
  ].filter(d => d.value > 0);

  // Upcoming payments (next 7 days)
  const today = new Date().getDate();
  const upcomingPayments = payments.filter(p => {
    const diff = p.due_day - today;
    return diff >= 0 && diff <= 7;
  }).sort((a, b) => a.due_day - b.due_day);

  // Overdue payments
  const overduePayments = payments.filter(p => {
    if (!p.last_paid_at) return p.due_day < today;
    const lastPaid = new Date(p.last_paid_at);
    const currentMonth = new Date().getMonth();
    return lastPaid.getMonth() !== currentMonth && p.due_day < today;
  });

  const handleEdit = (payment: ScheduledPayment) => {
    setSelectedPayment(payment);
    setEditForm({
      name: payment.name,
      amount: payment.amount.toString(),
      due_day: payment.due_day.toString(),
      is_recurring: payment.is_recurring
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedPayment) return;

    const updates = {
      name: editForm.name,
      amount: parseFloat(editForm.amount),
      due_day: parseInt(editForm.due_day),
      is_recurring: editForm.is_recurring
    };

    const success = await updateScheduledPayment(selectedPayment.id, updates);
    if (success) {
      await addAdminLog('edit_payment', undefined, { 
        payment_id: selectedPayment.id,
        updates 
      });
      toast({
        title: "Pagamento atualizado",
        description: "O pagamento foi atualizado com sucesso."
      });
      loadPayments();
      setShowEditModal(false);
    } else {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o pagamento.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = (payment: ScheduledPayment) => {
    setSelectedPayment(payment);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!selectedPayment) return;

    const success = await deleteScheduledPaymentAdmin(selectedPayment.id);
    if (success) {
      await addAdminLog('delete_payment', undefined, { 
        payment_id: selectedPayment.id,
        payment_name: selectedPayment.name 
      });
      toast({
        title: "Pagamento excluído",
        description: "O pagamento foi excluído com sucesso."
      });
      loadPayments();
    } else {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o pagamento.",
        variant: "destructive"
      });
    }
    setShowDeleteDialog(false);
  };

  const handleMarkPaid = (payment: ScheduledPayment) => {
    setSelectedPayment(payment);
    setShowMarkPaidDialog(true);
  };

  const confirmMarkPaid = async () => {
    if (!selectedPayment) return;

    const success = await markPaymentAsPaid({
      id: selectedPayment.id,
      user_matricula: selectedPayment.user_matricula,
      name: selectedPayment.name,
      amount: selectedPayment.amount
    });

    if (success) {
      await addAdminLog('mark_payment_paid', undefined, { 
        payment_id: selectedPayment.id,
        payment_name: selectedPayment.name,
        amount: selectedPayment.amount
      });
      toast({
        title: "Pagamento marcado como pago",
        description: `${selectedPayment.name} foi registrado como pago.`
      });
      loadPayments();
    } else {
      toast({
        title: "Erro",
        description: "Não foi possível marcar o pagamento como pago.",
        variant: "destructive"
      });
    }
    setShowMarkPaidDialog(false);
  };

  const handleSkipPayment = async (payment: ScheduledPayment) => {
    if (!payment.is_recurring) {
      const success = await deleteScheduledPaymentAdmin(payment.id);
      if (success) {
        await addAdminLog('skip_payment', undefined, { 
          payment_id: payment.id,
          payment_name: payment.name 
        });
        toast({
          title: "Pagamento pulado",
          description: `${payment.name} foi marcado como pulado.`
        });
        loadPayments();
      }
    } else {
      await updateScheduledPayment(payment.id, { 
        last_paid_at: new Date().toISOString() 
      });
      await addAdminLog('skip_payment', undefined, { 
        payment_id: payment.id,
        payment_name: payment.name 
      });
      toast({
        title: "Pagamento pulado",
        description: `${payment.name} será pulado este mês.`
      });
      loadPayments();
    }
  };

  const exportPayments = () => {
    const headers = ['Nome', 'Valor', 'Dia Vencimento', 'Matrícula', 'Tipo', 'Último Pagamento'];
    const rows = payments.map(p => [
      p.name,
      p.amount,
      p.due_day,
      p.user_matricula,
      p.is_recurring ? 'Recorrente' : 'Único',
      p.last_paid_at ? new Date(p.last_paid_at).toLocaleDateString('pt-BR') : 'Nunca'
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pagamentos_agendados_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Exportado!",
      description: "Lista de pagamentos exportada com sucesso."
    });
  };

  const PaymentCard = ({ payment }: { payment: ScheduledPayment }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Card className="bg-slate-700/50 border-slate-600">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-white font-medium">{payment.name}</h4>
                {payment.is_recurring && (
                  <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                    Recorrente
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <span>Dia {payment.due_day}</span>
                <span>Matrícula: {payment.user_matricula}</span>
                {payment.category && <span>{payment.category}</span>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-orange-400">
                {formatCurrency(Number(payment.amount))}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleMarkPaid(payment)}
                className="text-emerald-400 hover:text-emerald-300"
                title="Marcar como pago"
              >
                <CheckCircle className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleSkipPayment(payment)}
                className="text-yellow-400 hover:text-yellow-300"
                title="Pular"
              >
                <SkipForward className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleEdit(payment)}
                className="text-slate-400 hover:text-blue-400"
                title="Editar"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDelete(payment)}
                className="text-red-400 hover:text-red-300"
                title="Excluir"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Repeat className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Recorrentes</p>
                <p className="text-xl font-bold text-purple-400">{recurringPayments.length}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <CalendarCheck2 className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Únicos</p>
                <p className="text-xl font-bold text-blue-400">{oneTimePayments.length}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Mensal</p>
                <p className="text-lg font-bold text-orange-400">{formatCurrency(totalPayments)}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className={`border ${overduePayments.length > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${overduePayments.length > 0 ? 'bg-red-500/20' : 'bg-emerald-500/20'} flex items-center justify-center`}>
                <AlertCircle className={`w-6 h-6 ${overduePayments.length > 0 ? 'text-red-400' : 'text-emerald-400'}`} />
              </div>
              <div>
                <p className="text-xs text-slate-400">Atrasados</p>
                <p className={`text-xl font-bold ${overduePayments.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{overduePayments.length}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payments by Day */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-white">
                <CalendarDays className="w-4 h-4 text-purple-400" />
                Pagamentos por Dia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={paymentsByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} />
                    <YAxis 
                      tickFormatter={(value) => `R$${(value/1000).toFixed(0)}K`}
                      stroke="#94a3b8" 
                      fontSize={10}
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
                    <Bar dataKey="valor" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Type Distribution */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-white">
                <Repeat className="w-4 h-4 text-blue-400" />
                Distribuição por Tipo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {typeDistribution.map((entry, index) => (
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
                    <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Upcoming Payments Alert */}
      {upcomingPayments.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="bg-orange-500/10 border-orange-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-orange-400">
                <Clock className="w-4 h-4" />
                Próximos 7 Dias ({upcomingPayments.length} pagamentos)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {upcomingPayments.slice(0, 5).map((p, i) => (
                  <span key={i} className="px-3 py-1.5 bg-orange-500/20 text-orange-300 rounded-lg text-sm">
                    {p.name} - Dia {p.due_day} ({formatCurrency(Number(p.amount))})
                  </span>
                ))}
                {upcomingPayments.length > 5 && (
                  <span className="px-3 py-1.5 bg-orange-500/20 text-orange-300 rounded-lg text-sm">
                    +{upcomingPayments.length - 5} mais
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou matrícula..."
            className="pl-10 bg-slate-800/50 border-slate-700 text-white"
          />
        </div>

        <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
          <SelectTrigger className="w-40 bg-slate-800/50 border-slate-700 text-white">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filtrar" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="recurring">Recorrentes</SelectItem>
            <SelectItem value="one-time">Únicos</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          onClick={exportPayments}
          className="bg-slate-800/50 border-slate-700 text-white hover:bg-slate-700"
        >
          <Download className="w-4 h-4 mr-2" />
          Exportar
        </Button>
      </div>

      {/* Recurring Payments */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-white">
            <Repeat className="w-5 h-5 text-purple-400" />
            Pagamentos Recorrentes ({recurringPayments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            <AnimatePresence>
              {recurringPayments.length === 0 ? (
                <p className="text-slate-400 text-sm">Nenhum pagamento recorrente cadastrado.</p>
              ) : (
                recurringPayments.map(payment => (
                  <PaymentCard key={payment.id} payment={payment} />
                ))
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* One-time Payments */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-white">
            <CalendarCheck2 className="w-5 h-5 text-blue-400" />
            Pagamentos Únicos do Mês ({oneTimePayments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            <AnimatePresence>
              {oneTimePayments.length === 0 ? (
                <p className="text-slate-400 text-sm">Nenhum pagamento único cadastrado.</p>
              ) : (
                oneTimePayments.map(payment => (
                  <PaymentCard key={payment.id} payment={payment} />
                ))
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Pagamento</DialogTitle>
            <DialogDescription className="text-slate-400">
              Altere os dados do pagamento abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-300">Nome</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="bg-slate-700 border-slate-600"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300">Valor (R$)</label>
              <Input
                type="number"
                step="0.01"
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                className="bg-slate-700 border-slate-600"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300">Dia do vencimento</label>
              <Input
                type="number"
                min="1"
                max="31"
                value={editForm.due_day}
                onChange={(e) => setEditForm({ ...editForm, due_day: e.target.value })}
                className="bg-slate-700 border-slate-600"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-slate-300">Pagamento recorrente</label>
              <Switch
                checked={editForm.is_recurring}
                onCheckedChange={(checked) => setEditForm({ ...editForm, is_recurring: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEditModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Tem certeza que deseja excluir o pagamento <span className="text-white font-medium">{selectedPayment?.name}</span>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-700 text-white border-slate-600">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mark as Paid Confirmation Dialog */}
      <AlertDialog open={showMarkPaidDialog} onOpenChange={setShowMarkPaidDialog}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirmar pagamento</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Confirmar que o pagamento <span className="text-white font-medium">{selectedPayment?.name}</span> de{" "}
              <span className="text-emerald-400 font-medium">
                {selectedPayment && formatCurrency(Number(selectedPayment.amount))}
              </span>{" "}
              foi realizado?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-700 text-white border-slate-600">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmMarkPaid}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              Confirmar Pagamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
