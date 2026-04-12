
-- Table for permission levels (dynamic, admin-managed in the future)
CREATE TABLE public.niveis_permissao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.niveis_permissao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view niveis_permissao"
  ON public.niveis_permissao FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Only service role can manage niveis_permissao"
  ON public.niveis_permissao FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Seed default permission levels
INSERT INTO public.niveis_permissao (nome, descricao, is_system, ordem) VALUES
  ('Admin', 'Acesso total ao sistema, incluindo configurações e gestão de usuários', true, 1),
  ('Financeiro', 'Acesso a contas a pagar, conciliação, extratos e relatórios financeiros', true, 2),
  ('Operacional', 'Acesso a cadastros de clientes, fornecedores e produtos', true, 3),
  ('Visualizador', 'Acesso somente leitura a dashboards e relatórios', true, 4);

-- Profiles table for user details
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  nome TEXT,
  cpf TEXT,
  telefone TEXT,
  data_nascimento DATE,
  nivel_permissao_id UUID REFERENCES public.niveis_permissao(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_level_id UUID;
BEGIN
  -- First user gets Admin, others get Visualizador by default
  SELECT id INTO admin_level_id FROM public.niveis_permissao WHERE nome = 'Admin' AND is_system = true LIMIT 1;
  
  INSERT INTO public.profiles (user_id, nome, nivel_permissao_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    admin_level_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_niveis_permissao_updated_at
  BEFORE UPDATE ON public.niveis_permissao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
