-- Adicionar campo has_credit_card para controlar se usuário tem cartão de crédito
ALTER TABLE public.users_matricula 
ADD COLUMN IF NOT EXISTS has_credit_card boolean DEFAULT false;

-- Adicionar campo credit_available para valor disponível no cartão
ALTER TABLE public.users_matricula 
ADD COLUMN IF NOT EXISTS credit_available numeric DEFAULT 0;