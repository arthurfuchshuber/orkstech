import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Loader2 } from "lucide-react";

export function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { empresa, loading: empresaLoading } = useEmpresa();

  if (loading || empresaLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If empresa already exists, redirect to app
  if (empresa) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
