
-- =========================================================
-- MÓDULO RECURSOS HUMANOS — base completa
-- Cadastros, colaboradores estendidos, folha, ausências,
-- equipamentos, acessos a ferramentas
-- =========================================================

-- ========== CADASTROS RH ==========

-- 1. Departamentos
CREATE TABLE IF NOT EXISTS public.rh_departamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid,
  nome text NOT NULL,
  centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  gestor_colaborador_id uuid,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Cargos
CREATE TABLE IF NOT EXISTS public.rh_cargos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid,
  nome text NOT NULL,
  departamento_id uuid REFERENCES public.rh_departamentos(id) ON DELETE SET NULL,
  cbo text,
  faixa_salarial_min numeric,
  faixa_salarial_max numeric,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Tipos de vínculo
CREATE TABLE IF NOT EXISTS public.rh_tipos_vinculo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid,
  nome text NOT NULL,
  descricao text,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Tipos de benefício
CREATE TABLE IF NOT EXISTS public.rh_tipos_beneficio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid,
  nome text NOT NULL,
  valor_padrao numeric NOT NULL DEFAULT 0,
  desconto_padrao numeric NOT NULL DEFAULT 0,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Tipos de ausência
CREATE TABLE IF NOT EXISTS public.rh_tipos_ausencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid,
  nome text NOT NULL,
  remunerada boolean NOT NULL DEFAULT true,
  conta_saldo_ferias boolean NOT NULL DEFAULT false,
  cor text DEFAULT '#3b82f6',
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Categorias de equipamento
CREATE TABLE IF NOT EXISTS public.rh_categorias_equipamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Catálogo de ferramentas/sistemas
CREATE TABLE IF NOT EXISTS public.rh_ferramentas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid,
  nome text NOT NULL,
  url text,
  custo_mensal numeric DEFAULT 0,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ========== COLABORADORES — estende tabela existente ==========

ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS departamento_id uuid REFERENCES public.rh_departamentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cargo_id uuid REFERENCES public.rh_cargos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_vinculo_id uuid REFERENCES public.rh_tipos_vinculo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_demissao date,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS pessoa_tipo text NOT NULL DEFAULT 'pf',
  ADD COLUMN IF NOT EXISTS pix_chave text,
  ADD COLUMN IF NOT EXISTS banco text,
  ADD COLUMN IF NOT EXISTS agencia text,
  ADD COLUMN IF NOT EXISTS conta text,
  ADD COLUMN IF NOT EXISTS endereco_logradouro text,
  ADD COLUMN IF NOT EXISTS endereco_numero text,
  ADD COLUMN IF NOT EXISTS endereco_complemento text,
  ADD COLUMN IF NOT EXISTS endereco_bairro text,
  ADD COLUMN IF NOT EXISTS endereco_cidade text,
  ADD COLUMN IF NOT EXISTS endereco_estado text,
  ADD COLUMN IF NOT EXISTS endereco_cep text,
  ADD COLUMN IF NOT EXISTS foto_url text,
  ADD COLUMN IF NOT EXISTS jornada_horas numeric DEFAULT 220,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo';

-- ========== REMUNERAÇÃO RECORRENTE ==========

CREATE TABLE IF NOT EXISTS public.rh_colaborador_beneficios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid,
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  tipo_beneficio_id uuid REFERENCES public.rh_tipos_beneficio(id) ON DELETE SET NULL,
  valor numeric NOT NULL DEFAULT 0,
  desconto numeric NOT NULL DEFAULT 0,
  vigencia_inicio date NOT NULL DEFAULT CURRENT_DATE,
  vigencia_fim date,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ========== FOLHA DE PAGAMENTO ==========

CREATE TABLE IF NOT EXISTS public.rh_folha_periodos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid,
  competencia date NOT NULL, -- primeiro dia do mês
  data_pagamento date,
  status text NOT NULL DEFAULT 'rascunho', -- rascunho | aprovada | lancada
  total_proventos numeric NOT NULL DEFAULT 0,
  total_descontos numeric NOT NULL DEFAULT 0,
  total_liquido numeric NOT NULL DEFAULT 0,
  conta_pagar_id uuid REFERENCES public.accounts_payable(id) ON DELETE SET NULL,
  observacoes text,
  fechada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, competencia)
);

