-- Função: aplica Title Case PT-BR (mantém conectivos e siglas pequenas em minúsculo)
CREATE OR REPLACE FUNCTION public.title_case_ptbr(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result text := '';
  word text;
  lower_word text;
  words text[];
  i int;
  small_words text[] := ARRAY['de','da','do','dos','das','e','o','a','os','as','para','com','sem','em','na','no','nas','nos','di','del','la','le','y'];
BEGIN
  IF input IS NULL OR length(trim(input)) = 0 THEN
    RETURN input;
  END IF;

  -- Normaliza espaços e separa por espaço
  words := regexp_split_to_array(trim(regexp_replace(input, '\s+', ' ', 'g')), '\s+');

  FOR i IN 1..array_length(words, 1) LOOP
    word := words[i];
    lower_word := lower(word);

    -- Mantém siglas curtas/romanas conhecidas em maiúsculo
    IF lower_word IN ('ii','iii','iv','vi','vii','viii','ix','xi','xii','xiii','xiv','xv','jr','sr') THEN
      IF lower_word IN ('jr','sr') THEN
        word := initcap(lower_word);
      ELSE
        word := upper(lower_word);
      END IF;
    -- Conectivos ficam minúsculos (exceto se for a primeira palavra)
    ELSIF i > 1 AND lower_word = ANY(small_words) THEN
      word := lower_word;
    ELSE
      -- Trata hífen e apóstrofo capitalizando cada parte (D'Avila, Ana-Maria)
      word := regexp_replace(
        initcap(lower_word),
        '([-''])([a-zà-ÿ])',
        '\1' || upper('\2'),
        'g'
      );
      -- initcap já capitaliza após hífen/apóstrofo na maioria dos casos, mas garantimos:
      word := initcap(lower_word);
    END IF;

    result := result || CASE WHEN i = 1 THEN '' ELSE ' ' END || word;
  END LOOP;

  RETURN result;
END;
$$;

-- Trigger: normaliza nome_completo, razao_social e nome_fantasia em clientes
CREATE OR REPLACE FUNCTION public.normalize_cliente_names()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.nome_completo IS NOT NULL THEN
    NEW.nome_completo := public.title_case_ptbr(NEW.nome_completo);
  END IF;
  IF NEW.razao_social IS NOT NULL THEN
    NEW.razao_social := public.title_case_ptbr(NEW.razao_social);
  END IF;
  IF NEW.nome_fantasia IS NOT NULL THEN
    NEW.nome_fantasia := public.title_case_ptbr(NEW.nome_fantasia);
  END IF;
  RETURN NEW;
END;
$$;

-- Remove trigger anterior de uppercase (se existir) e recria com title case
DROP TRIGGER IF EXISTS trg_uppercase_cliente_names ON public.clientes;
DROP TRIGGER IF EXISTS trg_normalize_cliente_names ON public.clientes;

CREATE TRIGGER trg_normalize_cliente_names
BEFORE INSERT OR UPDATE OF nome_completo, razao_social, nome_fantasia
ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.normalize_cliente_names();

-- Backfill: aplica Title Case a todos os registros existentes
UPDATE public.clientes
SET 
  nome_completo = public.title_case_ptbr(nome_completo),
  razao_social = public.title_case_ptbr(razao_social),
  nome_fantasia = public.title_case_ptbr(nome_fantasia)
WHERE nome_completo IS NOT NULL OR razao_social IS NOT NULL OR nome_fantasia IS NOT NULL;