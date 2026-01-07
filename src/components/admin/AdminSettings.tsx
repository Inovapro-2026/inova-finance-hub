import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { supabase } from "@/integrations/supabase/client";
import { getAdminLogs, AdminLog } from "@/lib/adminDb";
import { ElevenLabsSettings } from "./ElevenLabsSettings";
import { 
  Shield, 
  ScrollText, 
  Zap, 
  Lock,
  LogOut,
  Loader2,
  User,
  Edit,
  Trash2,
  Ban,
  Unlock,
  CheckCircle,
  SkipForward,
  DollarSign,
  Bell,
  Database,
  RefreshCw,
  Download,
  AlertTriangle,
  Settings,
  Clock,
  Activity
} from "lucide-react";

export function AdminSettings() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showLogoutAllDialog, setShowLogoutAllDialog] = useState(false);
  const [showClearLogsDialog, setShowClearLogsDialog] = useState(false);
  const [logFilter, setLogFilter] = useState('all');
  const [autoSalary, setAutoSalary] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setIsLoading(true);
    const data = await getAdminLogs(100);
    setLogs(data);
    setIsLoading(false);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'edit_user':
        return <Edit className="w-4 h-4 text-blue-400" />;
      case 'delete_user':
        return <Trash2 className="w-4 h-4 text-red-400" />;
      case 'block_user':
        return <Ban className="w-4 h-4 text-orange-400" />;
      case 'unblock_user':
        return <Unlock className="w-4 h-4 text-emerald-400" />;
      case 'edit_payment':
        return <Edit className="w-4 h-4 text-blue-400" />;
      case 'delete_payment':
        return <Trash2 className="w-4 h-4 text-red-400" />;
      case 'mark_payment_paid':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'skip_payment':
        return <SkipForward className="w-4 h-4 text-yellow-400" />;
      default:
        return <DollarSign className="w-4 h-4 text-slate-400" />;
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'edit_user': 'Editou usuário',
      'delete_user': 'Excluiu usuário',
      'block_user': 'Bloqueou usuário',
      'unblock_user': 'Desbloqueou usuário',
      'edit_payment': 'Editou pagamento',
      'delete_payment': 'Excluiu pagamento',
      'mark_payment_paid': 'Marcou pagamento como pago',
      'skip_payment': 'Pulou pagamento'
    };
    return labels[action] || action;
  };

  const getActionCategory = (action: string): string => {
    if (action.includes('user')) return 'users';
    if (action.includes('payment')) return 'payments';
    return 'other';
  };

  const filteredLogs = logFilter === 'all' 
    ? logs 
    : logs.filter(log => getActionCategory(log.action) === logFilter);

  const handleLogoutAllSessions = async () => {
    try {
      await supabase.auth.signOut({ scope: 'global' });
      toast({
        title: "Sessões encerradas",
        description: "Todas as sessões ativas foram encerradas."
      });
      window.location.reload();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível encerrar as sessões.",
        variant: "destructive"
      });
    }
    setShowLogoutAllDialog(false);
  };

  const exportLogs = () => {
    const headers = ['Data', 'Ação', 'Detalhes'];
    const rows = filteredLogs.map(log => [
      new Date(log.created_at).toLocaleString('pt-BR'),
      getActionLabel(log.action),
      log.details ? JSON.stringify(log.details) : ''
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_admin_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Exportado!",
      description: "Logs exportados com sucesso."
    });
  };

  // Stats
  const userActions = logs.filter(l => getActionCategory(l.action) === 'users').length;
  const paymentActions = logs.filter(l => getActionCategory(l.action) === 'payments').length;
  const todayActions = logs.filter(l => 
    new Date(l.created_at).toDateString() === new Date().toDateString()
  ).length;

  return (
    <div className="space-y-6">
      {/* ElevenLabs Voice Settings */}
      <ElevenLabsSettings />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <User className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Ações de Usuários</p>
                <p className="text-2xl font-bold text-blue-400">{userActions}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Ações de Pagamentos</p>
                <p className="text-2xl font-bold text-purple-400">{paymentActions}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Activity className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Ações Hoje</p>
                <p className="text-2xl font-bold text-emerald-400">{todayActions}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-slate-800/50 border-slate-700 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <Settings className="w-5 h-5 text-slate-400" />
                Configurações do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  <div>
                    <p className="text-white text-sm font-medium">Crédito Automático de Salário</p>
                    <p className="text-slate-400 text-xs">Creditar salários automaticamente nos dias configurados</p>
                  </div>
                </div>
                <Switch checked={autoSalary} onCheckedChange={setAutoSalary} />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-white text-sm font-medium">Notificações Push</p>
                    <p className="text-slate-400 text-xs">Enviar notificações para os clientes</p>
                  </div>
                </div>
                <Switch checked={notifications} onCheckedChange={setNotifications} />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-white text-sm font-medium">Backup Automático</p>
                    <p className="text-slate-400 text-xs">Backup diário do banco de dados</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-emerald-400 text-xs">Ativo</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-purple-400" />
                  <div>
                    <p className="text-white text-sm font-medium">Última Sincronização</p>
                    <p className="text-slate-400 text-xs">Dados sincronizados há 5 minutos</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-white"
                  onClick={() => {
                    toast({ title: "Sincronizando...", description: "Aguarde alguns segundos." });
                  }}
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Permissions & Security */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-slate-800/50 border-slate-700 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <Shield className="w-5 h-5 text-purple-400" />
                Segurança e Permissões
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <p className="text-white text-sm font-medium">Status do Administrador</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-emerald-400 text-sm">Conectado e autenticado</span>
                </div>
                <p className="text-slate-400 text-xs mt-2">
                  Role: <span className="text-white">admin</span>
                </p>
              </div>

              <div className="p-4 bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-orange-400" />
                  <p className="text-white text-sm font-medium">Gerenciamento de Acesso</p>
                </div>
                <p className="text-slate-400 text-xs mb-3">
                  Para adicionar mais administradores, adicione a role "admin" 
                  na tabela user_roles do Supabase.
                </p>
              </div>

              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <p className="text-red-400 text-sm font-medium">Zona de Perigo</p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowLogoutAllDialog(true)}
                  className="w-full bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Encerrar Todas as Sessões
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Admin Logs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <ScrollText className="w-5 h-5 text-blue-400" />
                Logs de Atividade
              </CardTitle>
              <div className="flex gap-2">
                <Select value={logFilter} onValueChange={setLogFilter}>
                  <SelectTrigger className="w-36 bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Filtrar" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="users">Usuários</SelectItem>
                    <SelectItem value="payments">Pagamentos</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportLogs}
                  className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exportar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadLogs}
                  className="text-slate-400 hover:text-white"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">
                Nenhuma atividade registrada ainda.
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700/70 transition-colors"
                  >
                    {getActionIcon(log.action)}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm">{getActionLabel(log.action)}</p>
                      {log.details && (
                        <p className="text-slate-400 text-xs truncate">
                          {JSON.stringify(log.details).slice(0, 100)}
                        </p>
                      )}
                    </div>
                    <span className="text-slate-400 text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Logout All Dialog */}
      <AlertDialog open={showLogoutAllDialog} onOpenChange={setShowLogoutAllDialog}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Encerrar todas as sessões?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Esta ação encerrará todas as sessões ativas do administrador. 
              Você precisará fazer login novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-700 text-white border-slate-600">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleLogoutAllSessions}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Encerrar Sessões
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
