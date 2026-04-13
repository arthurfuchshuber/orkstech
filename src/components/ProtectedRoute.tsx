import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { empresa, loading: empresaLoading } = useEmpresa();
  const { isSuperAdmin, isLoading: superAdminLoading } = useSuperAdmin();

  if (loading || empresaLoading || superAdminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Super Admins can access the app even without a company
  if (!empresa && !isSuperAdmin) {
    return <Navigate to="/app/onboarding" replace />;
  }

  return <>{children}</>;
}
