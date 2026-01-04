import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import { getAdminLogs, AdminLog } from "@/lib/adminDb";
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
  DollarSign
} from "lucide-react";

export function AdminSettings() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showLogoutAllDialog, setShowLogoutAllDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setIsLoading(true);
    const data = await getAdminLogs(50);
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

  const handleLogoutAllSessions = async () => {
    try {
      await supabase.auth.signOut({ scope: 'global' });
      toast({
        title: "Sessões encerradas",
        description: "Todas as sessões ativas foram encerradas."
      });
      // Redirect to login
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Permissions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-slate-800/50 border-slate-700 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <Shield className="w-5 h-5 text-purple-400" />
                Gerenciamento de Permissões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm mb-4">
                Atualmente, apenas 1 administrador tem acesso ao painel. 
                Para adicionar mais administradores, é necessário adicionar a role "admin" 
                na tabela user_roles do Supabase.
              </p>
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <p className="text-xs text-slate-400 mb-2">Status atual:</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-white text-sm">Sistema em modo administrador único</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Salary Automation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-slate-800/50 border-slate-700 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <Zap className="w-5 h-5 text-yellow-400" />
                Automação de Salário
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm mb-4">
                O sistema credita automaticamente o salário e adiantamento dos clientes 
                nos dias configurados em seus perfis.
              </p>
              <div className="space-y-3">
                <div className="p-3 bg-slate-700/50 rounded-lg flex items-center justify-between">
                  <span className="text-white text-sm">Crédito de Salário</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                    <span className="text-emerald-400 text-sm">Ativo</span>
                  </div>
                </div>
                <div className="p-3 bg-slate-700/50 rounded-lg flex items-center justify-between">
                  <span className="text-white text-sm">Crédito de Adiantamento</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                    <span className="text-emerald-400 text-sm">Ativo</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Security */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <Lock className="w-5 h-5 text-red-400" />
              Segurança
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-white text-sm mb-1">Encerrar todas as sessões</p>
                <p className="text-slate-400 text-xs">
                  Isso fará logout de todas as sessões ativas do administrador.
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowLogoutAllDialog(true)}
                className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Encerrar Sessões
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Admin Logs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <ScrollText className="w-5 h-5 text-blue-400" />
              Logs de Atividade
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">
                Nenhuma atividade registrada ainda.
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {logs.map((log) => (
                  <div 
                    key={log.id} 
                    className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg"
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
