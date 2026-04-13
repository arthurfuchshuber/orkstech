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

  const fetchEmpresas = useCallback(async (targetUserId = userId) => {
    if (!targetUserId) {
      setEmpresas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("empresas")
      .select("*")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: true });

    const list = (data ?? []) as Empresa[];
    setEmpresas(list);

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
    <EmpresaContext.Provider value={{ empresa, empresas, loading, refetch: fetchEmpresas, selectEmpresa }}>
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
