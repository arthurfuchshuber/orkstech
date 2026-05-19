// Tradutor centralizado de mensagens de erro técnicas (Supabase Auth, PostgREST,
// Edge Functions, Stripe etc.) para Português do Brasil.
// Use sempre que for exibir um erro vindo de SDK ao usuário final.

const MAP: Array<[RegExp, string]> = [
  // Supabase Auth
  [/invalid login credentials/i, "Email ou senha incorretos"],
  [/email not confirmed/i, "Email ainda não confirmado. Verifique sua caixa de entrada."],
  [/user already registered|already exists/i, "Este email já está cadastrado"],
  [/email rate limit exceeded/i, "Muitas tentativas. Aguarde alguns minutos e tente novamente."],
  [/password should be at least (\d+) characters/i, "A senha deve ter pelo menos $1 caracteres"],
  [/weak[_ ]password|password is too weak/i, "Senha muito fraca. Use letras, números e símbolos."],
  [/signups? not allowed|signup is disabled/i, "Cadastros estão desativados no momento"],
  [/token has expired|jwt expired/i, "Sessão expirada. Faça login novamente."],
  [/invalid token|invalid jwt/i, "Token inválido"],
  [/user not found/i, "Usuário não encontrado"],
  [/no authorization header|no authorization/i, "Sessão não autenticada. Faça login novamente."],
  [/user not authenticated/i, "Usuário não autenticado"],
  [/email link is invalid or has expired/i, "Link de email inválido ou expirado"],
  [/new password should be different/i, "A nova senha deve ser diferente da atual"],
  [/database error saving new user/i, "Erro ao criar conta. Tente novamente."],

  // PostgREST / DB
  [/duplicate key value|already exists/i, "Registro já existe"],
  [/violates foreign key constraint/i, "Existe um registro vinculado que impede a operação"],
  [/violates not-null constraint.*column "([^"]+)"/i, 'O campo "$1" é obrigatório'],
  [/violates not-null constraint/i, "Há campos obrigatórios não preenchidos"],
  // Check constraints conhecidos
  [/clientes_check_pf/i, "Para Pessoa Física, informe nome completo e CPF válido"],
  [/clientes_check_pj/i, "Para Pessoa Jurídica, informe razão social e CNPJ válido"],
  [/fornecedores_check_pf/i, "Para Pessoa Física, informe nome completo e CPF válido"],
  [/fornecedores_check_pj/i, "Para Pessoa Jurídica, informe razão social e CNPJ válido"],
  [/check constraint "([^"]+)"/i, "Dados inválidos: verifique os campos preenchidos"],
  [/could not find the '([^']+)' column of '([^']+)' in the schema cache/i,
    "O campo \"$1\" não existe na tabela. Atualize a página e tente novamente."],
  [/permission denied|row-level security/i, "Você não tem permissão para esta operação"],
  [/network ?error|failed to fetch|load failed/i, "Sem conexão com o servidor. Verifique sua internet."],
  [/timeout|timed out/i, "Tempo esgotado. Tente novamente."],

  // Stripe
  [/your card was declined/i, "Cartão recusado"],
  [/insufficient funds/i, "Saldo insuficiente no cartão"],
  [/expired card/i, "Cartão expirado"],
  [/incorrect cvc|invalid cvc/i, "Código de segurança (CVC) inválido"],
];

export function translateError(input: unknown): string {
  if (!input) return "Ocorreu um erro inesperado";
  const raw =
    typeof input === "string"
      ? input
      : (input as any)?.message || (input as any)?.error_description || (input as any)?.error || String(input);
  if (!raw) return "Ocorreu um erro inesperado";

  for (const [re, pt] of MAP) {
    const m = raw.match(re);
    if (m) return pt.replace("$1", m[1] ?? "");
  }
  // Se já vier em português (heurística simples), devolve como está
  if (/[ãáàâéêíóôõúçÃÁÀÂÉÊÍÓÔÕÚÇ]/.test(raw)) return raw;
  // Mensagens técnicas em inglês sem tradução conhecida → fallback genérico em PT-BR
  return "Ocorreu um erro. Tente novamente.";
}
