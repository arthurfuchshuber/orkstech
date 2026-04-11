import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface EmpresaContextType {
  empresa: any | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined);

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [empresa, setEmpresa] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEmpresa = async () => {
    if (!user) {
      setEmpresa(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("empresas")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setEmpresa(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchEmpresa();
  }, [user]);

  return (
    <EmpresaContext.Provider value={{ empresa, loading, refetch: fetchEmpresa }}>
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
