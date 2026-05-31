
-- 1. Tabela tipos_gasto
CREATE TABLE public.tipos_gasto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  nome text NOT NULL,
  emoji text NOT NULL DEFAULT '💰',
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipos_gasto TO authenticated;
GRANT ALL ON public.tipos_gasto TO service_role;

ALTER TABLE public.tipos_gasto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tipos_gasto" ON public.tipos_gasto
  FOR SELECT TO authenticated USING (is_empresa_member(empresa_id));
CREATE POLICY "Members can insert tipos_gasto" ON public.tipos_gasto
  FOR INSERT TO authenticated WITH CHECK (is_empresa_member(empresa_id));
CREATE POLICY "Members can update tipos_gasto" ON public.tipos_gasto
  FOR UPDATE TO authenticated USING (is_empresa_member(empresa_id));
CREATE POLICY "Members can delete tipos_gasto" ON public.tipos_gasto
  FOR DELETE TO authenticated USING (is_empresa_member(empresa_id));

CREATE INDEX idx_tipos_gasto_empresa ON public.tipos_gasto(empresa_id);

-- 2. FK tipo_gasto_id em lançamentos
ALTER TABLE public.accounts_payable ADD COLUMN tipo_gasto_id uuid REFERENCES public.tipos_gasto(id) ON DELETE SET NULL;
ALTER TABLE public.pluggy_transactions ADD COLUMN tipo_gasto_id uuid REFERENCES public.tipos_gasto(id) ON DELETE SET NULL;
ALTER TABLE public.manual_bank_transactions ADD COLUMN tipo_gasto_id uuid REFERENCES public.tipos_gasto(id) ON DELETE SET NULL;
ALTER TABLE public.cash_transactions ADD COLUMN tipo_gasto_id uuid REFERENCES public.tipos_gasto(id) ON DELETE SET NULL;

-- 3. Função de seed dos tipos padrão
CREATE OR REPLACE FUNCTION public.seed_tipos_gasto_padrao(_empresa_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  defaults text[][] := ARRAY[
    ARRAY['🛒','Mercado'],
    ARRAY['🍽️','Alimentação'],
    ARRAY['🚗','Transporte'],
    ARRAY['⛽','Combustível'],
    ARRAY['🏠','Moradia'],
    ARRAY['💡','Contas & Utilidades'],
    ARRAY['🏥','Saúde'],
    ARRAY['💊','Farmácia'],
    ARRAY['📚','Educação'],
    ARRAY['🎓','Cursos & Capacitação'],
    ARRAY['🎬','Entretenimento'],
    ARRAY['✈️','Viagem'],
    ARRAY['👕','Vestuário'],
    ARRAY['💄','Beleza & Cuidados'],
    ARRAY['💪','Esporte & Lazer'],
    ARRAY['🐾','Pets'],
    ARRAY['🎁','Presentes & Doações'],
    ARRAY['📱','Tecnologia'],
    ARRAY['💼','Trabalho'],
    ARRAY['🪙','Investimentos'],
    ARRAY['💳','Taxas & Impostos'],
    ARRAY['🔧','Manutenção'],
    ARRAY['🎉','Festas & Eventos'],
    ARRAY['❓','Outros']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(defaults, 1) LOOP
    INSERT INTO public.tipos_gasto (empresa_id, user_id, nome, emoji, ordem)
    VALUES (_empresa_id, _user_id, defaults[i][2], defaults[i][1], i)
    ON CONFLICT (empresa_id, nome) DO NOTHING;
  END LOOP;
END;
$$;

-- 4. Trigger seed em novas empresas
CREATE OR REPLACE FUNCTION public.trg_seed_tipos_gasto_on_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_tipos_gasto_padrao(NEW.id, NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS empresa_seed_tipos_gasto ON public.empresas;
CREATE TRIGGER empresa_seed_tipos_gasto
AFTER INSERT ON public.empresas
FOR EACH ROW EXECUTE FUNCTION public.trg_seed_tipos_gasto_on_empresa();

-- 5. Backfill em empresas existentes
DO $$
DECLARE e record;
BEGIN
  FOR e IN SELECT id, user_id FROM public.empresas LOOP
    PERFORM public.seed_tipos_gasto_padrao(e.id, e.user_id);
  END LOOP;
END $$;
