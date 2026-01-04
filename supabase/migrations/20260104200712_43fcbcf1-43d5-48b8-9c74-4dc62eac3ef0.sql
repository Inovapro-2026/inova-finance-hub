-- Adicionar colunas para adiantamento na tabela users_matricula
ALTER TABLE public.users_matricula
ADD COLUMN IF NOT EXISTS advance_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS advance_day integer DEFAULT NULL;