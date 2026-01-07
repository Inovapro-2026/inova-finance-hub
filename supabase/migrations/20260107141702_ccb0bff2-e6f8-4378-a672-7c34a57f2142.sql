-- Tabela de configurações do sistema
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de uso de tokens do ElevenLabs
CREATE TABLE IF NOT EXISTS public.elevenlabs_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month_year TEXT NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(month_year)
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elevenlabs_usage ENABLE ROW LEVEL SECURITY;

-- Policies para system_settings (somente admins)
CREATE POLICY "Admins can view settings" 
  ON public.system_settings FOR SELECT 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert settings" 
  ON public.system_settings FOR INSERT 
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update settings" 
  ON public.system_settings FOR UPDATE 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete settings" 
  ON public.system_settings FOR DELETE 
  USING (public.has_role(auth.uid(), 'admin'));

-- Policies para elevenlabs_usage (somente admins)
CREATE POLICY "Admins can view usage" 
  ON public.elevenlabs_usage FOR SELECT 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert usage" 
  ON public.elevenlabs_usage FOR INSERT 
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update usage" 
  ON public.elevenlabs_usage FOR UPDATE 
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_elevenlabs_usage_updated_at
  BEFORE UPDATE ON public.elevenlabs_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();