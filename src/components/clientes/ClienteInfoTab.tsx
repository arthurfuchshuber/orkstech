import { Card } from "@/components/ui/card";
import { UserRound, Building2, Mail, Phone, MapPin, Calendar, FileText, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  cliente: Tables<"clientes">;
}

function InfoItem({ label, value, icon: Icon }: { label: string; value?: string | null; icon?: any }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground/60" />}
        <p className="text-sm text-foreground">{value || "—"}</p>
      </div>
    </div>
  );
}

export function ClienteInfoTab({ cliente }: Props) {
  const isPF = cliente.tipo === "pf";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Identificação */}
      <Card className="p-5 border-border/50 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          {isPF ? <UserRound className="w-4 h-4 text-primary" /> : <Building2 className="w-4 h-4 text-primary" />}
          Identificação
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <InfoItem label="Tipo" value={isPF ? "Pessoa Física" : "Pessoa Jurídica"} />
          {isPF ? (
            <>
              <InfoItem label="Nome" value={cliente.nome_completo} />
              <InfoItem label="CPF" value={cliente.cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")} />
              <InfoItem
                label="Data de nascimento"
                value={cliente.data_nascimento ? format(new Date(cliente.data_nascimento), "dd/MM/yyyy", { locale: ptBR }) : null}
                icon={Calendar}
              />
            </>
          ) : (
            <>
              <InfoItem label="Razão Social" value={cliente.razao_social} />
              <InfoItem label="Nome Fantasia" value={cliente.nome_fantasia} />
              <InfoItem label="CNPJ" value={cliente.cnpj?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")} />
              <InfoItem label="Inscrição Estadual" value={cliente.inscricao_estadual} />
              <InfoItem label="Inscrição Municipal" value={cliente.inscricao_municipal} />
            </>
          )}
          <InfoItem
            label="Data de cadastro"
            value={format(new Date(cliente.created_at), "dd/MM/yyyy", { locale: ptBR })}
            icon={Calendar}
          />
        </div>
      </Card>

      {/* Contato */}
      <Card className="p-5 border-border/50 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Phone className="w-4 h-4 text-primary" />
          Contato
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <InfoItem label="Email" value={cliente.email} icon={Mail} />
          <InfoItem
            label="Telefone"
            value={cliente.telefone ? cliente.telefone.replace(/(\d{2})(\d{4,5})(\d{4})/, "($1) $2-$3") : null}
            icon={Phone}
          />
          <InfoItem
            label="WhatsApp"
            value={(cliente as any).whatsapp ? (cliente as any).whatsapp.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3") : null}
            icon={MessageSquare}
          />
        </div>
      </Card>

      {/* Endereço */}
      <Card className="p-5 border-border/50 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          Endereço
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <InfoItem label="CEP" value={cliente.cep?.replace(/(\d{5})(\d{3})/, "$1-$2")} />
          <InfoItem label="Logradouro" value={cliente.logradouro} />
          <InfoItem label="Número" value={(cliente as any).numero} />
          <InfoItem label="Complemento" value={(cliente as any).complemento} />
          <InfoItem label="Bairro" value={cliente.bairro} />
          <InfoItem label="Cidade" value={cliente.cidade} icon={MapPin} />
          <InfoItem label="Estado" value={cliente.estado} />
        </div>
      </Card>

      {/* Informações internas */}
      <Card className="p-5 border-border/50 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Informações Internas
        </h3>
        <div className="grid grid-cols-1 gap-4">
          <InfoItem label="Responsável interno" value={(cliente as any).responsavel_interno} />
          <InfoItem
            label="Tags"
            value={
              (cliente as any).tags && (cliente as any).tags.length > 0
                ? (cliente as any).tags.join(", ")
                : null
            }
          />
          <InfoItem label="Observações" value={cliente.observacoes} />
        </div>
      </Card>
    </div>
  );
}
