import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  getAllUsers, 
  updateUser, 
  toggleUserBlock, 
  deleteUser, 
  addAdminLog,
  getUserTransactions,
  getUserScheduledPayments,
  getUserPaymentLogs,
  AdminUser 
} from "@/lib/adminDb";
import { 
  Search, 
  User, 
  Mail, 
  Phone, 
  Wallet,
  Edit,
  Ban,
  Unlock,
  Trash2,
  Eye,
  Loader2,
  X,
  DollarSign,
  CalendarDays,
  Receipt
} from "lucide-react";

export function AdminClients() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AdminUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [userDetails, setUserDetails] = useState<{
    transactions: Array<Record<string, unknown>>;
    scheduledPayments: Array<Record<string, unknown>>;
    paymentLogs: Array<Record<string, unknown>>;
  } | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    salary_amount: "",
    salary_day: "",
    advance_amount: "",
    advance_day: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [searchQuery, users]);

  const loadUsers = async () => {
    setIsLoading(true);
    const data = await getAllUsers();
    setUsers(data);
    setFilteredUsers(data);
    setIsLoading(false);
  };

  const filterUsers = () => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = users.filter(user => 
      (user.full_name?.toLowerCase().includes(query)) ||
      (user.email?.toLowerCase().includes(query)) ||
      (user.phone?.includes(query))
    );
    setFilteredUsers(filtered);
  };

  const handleEdit = (user: AdminUser) => {
    setSelectedUser(user);
    setEditForm({
      full_name: user.full_name || "",
      email: user.email || "",
      phone: user.phone || "",
      salary_amount: user.salary_amount?.toString() || "",
      salary_day: user.salary_day?.toString() || "",
      advance_amount: user.advance_amount?.toString() || "",
      advance_day: user.advance_day?.toString() || ""
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;

    const updates: Partial<AdminUser> = {
      full_name: editForm.full_name || null,
      email: editForm.email || null,
      phone: editForm.phone || null,
      salary_amount: editForm.salary_amount ? parseFloat(editForm.salary_amount) : null,
      salary_day: editForm.salary_day ? parseInt(editForm.salary_day) : null,
      advance_amount: editForm.advance_amount ? parseFloat(editForm.advance_amount) : null,
      advance_day: editForm.advance_day ? parseInt(editForm.advance_day) : null
    };

    const success = await updateUser(selectedUser.id, updates);
    if (success) {
      await addAdminLog('edit_user', selectedUser.id, { updates });
      toast({
        title: "Usuário atualizado",
        description: "Os dados do cliente foram atualizados com sucesso."
      });
      loadUsers();
      setShowEditModal(false);
    } else {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o usuário.",
        variant: "destructive"
      });
    }
  };

  const handleToggleBlock = async (user: AdminUser) => {
    const newBlockedState = !user.blocked;
    const success = await toggleUserBlock(user.id, newBlockedState);
    
    if (success) {
      await addAdminLog(newBlockedState ? 'block_user' : 'unblock_user', user.id);
      toast({
        title: newBlockedState ? "Conta bloqueada" : "Conta desbloqueada",
        description: `A conta de ${user.full_name || 'cliente'} foi ${newBlockedState ? 'bloqueada' : 'desbloqueada'}.`
      });
      loadUsers();
    } else {
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status da conta.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = (user: AdminUser) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!selectedUser) return;

    const success = await deleteUser(selectedUser.id);
    if (success) {
      await addAdminLog('delete_user', selectedUser.id, { 
        deleted_user: selectedUser.full_name,
        matricula: selectedUser.matricula 
      });
      toast({
        title: "Conta excluída",
        description: "A conta do cliente foi excluída permanentemente."
      });
      loadUsers();
    } else {
      toast({
        title: "Erro",
        description: "Não foi possível excluir a conta.",
        variant: "destructive"
      });
    }
    setShowDeleteDialog(false);
  };

  const handleViewDetails = async (user: AdminUser) => {
    setSelectedUser(user);
    const [transactions, scheduledPayments, paymentLogs] = await Promise.all([
      getUserTransactions(user.matricula),
      getUserScheduledPayments(user.matricula),
      getUserPaymentLogs(user.matricula)
    ]);
    setUserDetails({ transactions, scheduledPayments, paymentLogs });
    setShowDetailsModal(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const calculateUserBalance = (user: AdminUser, transactions: Array<Record<string, unknown>>) => {
    const initialBalance = user.initial_balance || 0;
    const transactionBalance = transactions.reduce((acc, t) => {
      const amount = Number(t.amount);
      return t.type === 'income' ? acc + amount : acc - amount;
    }, 0);
    return initialBalance + transactionBalance;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nome, e-mail ou telefone..."
          className="pl-10 bg-slate-800/50 border-slate-700 text-white"
        />
      </div>

      {/* Users List */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredUsers.map((user, index) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className={`bg-slate-800/50 border-slate-700 ${user.blocked ? 'border-red-500/50' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* User Info */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-white truncate">{user.full_name || 'Sem nome'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-300 text-sm truncate">{user.email || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-300 text-sm">{user.phone || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-slate-400" />
                        <span className="text-emerald-400 font-semibold">
                          {formatCurrency(user.initial_balance || 0)}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      user.blocked 
                        ? 'bg-red-500/20 text-red-400' 
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {user.blocked ? 'Bloqueado' : 'Ativo'}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewDetails(user)}
                        className="text-slate-400 hover:text-white"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(user)}
                        className="text-slate-400 hover:text-blue-400"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleBlock(user)}
                        className={user.blocked ? "text-emerald-400 hover:text-emerald-300" : "text-orange-400 hover:text-orange-300"}
                      >
                        {user.blocked ? <Unlock className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(user)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            Nenhum cliente encontrado.
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription className="text-slate-400">
              Altere os dados do cliente abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-300">Nome completo</label>
              <Input
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                className="bg-slate-700 border-slate-600"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300">E-mail</label>
              <Input
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="bg-slate-700 border-slate-600"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300">Telefone</label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="bg-slate-700 border-slate-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-300">Salário (R$)</label>
                <Input
                  type="number"
                  value={editForm.salary_amount}
                  onChange={(e) => setEditForm({ ...editForm, salary_amount: e.target.value })}
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300">Dia do salário</label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={editForm.salary_day}
                  onChange={(e) => setEditForm({ ...editForm, salary_day: e.target.value })}
                  className="bg-slate-700 border-slate-600"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-300">Adiantamento (R$)</label>
                <Input
                  type="number"
                  value={editForm.advance_amount}
                  onChange={(e) => setEditForm({ ...editForm, advance_amount: e.target.value })}
                  className="bg-slate-700 border-slate-600"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300">Dia do adiantamento</label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={editForm.advance_day}
                  onChange={(e) => setEditForm({ ...editForm, advance_day: e.target.value })}
                  className="bg-slate-700 border-slate-600"
                />
              </div>
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

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {selectedUser?.full_name || 'Cliente'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedUser && userDetails && (
            <div className="space-y-6">
              {/* User Info Card */}
              <Card className="bg-slate-700/50 border-slate-600">
                <CardContent className="p-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400">Matrícula</p>
                    <p className="text-white font-medium">{selectedUser.matricula}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">E-mail</p>
                    <p className="text-white">{selectedUser.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Telefone</p>
                    <p className="text-white">{selectedUser.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Saldo Atual</p>
                    <p className="text-emerald-400 font-semibold">
                      {formatCurrency(calculateUserBalance(selectedUser, userDetails.transactions))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Salário</p>
                    <p className="text-white">
                      {selectedUser.salary_amount 
                        ? `${formatCurrency(selectedUser.salary_amount)} (dia ${selectedUser.salary_day})`
                        : '-'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Adiantamento</p>
                    <p className="text-white">
                      {selectedUser.advance_amount 
                        ? `${formatCurrency(selectedUser.advance_amount)} (dia ${selectedUser.advance_day})`
                        : '-'
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Transactions */}
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                  <Receipt className="w-4 h-4" />
                  Histórico de Transações ({userDetails.transactions.length})
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {userDetails.transactions.slice(0, 10).map((t, i) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-slate-700/50 rounded">
                      <div>
                        <p className="text-sm text-white">{t.description as string || 'Transação'}</p>
                        <p className="text-xs text-slate-400">{t.date as string}</p>
                      </div>
                      <span className={`font-medium ${t.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(Number(t.amount))}
                      </span>
                    </div>
                  ))}
                  {userDetails.transactions.length === 0 && (
                    <p className="text-slate-400 text-sm">Nenhuma transação registrada.</p>
                  )}
                </div>
              </div>

              {/* Scheduled Payments */}
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" />
                  Pagamentos Agendados ({userDetails.scheduledPayments.length})
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {userDetails.scheduledPayments.map((p, i) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-slate-700/50 rounded">
                      <div>
                        <p className="text-sm text-white">{p.name as string}</p>
                        <p className="text-xs text-slate-400">Dia {p.due_day as number}</p>
                      </div>
                      <span className="font-medium text-orange-400">
                        {formatCurrency(Number(p.amount))}
                      </span>
                    </div>
                  ))}
                  {userDetails.scheduledPayments.length === 0 && (
                    <p className="text-slate-400 text-sm">Nenhum pagamento agendado.</p>
                  )}
                </div>
              </div>

              {/* Payment Logs */}
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Histórico de Pagamentos ({userDetails.paymentLogs.length})
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {userDetails.paymentLogs.slice(0, 10).map((p, i) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-slate-700/50 rounded">
                      <div>
                        <p className="text-sm text-white">{p.name as string}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(p.paid_at as string).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <span className="font-medium text-emerald-400">
                        {formatCurrency(Number(p.amount))}
                      </span>
                    </div>
                  ))}
                  {userDetails.paymentLogs.length === 0 && (
                    <p className="text-slate-400 text-sm">Nenhum pagamento registrado.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Tem certeza que deseja excluir a conta de <span className="text-white font-medium">{selectedUser?.full_name || 'este cliente'}</span>?
              Esta ação é permanente e não pode ser desfeita.
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
    </div>
  );
}
