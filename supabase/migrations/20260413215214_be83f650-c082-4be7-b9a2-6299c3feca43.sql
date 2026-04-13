
-- Function to uppercase razao_social and nome_fantasia
CREATE OR REPLACE FUNCTION public.enforce_uppercase_names()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.razao_social IS NOT NULL THEN
    NEW.razao_social := UPPER(NEW.razao_social);
  END IF;
  IF NEW.nome_fantasia IS NOT NULL THEN
    NEW.nome_fantasia := UPPER(NEW.nome_fantasia);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for empresas
CREATE TRIGGER enforce_uppercase_empresas
BEFORE INSERT OR UPDATE ON public.empresas
FOR EACH ROW EXECUTE FUNCTION public.enforce_uppercase_names();

-- Triggers for clientes
CREATE TRIGGER enforce_uppercase_clientes
BEFORE INSERT OR UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.enforce_uppercase_names();

-- Triggers for fornecedores
CREATE TRIGGER enforce_uppercase_fornecedores
BEFORE INSERT OR UPDATE ON public.fornecedores
FOR EACH ROW EXECUTE FUNCTION public.enforce_uppercase_names();

-- Update existing data
UPDATE public.empresas SET razao_social = UPPER(razao_social) WHERE razao_social IS NOT NULL;
UPDATE public.empresas SET nome_fantasia = UPPER(nome_fantasia) WHERE nome_fantasia IS NOT NULL;
UPDATE public.clientes SET razao_social = UPPER(razao_social) WHERE razao_social IS NOT NULL;
UPDATE public.clientes SET nome_fantasia = UPPER(nome_fantasia) WHERE nome_fantasia IS NOT NULL;
UPDATE public.fornecedores SET razao_social = UPPER(razao_social) WHERE razao_social IS NOT NULL;
UPDATE public.fornecedores SET nome_fantasia = UPPER(nome_fantasia) WHERE nome_fantasia IS NOT NULL;
