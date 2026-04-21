import { Navigate } from "react-router-dom";

// Página consolidada — toda gestão de planos vive agora em /app/config/assinatura
export default function ConfigPlanos() {
  return <Navigate to="/app/config/assinatura" replace />;
}
