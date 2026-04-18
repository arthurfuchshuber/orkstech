UPDATE accounts_receivable ar
SET supplier_name = COALESCE(c.nome_fantasia, c.razao_social, c.nome_completo),
    pessoa_tipo = c.tipo::text
FROM clientes c
WHERE ar.cliente_id = c.id
  AND ar.notes LIKE 'Importado do Asaas%'
  AND (ar.supplier_name IS NULL OR ar.supplier_name = '');