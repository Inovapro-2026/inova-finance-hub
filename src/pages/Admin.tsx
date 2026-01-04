import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/adminDb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  LogOut, 
  LayoutDashboard, 
  Users, 
  DollarSign, 
  CalendarDays, 
  Settings,
  Eye,
  EyeOff,
  Loader2
} from "lucide-react";

// Import admin tabs
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminClients } from "@/components/admin/AdminClients";
import { AdminFinancial } from "@/components/admin/AdminFinancial";
import { AdminPlanning } from "@/components/admin/AdminPlanning";
import { AdminSettings } from "@/components/admin/AdminSettings";

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      const isAdmin = await checkIsAdmin();
      if (isAdmin) {
        setIsAuthenticated(true);
      } else {
        // User is logged in but not admin
        await supabase.auth.signOut();
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para acessar o painel administrativo.",
          variant: "destructive"
        });
      }
    }
    setIsLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        toast({
          title: "Erro no login",
          description: error.message,
          variant: "destructive"
        });
        setIsLoggingIn(false);
        return;
      }

      if (data.session) {
        const isAdmin = await checkIsAdmin();
        if (isAdmin) {
          setIsAuthenticated(true);
          toast({
            title: "Bem-vindo!",
            description: "Acesso administrativo concedido."
          });
        } else {
          await supabase.auth.signOut();
          toast({
            title: "Acesso negado",
            description: "Você não tem permissão de administrador.",
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao tentar fazer login.",
        variant: "destructive"
      });
    }

    setIsLoggingIn(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setEmail("");
    setPassword("");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="w-12 h-12 text-primary" />
        </motion.div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-xl">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold text-white">
                INOVABANK Admin
              </CardTitle>
              <p className="text-slate-400 text-sm mt-2">
                Acesso restrito ao administrador
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-slate-300">E-mail</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@inovabank.com"
                    className="bg-slate-700/50 border-slate-600 text-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-300">Senha</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-slate-700/50 border-slate-600 text-white pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    "Entrar"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 border-b border-slate-700 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">INOVABANK</h1>
              <p className="text-xs text-slate-400">Painel Administrativo</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-800/50 border border-slate-700 p-1 flex flex-wrap gap-1">
            <TabsTrigger 
              value="dashboard" 
              className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger 
              value="clients" 
              className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Clientes</span>
            </TabsTrigger>
            <TabsTrigger 
              value="financial" 
              className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">Financeiro</span>
            </TabsTrigger>
            <TabsTrigger 
              value="planning" 
              className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2"
            >
              <CalendarDays className="w-4 h-4" />
              <span className="hidden sm:inline">Planejamento</span>
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Configurações</span>
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <TabsContent value="dashboard" className="mt-0">
                <AdminDashboard />
              </TabsContent>
              <TabsContent value="clients" className="mt-0">
                <AdminClients />
              </TabsContent>
              <TabsContent value="financial" className="mt-0">
                <AdminFinancial />
              </TabsContent>
              <TabsContent value="planning" className="mt-0">
                <AdminPlanning />
              </TabsContent>
              <TabsContent value="settings" className="mt-0">
                <AdminSettings />
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </main>
    </div>
  );
}
