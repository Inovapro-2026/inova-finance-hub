-- Add missing columns to users_matricula for profile data
ALTER TABLE public.users_matricula 
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS initial_balance numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_limit numeric DEFAULT 5000,
ADD COLUMN IF NOT EXISTS credit_used numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_due_day integer DEFAULT 5;

-- Add payment_method to transactions for debit/credit distinction
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'debit';