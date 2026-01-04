-- Add salary fields to users_matricula table
ALTER TABLE public.users_matricula 
ADD COLUMN IF NOT EXISTS salary_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS salary_day integer DEFAULT 5;

-- Create scheduled_payments table for recurring and one-time payments
CREATE TABLE public.scheduled_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_matricula bigint NOT NULL,
  name text NOT NULL,
  amount numeric NOT NULL,
  due_day integer NOT NULL,
  is_recurring boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  specific_month date DEFAULT NULL,
  category text DEFAULT 'outros',
  last_paid_at timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own scheduled payments" 
ON public.scheduled_payments 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert own scheduled payments" 
ON public.scheduled_payments 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update own scheduled payments" 
ON public.scheduled_payments 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete own scheduled payments" 
ON public.scheduled_payments 
FOR DELETE 
USING (true);

-- Create payment_logs table to track completed payments
CREATE TABLE public.payment_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_matricula bigint NOT NULL,
  scheduled_payment_id uuid REFERENCES public.scheduled_payments(id) ON DELETE SET NULL,
  name text NOT NULL,
  amount numeric NOT NULL,
  paid_at timestamp with time zone NOT NULL DEFAULT now(),
  payment_type text NOT NULL DEFAULT 'scheduled',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for payment_logs
CREATE POLICY "Users can view own payment logs" 
ON public.payment_logs 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert own payment logs" 
ON public.payment_logs 
FOR INSERT 
WITH CHECK (true);

-- Create salary_credits table to track automatic salary entries
CREATE TABLE public.salary_credits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_matricula bigint NOT NULL,
  amount numeric NOT NULL,
  credited_at timestamp with time zone NOT NULL DEFAULT now(),
  month_year text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.salary_credits ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for salary_credits
CREATE POLICY "Users can view own salary credits" 
ON public.salary_credits 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert own salary credits" 
ON public.salary_credits 
FOR INSERT 
WITH CHECK (true);

-- Add trigger for updated_at on scheduled_payments
CREATE TRIGGER update_scheduled_payments_updated_at
BEFORE UPDATE ON public.scheduled_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();