CREATE TABLE IF NOT EXISTS public.rh_folha_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid,
  folha_id uuid NOT NULL REFERENCES public.rh_folha_periodos(id) ON DELETE CASCADE,
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  salario_base numeric NOT NULL DEFAULT 0,
  beneficios numeric NOT NULL DEFAULT 0,
  descontos numeric NOT NULL DEFAULT 0,
  encargos numeric NOT NULL DEFAULT 0,
  liquido numeric NOT NULL DEFAULT 0,
  observacoes text,
  detalhamento jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ========== AUSÊNCIAS ==========

CREATE TABLE IF NOT EXISTS public.rh_ausencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid,
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  tipo_ausencia_id uuid REFERENCES public.rh_tipos_ausencia(id) ON DELETE SET NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  dias integer GENERATED ALWAYS AS ((data_fim - data_inicio) + 1) STORED,
  status text NOT NULL DEFAULT 'aprovada', -- solicitada | aprovada | rejeitada
  observacoes text,
  anexo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ========== EQUIPAMENTOS ==========

CREATE TABLE IF NOT EXISTS public.rh_equipamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid,
  categoria_id uuid REFERENCES public.rh_categorias_equipamento(id) ON DELETE SET NULL,
  nome text NOT NULL,
  marca text,
  modelo text,
  numero_serie text,
  patrimonio text,
  valor_aquisicao numeric DEFAULT 0,
  data_aquisicao date,
  status text NOT NULL DEFAULT 'estoque', -- estoque | em_uso | manutencao | descartado
  colaborador_id uuid REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  data_entrega date,
  data_devolucao date,
  observacoes text,
  termo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ========== ACESSOS A FERRAMENTAS ==========

CREATE TABLE IF NOT EXISTS public.rh_colaborador_acessos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid,
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  ferramenta_id uuid REFERENCES public.rh_ferramentas(id) ON DELETE SET NULL,
  login text,
  perfil text,
  status text NOT NULL DEFAULT 'ativo', -- ativo | revogado | pendente
  concedido_em date DEFAULT CURRENT_DATE,
  revogado_em date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ========== TIMELINE / DOCUMENTOS ==========

