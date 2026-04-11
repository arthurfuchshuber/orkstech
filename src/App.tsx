import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AppLayout from "./components/AppLayout";
import Clientes from "./pages/app/Clientes";
import Fornecedores from "./pages/app/Fornecedores";
import Automacoes from "./pages/app/Automacoes";
import Configuracoes from "./pages/app/Configuracoes";
import PlaceholderPage from "./pages/app/PlaceholderPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
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
            <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/app/clientes" replace />} />
              <Route path="clientes" element={<Clientes />} />
              <Route path="fornecedores" element={<Fornecedores />} />
              <Route path="inventario" element={<PlaceholderPage />} />
              <Route path="financas/pagar" element={<PlaceholderPage />} />
              <Route path="financas/receber" element={<PlaceholderPage />} />
              <Route path="financas/fluxo" element={<PlaceholderPage />} />
              <Route path="financas/dre" element={<PlaceholderPage />} />
              <Route path="automacoes/workflows" element={<Automacoes />} />
              <Route path="automacoes/integracoes" element={<PlaceholderPage />} />
              <Route path="automacoes/notificacoes" element={<PlaceholderPage />} />
              <Route path="config" element={<Configuracoes />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
