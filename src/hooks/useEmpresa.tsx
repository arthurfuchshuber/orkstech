import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Empresa {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  user_id: string;
  [key: string]: any;
}

interface EmpresaContextType {
  empresa: Empresa | null;
  empresas: Empresa[];
  loading: boolean;
  refetch: () => Promise<void>;
  selectEmpresa: (id: string) => void;
  isSuperAdminMode: boolean;
}

const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined);

const SELECTED_EMPRESA_KEY = "nexus_selected_empresa_id";

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try { return localStorage.getItem(SELECTED_EMPRESA_KEY); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);
  const [isSuperAdminMode, setIsSuperAdminMode] = useState(false);

  const fetchEmpresas = useCallback(async (targetUserId = userId) => {
    if (!targetUserId) {
      setEmpresas([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    // Check if user is Super Admin
    let superAdmin = false;
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("nivel_permissao_id")
        .eq("user_id", targetUserId)
        .single();
      if (profile?.nivel_permissao_id) {
        const { data: nivel } = await supabase
          .from("niveis_permissao")
          .select("nome")
          .eq("id", profile.nivel_permissao_id)
          .single();
        superAdmin = nivel?.nome === "Super Admin";
      }
    } catch {}

    let list: Empresa[] = [];

    if (superAdmin) {
      // Super Admin: fetch ALL companies via edge function
      try {
        const { data } = await supabase.functions.invoke("admin-dashboard", {
          body: { action: "list_companies" },
        });
        list = (data?.companies ?? []) as Empresa[];
      } catch {
        // Fallback to own companies
        const { data } = await supabase
          .from("empresas")
          .select("*")
          .eq("user_id", targetUserId)
          .order("created_at", { ascending: true });
        list = (data ?? []) as Empresa[];
      }
    } else {
      // Empresas onde o usuário é DONO
      const { data: ownedRaw } = await supabase
        .from("empresas")
        .select("*")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: true });
      const owned = (ownedRaw ?? []) as Empresa[];

      // Empresa onde o usuário é MEMBRO (via profiles.empresa_id)
      let memberEmpresa: Empresa | null = null;
      try {
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("empresa_id")
          .eq("user_id", targetUserId)
          .maybeSingle();
        const memberEmpresaId = profileRow?.empresa_id;
        if (memberEmpresaId && !owned.some((e) => e.id === memberEmpresaId)) {
          const { data: empRow } = await supabase
            .from("empresas")
            .select("*")
            .eq("id", memberEmpresaId)
            .maybeSingle();
          if (empRow) memberEmpresa = empRow as Empresa;
        }
      } catch {}

      list = memberEmpresa ? [...owned, memberEmpresa] : owned;
    }

    setEmpresas(list);
    setIsSuperAdminMode(superAdmin);

    // Auto-select: stored ID if still valid, otherwise first
    if (list.length > 0) {
      const stored = selectedId;
      const valid = list.find((e) => e.id === stored);
      if (!valid) {
        setSelectedId(list[0].id);
        try { localStorage.setItem(SELECTED_EMPRESA_KEY, list[0].id); } catch {}
      }
    } else {
      setSelectedId(null);
      try { localStorage.removeItem(SELECTED_EMPRESA_KEY); } catch {}
    }
    setLoading(false);
  }, [userId, selectedId]);

  useEffect(() => {
    fetchEmpresas(userId);
  }, [userId]);

  const selectEmpresa = useCallback((id: string) => {
    setSelectedId(id);
    try { localStorage.setItem(SELECTED_EMPRESA_KEY, id); } catch {}
  }, []);

  const empresa = empresas.find((e) => e.id === selectedId) ?? empresas[0] ?? null;

  return (
    <EmpresaContext.Provider value={{ empresa, empresas, loading, refetch: fetchEmpresas, selectEmpresa, isSuperAdminMode }}>
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresa(): EmpresaContextType {
  const context = useContext(EmpresaContext);
  if (context === undefined) {
    throw new Error("useEmpresa must be used within EmpresaProvider");
  }
  return context;
}
