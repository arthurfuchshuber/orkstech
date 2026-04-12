import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Mail, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ClienteVisaoGeralTab } from "@/components/clientes/ClienteVisaoGeralTab";
import { ClienteFinanceiroTab } from "@/components/clientes/ClienteFinanceiroTab";
import { ClienteDocumentosTab } from "@/components/clientes/ClienteDocumentosTab";
import { ClienteEditModal } from "@/components/clientes/ClienteEditModal";

const tabs = [
  { id: "visao-geral", label: "Visão Geral" },
  { id: "financeiro", label: "Financeiro" },
  { id: "documentos", label: "Documentos" },
];

function getInitial(name?: string | null) {
  return (name || "?").charAt(0).toUpperCase();
}

function formatDoc(tipo: string, cpf?: string | null, cnpj?: string | null) {
  if (tipo === "pf" && cpf) return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (tipo === "pj" && cnpj) return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return null;
}

export default function ClienteWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [showEdit, setShowEdit] = useState(false);

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["cliente", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-muted-foreground">Cliente não encontrado</p>
        <Button variant="outline" onClick={() => navigate("/app/clientes")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const nome = cliente.tipo === "pf"
    ? cliente.nome_completo
    : (cliente.nome_fantasia || cliente.razao_social);
  const doc = formatDoc(cliente.tipo, cliente.cpf, cliente.cnpj);
  const tags = (cliente as any).tags as string[] | null;
  const industry = tags && tags.length > 0 ? tags[0] : null;

  return (
    <div className="space-y-5 animate-fade-in max-w-7xl">
      {/* Back */}
      <button
        onClick={() => navigate("/app/clientes")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar para Clientes
      </button>

      {/* Header Card */}
      <Card className="p-6 border-border/50 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground text-xl font-bold shadow-lg">
              {getInitial(nome)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">{nome || "Sem nome"}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                {cliente.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> {cliente.email}
                  </span>
                )}
                {industry && (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> {industry}
                  </span>
                )}
                {doc && (
                  <span className="font-mono text-xs">{doc}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Health score placeholder */}
            <Badge
              variant={cliente.ativo ? "default" : "secondary"}
              className={`text-xs font-semibold px-3 py-1 rounded-full ${
                cliente.ativo
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {cliente.ativo ? "Ativo" : "Inativo"}
            </Badge>
            <Badge variant="outline" className="text-xs font-medium px-2.5 py-1">
              {cliente.tipo === "pf" ? "PF" : "PJ"}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Card className="border-border/50 shadow-sm">
        <div className="flex items-center justify-center gap-1 px-4 py-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isActive
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Tab content */}
      <div>
        {activeTab === "visao-geral" && (
          <ClienteVisaoGeralTab
            cliente={cliente}
            onEdit={() => setShowEdit(true)}
          />
        )}
        {activeTab === "financeiro" && <ClienteFinanceiroTab clienteId={cliente.id} />}
        {activeTab === "documentos" && <ClienteDocumentosTab clienteId={cliente.id} />}
      </div>

      {/* Edit modal */}
      <ClienteEditModal cliente={cliente} open={showEdit} onOpenChange={setShowEdit} />
    </div>
  );
}