CREATE TABLE IF NOT EXISTS public.rh_colaborador_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid,
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  tipo text NOT NULL, -- admissao | promocao | mudanca_salario | observacao | demissao
  titulo text NOT NULL,
  descricao text,
  data_evento date NOT NULL DEFAULT CURRENT_DATE,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rh_colaborador_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid,
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text,
  url text NOT NULL,
  tamanho bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ========== ENABLE RLS ==========

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'rh_departamentos','rh_cargos','rh_tipos_vinculo','rh_tipos_beneficio',
    'rh_tipos_ausencia','rh_categorias_equipamento','rh_ferramentas',
    'rh_colaborador_beneficios','rh_folha_periodos','rh_folha_itens',
    'rh_ausencias','rh_equipamentos','rh_colaborador_acessos',
    'rh_colaborador_eventos','rh_colaborador_documentos'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Members view %I" ON public.%I FOR SELECT USING (is_empresa_member(empresa_id) OR auth.uid() = user_id OR is_super_admin())', t, t);
    EXECUTE format('CREATE POLICY "Members insert %I" ON public.%I FOR INSERT WITH CHECK (is_empresa_member(empresa_id) OR auth.uid() = user_id)', t, t);
    EXECUTE format('CREATE POLICY "Members update %I" ON public.%I FOR UPDATE USING (is_empresa_member(empresa_id) OR auth.uid() = user_id)', t, t);
    EXECUTE format('CREATE POLICY "Members delete %I" ON public.%I FOR DELETE USING (is_empresa_member(empresa_id) OR auth.uid() = user_id)', t, t);
    EXECUTE format('CREATE TRIGGER trg_upd_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
  END LOOP;
END $$;

-- ========== ÍNDICES ==========

CREATE INDEX IF NOT EXISTS idx_rh_cargos_dept ON public.rh_cargos(departamento_id);
CREATE INDEX IF NOT EXISTS idx_rh_colab_benef_colab ON public.rh_colaborador_beneficios(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_rh_folha_itens_folha ON public.rh_folha_itens(folha_id);
CREATE INDEX IF NOT EXISTS idx_rh_ausencias_colab ON public.rh_ausencias(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_rh_equip_colab ON public.rh_equipamentos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_rh_acessos_colab ON public.rh_colaborador_acessos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_rh_eventos_colab ON public.rh_colaborador_eventos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_colab_dept ON public.colaboradores(departamento_id);

-- ========== FUNÇÃO: fechar folha e gerar Conta a Pagar consolidada ==========

CREATE OR REPLACE FUNCTION public.rh_fechar_folha(p_folha_id uuid, p_due_date date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folha public.rh_folha_periodos%ROWTYPE;
  v_total numeric;
  v_payable_id uuid;
  v_competencia text;
BEGIN
  SELECT * INTO v_folha FROM public.rh_folha_periodos WHERE id = p_folha_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Folha não encontrada'; END IF;
  IF v_folha.status = 'lancada' THEN RAISE EXCEPTION 'Folha já lançada'; END IF;

  SELECT COALESCE(SUM(liquido),0) INTO v_total FROM public.rh_folha_itens WHERE folha_id = p_folha_id;

  v_competencia := to_char(v_folha.competencia, 'MM/YYYY');

  INSERT INTO public.accounts_payable (
    user_id, empresa_id, description, amount, due_date,
    status, supplier_name, pessoa_tipo, origem
  ) VALUES (
    v_folha.user_id, v_folha.empresa_id,
    'Folha de Pagamento — ' || v_competencia,
    v_total, p_due_date,
    'pending', 'Folha de Pagamento — ' || v_competencia, 'pj', 'manual'
  ) RETURNING id INTO v_payable_id;

  UPDATE public.rh_folha_periodos
     SET status = 'lancada',
         total_liquido = v_total,
         conta_pagar_id = v_payable_id,
         data_pagamento = p_due_date,
         fechada_em = now()
   WHERE id = p_folha_id;

  RETURN v_payable_id;
END;
$$;

-- ========== STORAGE bucket privado para RH ==========

INSERT INTO storage.buckets (id, name, public)
VALUES ('rh-documentos', 'rh-documentos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "RH docs read auth" ON storage.objects FOR SELECT
  USING (bucket_id = 'rh-documentos' AND auth.uid() IS NOT NULL);
CREATE POLICY "RH docs insert auth" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'rh-documentos' AND auth.uid() IS NOT NULL);
CREATE POLICY "RH docs update auth" ON storage.objects FOR UPDATE
  USING (bucket_id = 'rh-documentos' AND auth.uid() IS NOT NULL);
CREATE POLICY "RH docs delete auth" ON storage.objects FOR DELETE
  USING (bucket_id = 'rh-documentos' AND auth.uid() IS NOT NULL);

-- ========== SEED MENU para empresas existentes + futuras ==========

CREATE OR REPLACE FUNCTION public.seed_rh_menus(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rh uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.menus WHERE user_id = p_user_id AND slug = 'rh') THEN
    RETURN;
  END IF;
  INSERT INTO public.menus (user_id, name, slug, icon, order_index, module)
  VALUES (p_user_id, 'Recursos Humanos', 'rh', 'Users2', 3, 'rh')
  RETURNING id INTO v_rh;
  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module) VALUES
    (p_user_id, 'Colaboradores', 'rh-colaboradores', 'UserCircle2', '/app/rh/colaboradores', v_rh, 0, 'rh'),
    (p_user_id, 'Folha de Pagamento', 'rh-folha', 'BadgeDollarSign', '/app/rh/folha', v_rh, 1, 'rh'),
    (p_user_id, 'Férias & Ausências', 'rh-ausencias', 'CalendarDays', '/app/rh/ausencias', v_rh, 2, 'rh'),
    (p_user_id, 'Equipamentos', 'rh-equipamentos', 'Laptop', '/app/rh/equipamentos', v_rh, 3, 'rh'),
    (p_user_id, 'Cadastros RH', 'rh-cadastros', 'Settings2', '/app/rh/cadastros', v_rh, 4, 'rh');
  INSERT INTO public.menu_permissions (menu_id, role, can_view)
  SELECT id, 'admin', true FROM public.menus WHERE user_id = p_user_id AND module = 'rh'
  ON CONFLICT DO NOTHING;
  INSERT INTO public.menu_permissions (menu_id, role, can_view)
  SELECT id, 'user', true FROM public.menus WHERE user_id = p_user_id AND module = 'rh'
  ON CONFLICT DO NOTHING;
END;
$$;

-- Backfill para usuários já existentes
DO $$
DECLARE u uuid;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM public.menus LOOP
    PERFORM public.seed_rh_menus(u);
  END LOOP;
END $$;

-- Atualiza seed default para incluir RH em novas empresas
CREATE OR REPLACE FUNCTION public.on_empresa_created_seed_menus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_default_menus(NEW.user_id);
  PERFORM public.seed_rh_menus(NEW.user_id);
  RETURN NEW;
END;
$$;
