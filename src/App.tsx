import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { EmpresaProvider } from "@/hooks/useEmpresa";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { OnboardingRoute } from "@/components/OnboardingRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AppLayout from "./components/AppLayout";
import Onboarding from "./pages/app/Onboarding";
import Clientes from "./pages/app/Clientes";
import ClienteWorkspace from "./pages/app/ClienteWorkspace";
import Fornecedores from "./pages/app/Fornecedores";
import Automacoes from "./pages/app/Automacoes";
import Configuracoes from "./pages/app/Configuracoes";
import PlaceholderPage from "./pages/app/PlaceholderPage";
import Financeiro from "./pages/app/Financeiro";
import FinanceiroDashboardPage from "./pages/app/FinanceiroDashboardPage";
import ContasBancarias from "./pages/app/ContasBancarias";
import GerenciarMenu from "./pages/app/GerenciarMenu";
import ContasAPagar from "./pages/app/ContasAPagar";
import ContasAReceber from "./pages/app/ContasAReceber";
import NotFound from "./pages/NotFound";
import ExtratoBancario from "./pages/app/ExtratoBancario";
import Conciliacao from "./pages/app/Conciliacao";
import DREPage from "./pages/app/DREPage";
import ConfigConta from "./pages/app/ConfigConta";
import ConfigPlanos from "./pages/app/ConfigPlanos";
import ConfigAssinatura from "./pages/app/ConfigAssinatura";
import ConfigIntegracoes from "./pages/app/ConfigIntegracoes";
import { SuperAdminRoute } from "./components/SuperAdminRoute";
import AdminPanel from "./pages/app/admin/AdminPanel";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <EmpresaProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/app/onboarding" element={<OnboardingRoute><Onboarding /></OnboardingRoute>} />
              <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="/app/financas/dashboard" replace />} />
                <Route path="dashboard" element={<Navigate to="/app/financas/dashboard" replace />} />
                <Route path="clientes" element={<Clientes />} />
                <Route path="clientes/:id" element={<ClienteWorkspace />} />
                <Route path="fornecedores" element={<Fornecedores />} />
                <Route path="inventario" element={<PlaceholderPage />} />
                <Route path="financas/dashboard" element={<FinanceiroDashboardPage />} />
                <Route path="financas/pagar" element={<ContasAPagar />} />
                <Route path="financas/receber" element={<ContasAReceber />} />
                <Route path="financas/fluxo" element={<PlaceholderPage />} />
                <Route path="financas/dre" element={<DREPage />} />
                <Route path="financas/cadastros" element={<Financeiro />} />
                <Route path="financas/plano-de-contas" element={<Navigate to="/app/financas/cadastros" replace />} />
                <Route path="financas/centros-de-custo" element={<Navigate to="/app/financas/cadastros" replace />} />
                <Route path="financas/formas-de-pagamento" element={<Navigate to="/app/financas/cadastros" replace />} />
                <Route path="financas/contas-bancarias" element={<Navigate to="/app/financas/cadastros" replace />} />
                <Route path="extrato-bancario" element={<ExtratoBancario />} />
                <Route path="financas/extrato" element={<Navigate to="/app/extrato-bancario" replace />} />
                <Route path="financas/conciliacao" element={<Conciliacao />} />
                <Route path="automacoes/config" element={<Automacoes />} />
                <Route path="automacoes/workflows" element={<Navigate to="/app/automacoes/config" replace />} />
                <Route path="automacoes/integracoes" element={<PlaceholderPage />} />
                <Route path="automacoes/notificacoes" element={<PlaceholderPage />} />
                <Route path="config" element={<Configuracoes />} />
                <Route path="config/geral" element={<PlaceholderPage />} />
                <Route path="config/conta" element={<ConfigConta />} />
                <Route path="config/usuarios" element={<ConfigConta defaultTab="usuarios" />} />
                <Route path="config/permissoes" element={<Navigate to="/app/config/conta" replace />} />
                <Route path="config/planos" element={<ConfigPlanos />} />
                <Route path="config/assinatura" element={<ConfigAssinatura />} />
                <Route path="config/menus" element={<GerenciarMenu />} />
                <Route path="config/integracoes" element={<ConfigIntegracoes />} />
                <Route path="admin" element={<SuperAdminRoute><AdminPanel /></SuperAdminRoute>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </EmpresaProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
