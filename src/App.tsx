import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "./pages/Landing";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/app/Dashboard";
import Financas from "./pages/app/Financas";
import CustomerSuccess from "./pages/app/CustomerSuccess";
import Clientes from "./pages/app/Clientes";
import Automacoes from "./pages/app/Automacoes";
import Configuracoes from "./pages/app/Configuracoes";
import PlaceholderPage from "./pages/app/PlaceholderPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="financas" element={<Financas />} />
            <Route path="financas/*" element={<PlaceholderPage />} />
            <Route path="cs" element={<CustomerSuccess />} />
            <Route path="cs/*" element={<PlaceholderPage />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="fornecedores" element={<PlaceholderPage />} />
            <Route path="inventario" element={<PlaceholderPage />} />
            <Route path="contratos" element={<PlaceholderPage />} />
            <Route path="automacoes/workflows" element={<Automacoes />} />
            <Route path="automacoes/*" element={<PlaceholderPage />} />
            <Route path="config" element={<Configuracoes />} />
            <Route path="config/*" element={<PlaceholderPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
