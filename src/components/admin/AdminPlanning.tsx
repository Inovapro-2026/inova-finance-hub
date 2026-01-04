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
  Loader2
} from "lucide-react";

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

export function AdminPlanning() {
  const [payments, setPayments] = useState<ScheduledPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<ScheduledPayment | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMarkPaidDialog, setShowMarkPaidDialog] = useState(false);
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

  const loadPayments = async () => {
    setIsLoading(true);
    const data = await getAllScheduledPayments();
    setPayments(data as ScheduledPayment[]);
    setIsLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const recurringPayments = payments.filter(p => p.is_recurring);
  const oneTimePayments = payments.filter(p => !p.is_recurring);

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
      // For one-time payments, just deactivate
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
      // For recurring, just update last_paid_at to skip this month
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
      {/* Recurring Payments */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-white">
            <Repeat className="w-5 h-5 text-purple-400" />
            Pagamentos Recorrentes ({recurringPayments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
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
          <div className="space-y-3">
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
