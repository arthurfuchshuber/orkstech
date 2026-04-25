import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

export interface UserPermission {
  action_key: string;
  can_view: boolean;
  can_edit: boolean;
}

/**
 * Catálogo de permissões disponíveis no sistema.
 * Cada chave corresponde a um item de menu ou área sistêmica.
 */
export const PERMISSION_CATALOG = {
  menu: [
    { key: "menu:dashboard-principal", label: "Início (Dashboard Principal)", alwaysOn: true },
    { key: "menu:dashboard", label: "Financeiro › Dashboard" },
    { key: "menu:contas-pagar", label: "Financeiro › Contas a Pagar" },
    { key: "menu:contas-receber", label: "Financeiro › Contas a Receber" },
    { key: "menu:fluxo-caixa", label: "Financeiro › Fluxo de Caixa" },
    { key: "menu:extrato-bancario", label: "Financeiro › Extrato Bancário" },
    { key: "menu:dre", label: "Financeiro › DRE & Analytics" },
    { key: "menu:clientes", label: "Cadastros › Clientes" },
    { key: "menu:fornecedores", label: "Cadastros › Fornecedores" },
    { key: "menu:inventario", label: "Cadastros › Inventário" },
    { key: "menu:cadastros-financeiros", label: "Configurações › Financeiro (Plano de Contas)" },
  ],
  system: [
    { key: "system:empresa", label: "Configurações › Empresa" },
    { key: "system:usuarios", label: "Configurações › Usuários & Permissões" },
    { key: "system:alterar-senha-usuarios", label: "Configurações › Alterar senha de usuários" },
    { key: "system:assinatura", label: "Configurações › Assinatura" },
    { key: "system:integracoes", label: "Configurações › Integrações" },
    { key: "system:gerenciar-menu", label: "Configurações › Gerenciar Menu" },
  ],
} as const;

export const ALL_PERMISSION_KEYS = [
  ...PERMISSION_CATALOG.menu.map((p) => p.key),
  ...PERMISSION_CATALOG.system.map((p) => p.key),
];

const MENU_PERMISSION_ALIASES: Record<string, string> = {
  "dashboard-financeiro": "menu:dashboard",
};

const SYSTEM_MENU_PERMISSION_KEYS: Record<string, string> = {
  empresa: "system:empresa",
  usuarios: "system:usuarios",
  assinatura: "system:assinatura",
  integracoes: "system:integracoes",
  "gerenciar-menu": "system:gerenciar-menu",
};

export function getMenuPermissionKey(slug: string): string | null {
  const aliased = MENU_PERMISSION_ALIASES[slug];
  if (aliased) return aliased;

  const menuKey = `menu:${slug}`;
  if (ALL_PERMISSION_KEYS.includes(menuKey as any)) return menuKey;

  return SYSTEM_MENU_PERMISSION_KEYS[slug] ?? null;
}

export function usePermissions() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const { isSuperAdmin } = useSuperAdmin();

  // Owner = quem criou a empresa
  const isOwner = !!(empresa && user && empresa.user_id === user.id);

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ["user-permissions", user?.id, empresa?.id],
    enabled: !!user?.id && !!empresa?.id && !isOwner && !isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("action_key, can_view, can_edit")
        .eq("user_id", user!.id)
        .eq("empresa_id", empresa!.id);
      if (error) throw error;
      return (data ?? []) as UserPermission[];
    },
  });

  const permMap = new Map(permissions.map((p) => [p.action_key, p]));

  const canView = (key: string): boolean => {
    if (isSuperAdmin || isOwner) return true;
    if (key === "menu:dashboard-principal") return true; // sempre liberado
    return permMap.get(key)?.can_view ?? false;
  };

  const canEdit = (key: string): boolean => {
    if (isSuperAdmin || isOwner) return true;
    return permMap.get(key)?.can_edit ?? false;
  };

  return { permissions, canView, canEdit, isOwner, isLoading };
}
