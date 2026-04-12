import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Building2, UserRound, Mail, Phone, MapPin, Edit, Paperclip,
  MessageSquare, DollarSign, Info, FileText, Clock, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { ClienteInfoTab } from "@/components/clientes/ClienteInfoTab";
import { ClienteDocumentosTab } from "@/components/clientes/ClienteDocumentosTab";
import { ClienteFinanceiroTab } from "@/components/clientes/ClienteFinanceiroTab";
import { ClienteHistoricoTab } from "@/components/clientes/ClienteHistoricoTab";
import { ClienteEditModal } from "@/components/clientes/ClienteEditModal";

const tabs = [
  { id: "info", label: "Informações", icon: Info },
  { id: "documentos", label: "Documentos", icon: FileText },
  { id: "financeiro", label: "Financeiro", icon: DollarSign },
  { id: "historico", label: "Histórico de CS", icon: Clock },
];

function formatDoc(tipo: string, cpf?: string | null, cnpj?: string | null) {
  if (tipo === "pf" && cpf) return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (tipo === "pj" && cnpj) return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return "—";
}

function formatPhone(phone?: string | null) {
  if (!phone) return null;
  const raw = phone.replace(/\D/g, "");
  if (raw.length === 11) return raw.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (raw.length === 10) return raw.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return phone;
}

export default function ClienteWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("info");
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

  const nome = cliente.tipo === "pf" ? cliente.nome_completo : (cliente.nome_fantasia || cliente.razao_social);
  const doc = formatDoc(cliente.tipo, cliente.cpf, cliente.cnpj);
  const phone = formatPhone(cliente.telefone);
  const location = cliente.cidade ? `${cliente.cidade}${cliente.estado ? `, ${cliente.estado}` : ""}` : null;

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/app/clientes")} className="gap-2 text-muted-foreground hover:text-foreground -ml-2">
        <ArrowLeft className="w-4 h-4" /> Clientes
      </Button>

      {/* Header */}
      <Card className="p-6 border-border/50 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            {/* Line 1 */}
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-foreground tracking-tight">{nome || "Sem nome"}</h1>
              <Badge variant="outline" className="text-xs font-medium">
                {cliente.tipo === "pf" ? <><UserRound className="w-3 h-3 mr-1" /> PF</> : <><Building2 className="w-3 h-3 mr-1" /> PJ</>}
              </Badge>
              <Badge variant={cliente.ativo ? "default" : "secondary"} className="text-xs">
                {cliente.ativo ? "Ativo" : "Inativo"}
              </Badge>
            </div>

            {/* Line 2 */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="font-mono">{doc}</span>
              {phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> {phone}
                </span>
              )}
              {cliente.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> {cliente.email}
                </span>
              )}
            </div>

            {/* Line 3 */}
            {location && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" /> {location}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2 rounded-lg" onClick={() => setShowEdit(true)}>
              <Edit className="w-3.5 h-3.5" /> Editar
            </Button>
            <Button variant="outline" size="sm" className="gap-2 rounded-lg" onClick={() => setActiveTab("documentos")}>
              <Paperclip className="w-3.5 h-3.5" /> Anexar
            </Button>
            <Button variant="outline" size="sm" className="gap-2 rounded-lg" onClick={() => setActiveTab("historico")}>
              <MessageSquare className="w-3.5 h-3.5" /> Interação
            </Button>
            <Button variant="outline" size="sm" className="gap-2 rounded-lg" onClick={() => setActiveTab("financeiro")}>
              <DollarSign className="w-3.5 h-3.5" /> Financeiro
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border/30 pb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors relative
                ${isActive
                  ? "text-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "info" && <ClienteInfoTab cliente={cliente} />}
        {activeTab === "documentos" && <ClienteDocumentosTab clienteId={cliente.id} />}
        {activeTab === "financeiro" && <ClienteFinanceiroTab clienteId={cliente.id} />}
        {activeTab === "historico" && <ClienteHistoricoTab clienteId={cliente.id} />}
      </div>

      {/* Edit modal */}
      <ClienteEditModal cliente={cliente} open={showEdit} onOpenChange={setShowEdit} />
    </div>
  );
}
