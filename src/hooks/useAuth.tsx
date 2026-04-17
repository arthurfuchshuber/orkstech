import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null; needsEmailConfirmation?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const getAuthErrorMessage = (payload: unknown) => {
    if (payload && typeof payload === "object") {
      const message = "msg" in payload ? payload.msg : "error" in payload ? payload.error : null;
      return typeof message === "string" ? message : "Falha na autenticação";
    }
    return "Falha na autenticação";
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("auth-proxy", {
        body: { action: "signUp", email, password, name },
      });

      if (error) return { error: error.message ?? "Falha na autenticação" };
      if (data?.error || data?.msg) return { error: getAuthErrorMessage(data) };

      if (data?.access_token && data?.refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        return { error: sessionError?.message ?? null };
      }

      return { error: null, needsEmailConfirmation: true };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Falha na autenticação" };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("auth-proxy", {
        body: { action: "signIn", email, password },
      });

      if (error) return { error: error.message ?? "Falha na autenticação" };
      if (data?.error || data?.msg) return { error: getAuthErrorMessage(data) };
      if (!data?.access_token || !data?.refresh_token) return { error: "Sessão não retornada pelo servidor" };

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      return { error: sessionError?.message ?? null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Falha na autenticação" };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
