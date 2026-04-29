REVOKE EXECUTE ON FUNCTION public.sugerir_categorias_por_historico(uuid, uuid, text, numeric, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.preview_regra_dre(uuid, uuid, jsonb, text, uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.sugerir_categorias_por_historico(uuid, uuid, text, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preview_regra_dre(uuid, uuid, jsonb, text, uuid, text) TO authenticated, service_role;