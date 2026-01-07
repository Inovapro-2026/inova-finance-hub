import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Mic, 
  Key, 
  CheckCircle, 
  XCircle, 
  Loader2,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { toast as sonnerToast } from "sonner";

interface UsageData {
  used: number;
  limit: number;
  remaining: number;
}

export function ElevenLabsSettings() {
  const [apiKey, setApiKey] = useState("");
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [monthlyUsage, setMonthlyUsage] = useState(0);
  const { toast } = useToast();

  const TOKEN_LIMIT = 10000;
  const WARNING_THRESHOLD = 9000;

  useEffect(() => {
    loadSettings();
    loadMonthlyUsage();
  }, []);

  // Show warning toast when entering if usage > 9000
  useEffect(() => {
    if (monthlyUsage >= WARNING_THRESHOLD) {
      sonnerToast.warning(
        "⚠️ Atenção: Você já usou " + monthlyUsage.toLocaleString('pt-BR') + " tokens do plano gratuito do Eleven Labs. Atualize a API Key antes que os créditos acabem!",
        { duration: 10000 }
      );
    }
  }, [monthlyUsage]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .eq("key", "eleven_api_key")
        .maybeSingle();

      if (data?.value) {
        setSavedKey(data.value);
        // Mask the key for display
        setApiKey("••••••••" + data.value.slice(-8));
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const loadMonthlyUsage = async () => {
    const monthYear = new Date().toISOString().slice(0, 7); // YYYY-MM
    try {
      const { data, error } = await supabase
        .from("elevenlabs_usage")
        .select("tokens_used")
        .eq("month_year", monthYear)
        .maybeSingle();

      if (data) {
        setMonthlyUsage(data.tokens_used);
      }
    } catch (error) {
      console.error("Error loading usage:", error);
    }
  };

  const handleSaveAndTest = async () => {
    if (!apiKey || apiKey.startsWith("••••")) {
      toast({
        title: "Erro",
        description: "Digite uma nova API Key",
        variant: "destructive"
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      // Test the key first
      const { data, error } = await supabase.functions.invoke("test-elevenlabs-key", {
        body: { apiKey }
      });

      if (error) throw error;

      if (data?.success) {
        // Save the key to database
        const { error: upsertError } = await supabase
          .from("system_settings")
          .upsert({
            key: "eleven_api_key",
            value: apiKey,
            updated_at: new Date().toISOString()
          }, { onConflict: "key" });

        if (upsertError) throw upsertError;

        setTestResult({ success: true, message: "Teste de voz OK – API Key válida!" });
        setSavedKey(apiKey);
        setUsage(data.usage);
        
        toast({
          title: "Sucesso!",
          description: "API Key salva e validada com sucesso."
        });
      } else {
        setTestResult({ 
          success: false, 
          message: data?.error || "Erro no teste – API Key inválida ou sem créditos." 
        });
      }
    } catch (error: any) {
      console.error("Error:", error);
      setTestResult({ 
        success: false, 
        message: "Erro no teste – " + (error.message || "Falha na comunicação") 
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleRefreshUsage = async () => {
    if (!savedKey) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-elevenlabs-key", {
        body: { apiKey: savedKey }
      });

      if (data?.success && data.usage) {
        setUsage(data.usage);
        
        // Update monthly usage in database
        const monthYear = new Date().toISOString().slice(0, 7);
        await supabase
          .from("elevenlabs_usage")
          .upsert({
            month_year: monthYear,
            tokens_used: data.usage.used,
            updated_at: new Date().toISOString()
          }, { onConflict: "month_year" });

        setMonthlyUsage(data.usage.used);
        toast({ title: "Atualizado!", description: "Uso de tokens atualizado." });
      }
    } catch (error) {
      console.error("Error refreshing usage:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const usagePercent = usage ? (usage.used / usage.limit) * 100 : (monthlyUsage / TOKEN_LIMIT) * 100;
  const isHighUsage = (usage?.used || monthlyUsage) >= WARNING_THRESHOLD;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Warning Banner */}
      {isHighUsage && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 flex items-start gap-3"
        >
          <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-semibold">
              ⚠️ Aviso: Você já usou {(usage?.used || monthlyUsage).toLocaleString('pt-BR')} tokens do plano gratuito do Eleven Labs.
            </p>
            <p className="text-red-300 text-sm mt-1">
              Atualize a API Key antes que os créditos acabem!
            </p>
          </div>
        </motion.div>
      )}

      {/* Main Settings Card */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-white">
            <Mic className="w-5 h-5 text-purple-400" />
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Gerenciar API Key – Eleven Labs TTS/STT
            </span>
          </CardTitle>
          <p className="text-slate-400 text-sm">
            Configure a chave de API do Eleven Labs para a ISA Suporte
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* API Key Input */}
          <div className="space-y-3">
            <label className="text-sm text-slate-300 flex items-center gap-2">
              <Key className="w-4 h-4" />
              Nova API Key
            </label>
            <div className="flex gap-3">
              <Input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk_xxxxxxxxxxxxxxxxxxxxxxxx"
                className="bg-slate-700/50 border-slate-600 text-white font-mono"
              />
              <Button
                onClick={handleSaveAndTest}
                disabled={isTesting || !apiKey}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 min-w-[180px]"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Salvar e Testar
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Test Result */}
          {testResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-lg flex items-center gap-3 ${
                testResult.success 
                  ? "bg-emerald-500/20 border border-emerald-500/50" 
                  : "bg-red-500/20 border border-red-500/50"
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
              <p className={testResult.success ? "text-emerald-400" : "text-red-400"}>
                {testResult.message}
              </p>
            </motion.div>
          )}

          {/* Usage Monitor */}
          <div className="p-4 bg-slate-700/50 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-white font-medium flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 ${isHighUsage ? "text-red-400" : "text-yellow-400"}`} />
                Monitor de Consumo
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefreshUsage}
                disabled={isLoading || !savedKey}
                className="text-slate-400 hover:text-white"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {/* Usage Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Uso atual:</span>
                <span className={`font-mono ${isHighUsage ? "text-red-400" : "text-slate-300"}`}>
                  {(usage?.used || monthlyUsage).toLocaleString('pt-BR')} / {(usage?.limit || TOKEN_LIMIT).toLocaleString('pt-BR')} tokens
                </span>
              </div>
              <Progress 
                value={usagePercent} 
                className={`h-3 ${isHighUsage ? "[&>div]:bg-red-500" : "[&>div]:bg-gradient-to-r [&>div]:from-purple-500 [&>div]:to-pink-500"}`}
              />
              {usage && (
                <p className="text-xs text-slate-400">
                  Restante: {usage.remaining.toLocaleString('pt-BR')} tokens
                </p>
              )}
            </div>

            {/* Warning Text */}
            {isHighUsage && (
              <p className="text-red-400 text-sm">
                ⚠️ Consumo alto! Considere trocar a API Key ou fazer upgrade do plano.
              </p>
            )}
          </div>

          {/* Saved Key Info */}
          {savedKey && (
            <div className="p-3 bg-slate-700/30 rounded-lg">
              <p className="text-slate-400 text-xs">
                Chave salva: <span className="font-mono text-slate-300">••••••••{savedKey.slice(-8)}</span>
              </p>
              <p className="text-slate-500 text-xs mt-1">
                A IA de suporte usará esta chave automaticamente.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
