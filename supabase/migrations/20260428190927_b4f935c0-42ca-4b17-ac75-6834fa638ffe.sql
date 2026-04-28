REVOKE ALL ON FUNCTION public.aplicar_vinculo_card_financeiro(text, jsonb, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aplicar_vinculo_card_financeiro(text, jsonb, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.aplicar_vinculo_card_financeiro(text, jsonb, text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.aplicar_vinculo_card_financeiro_futuro() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aplicar_vinculo_card_financeiro_futuro() FROM anon;
GRANT EXECUTE ON FUNCTION public.aplicar_vinculo_card_financeiro_futuro() TO authenticated;