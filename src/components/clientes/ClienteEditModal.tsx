import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Building2, UserRound, Mail, Home, MapPin, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/FormModal";
import { DocumentInput } from "@/components/inputs/DocumentInput";
import { PhoneInput } from "@/components/inputs/PhoneInput";
import { CepInput } from "@/components/inputs/CepInput";
import { TextInput } from "@/components/inputs/TextInput";
import { TextareaInput } from "@/components/inputs/TextareaInput";
import { ManagedSelectInput } from "@/components/inputs/ManagedSelectInput";
import { useManagedSelect } from "@/hooks/useManagedSelect";
import { useEmpresa } from "@/hooks/useEmpresa";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDocumentValidation } from "@/hooks/useDocumentValidation";
import { useAuth } from "@/hooks/useAuth";
import { logClienteUpdated } from "@/lib/cliente-history";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  cliente: Tables<"clientes">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClienteEditModal({ cliente, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const { validatingCnpj, cnpjError, cpfError, validateCpfField, validateCnpjField, clearErrors } = useDocumentValidation();
  const [productError, setProductError] = useState<string | undefined>();

  const produtosCRUD = useManagedSelect("cliente_produtos", {
    insertDefaults: { empresa_id: empresa?.id || null },
  });

  const { data: produtosOptions = [] } = useQuery({
    queryKey: ["cliente-produtos", empresa?.id],
    enabled: open && !!user,
    queryFn: async () => {
      let query = supabase
        .from("cliente_produtos" as any)
        .select("id, nome")
        .eq("ativo", true);
      if (empresa?.id) {
        query = query.eq("empresa_id", empresa.id);
      } else {
        query = query.is("empresa_id", null);
      }
      const { data, error } = await query
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true });
      if (error) throw error;
      return ((data as any[]) || []).map((r) => ({ value: r.id, label: r.nome }));
    },
  });

  const [tipo, setTipo] = useState<"pf" | "pj">(cliente.tipo);
  const [form, setForm] = useState({
    nome_completo: cliente.nome_completo || "",
    cpf: cliente.cpf || "",
    razao_social: cliente.razao_social || "",
    nome_fantasia: cliente.nome_fantasia || "",
    cnpj: cliente.cnpj || "",
    inscricao_estadual: cliente.inscricao_estadual || "",
    inscricao_municipal: cliente.inscricao_municipal || "",
    telefone: cliente.telefone || "",
    whatsapp: cliente.whatsapp || "",
    email: cliente.email || "",
    logradouro: cliente.logradouro || "",
    numero: cliente.numero || "",
    complemento: cliente.complemento || "",
    bairro: cliente.bairro || "",
    cidade: cliente.cidade || "",
    estado: cliente.estado || "",
    cep: cliente.cep || "",
    responsavel_interno: cliente.responsavel_interno || "",
    observacoes: cliente.observacoes || "",
    produto_segmento_id: (cliente as any).produto_segmento_id || "",
  });

  useEffect(() => {
    if (open) {
      setTipo(cliente.tipo);
      setForm({
        nome_completo: cliente.nome_completo || "",
        cpf: cliente.cpf || "",
        razao_social: cliente.razao_social || "",
        nome_fantasia: cliente.nome_fantasia || "",
        cnpj: cliente.cnpj || "",
        inscricao_estadual: cliente.inscricao_estadual || "",
        inscricao_municipal: cliente.inscricao_municipal || "",
        telefone: cliente.telefone || "",
        whatsapp: cliente.whatsapp || "",
        email: cliente.email || "",
        logradouro: cliente.logradouro || "",
        numero: cliente.numero || "",
        complemento: cliente.complemento || "",
        bairro: cliente.bairro || "",
        cidade: cliente.cidade || "",
        estado: cliente.estado || "",
        cep: cliente.cep || "",
        responsavel_interno: cliente.responsavel_interno || "",
        observacoes: cliente.observacoes || "",
      });
      clearErrors();
    }
  }, [open, cliente]);

  const mutation = useMutation({
    mutationFn: async () => {
      // Validate documents before saving
      if (tipo === "pf") {
        const rawCpf = form.cpf.replace(/\D/g, "");
        if (rawCpf && !validateCpfField(rawCpf)) {
          throw new Error("CPF inválido");
        }
      } else {
        const rawCnpj = form.cnpj.replace(/\D/g, "");
        if (rawCnpj) {
          const result = await validateCnpjField(rawCnpj);
          if (!result.valid) {
            throw new Error("CNPJ inválido ou inativo");
          }
        }
      }

      const update: any = {
        tipo,
        telefone: form.telefone.replace(/\D/g, "") || null,
        whatsapp: form.whatsapp.replace(/\D/g, "") || null,
        email: form.email || null,
        logradouro: form.logradouro || null,
        numero: form.numero || null,
        complemento: form.complemento || null,
        bairro: form.bairro || null,
        cidade: form.cidade || null,
        estado: form.estado || null,
        cep: form.cep || null,
        responsavel_interno: form.responsavel_interno || null,
        observacoes: form.observacoes || null,
      };
      if (tipo === "pf") {
        update.nome_completo = form.nome_completo || null;
        update.cpf = form.cpf.replace(/\D/g, "") || null;
      } else {
        update.razao_social = form.razao_social ? form.razao_social.toUpperCase() : null;
        update.nome_fantasia = form.nome_fantasia ? form.nome_fantasia.toUpperCase() : null;
        update.cnpj = form.cnpj.replace(/\D/g, "") || null;
        update.inscricao_estadual = form.inscricao_estadual || null;
        update.inscricao_municipal = form.inscricao_municipal || null;
      }
      // Detect changed fields for richer history log
      const changed: string[] = [];
      const fieldLabels: Record<string, string> = {
        nome_completo: "Nome", cpf: "CPF", razao_social: "Razão Social",
        nome_fantasia: "Nome Fantasia", cnpj: "CNPJ", telefone: "Telefone",
        whatsapp: "WhatsApp", email: "E-mail", logradouro: "Endereço",
        cep: "CEP", responsavel_interno: "Responsável", observacoes: "Observações",
      };
      for (const [key, label] of Object.entries(fieldLabels)) {
        const newVal = (update as any)[key];
        const oldVal = (cliente as any)[key];
        if ((newVal || "") !== (oldVal || "")) changed.push(label);
      }

      const { error } = await supabase.from("clientes").update(update).eq("id", cliente.id);
      if (error) throw error;

      if (user && changed.length > 0) {
        await logClienteUpdated({
          clienteId: cliente.id,
          userId: user.id,
          empresaId: cliente.empresa_id,
          changedFields: changed,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente", cliente.id] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["cliente-interacoes", cliente.id] });
      toast.success("Cliente atualizado");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar"),
  });

  const handleCnpjBlur = async () => {
    const rawCnpj = form.cnpj.replace(/\D/g, "");
    if (rawCnpj.length === 14) {
      const result = await validateCnpjField(rawCnpj);
      if (result.valid && result.data) {
        setForm((prev) => ({
          ...prev,
          razao_social: result.data!.razao_social || prev.razao_social,
          nome_fantasia: result.data!.nome_fantasia || prev.nome_fantasia,
          logradouro: result.data!.logradouro || prev.logradouro,
          bairro: result.data!.bairro || prev.bairro,
          cidade: result.data!.cidade || prev.cidade,
          estado: result.data!.estado || prev.estado,
          cep: result.data!.cep || prev.cep,
        }));
        toast.success("Dados preenchidos automaticamente");
      }
    }
  };

  const handleAddressFound = (address: { logradouro: string; bairro: string; cidade: string; estado: string }) => {
    setForm((prev) => ({ ...prev, ...address }));
    toast.success("Endereço preenchido");
  };

  return (
    <FormModal open={open} onOpenChange={onOpenChange} title="Editar Cliente" size="xl">
      <div className="space-y-6">
        {/* Tipo de cliente */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Tipo de cliente</label>
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: "pf" as const, label: "Pessoa Física", sub: "CPF", icon: UserRound },
              { key: "pj" as const, label: "Pessoa Jurídica", sub: "CNPJ", icon: Building2 },
            ]).map(({ key, label, sub, icon: Icon }) => (
              <button key={key} type="button" onClick={() => { setTipo(key); clearErrors(); }}
                className={`flex items-center gap-3 p-3.5 rounded-lg border-2 transition-all duration-200 ${tipo === key ? "border-primary bg-primary/5" : "border-border/50 hover:border-muted-foreground/30"}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tipo === key ? "bg-primary/15" : "bg-muted/50"}`}>
                  <Icon className={`w-4 h-4 ${tipo === key ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="text-left">
                  <p className={`text-sm font-medium ${tipo === key ? "text-foreground" : "text-muted-foreground"}`}>{label}</p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
                {tipo === key && <Check className="w-4 h-4 text-primary ml-auto" />}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-border/30" />

        {tipo === "pf" ? (
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dados pessoais</p>
            <div className="grid grid-cols-2 gap-4">
              <TextInput label="Nome completo" value={form.nome_completo} onChange={(e) => setForm((p) => ({ ...p, nome_completo: e.target.value }))} icon={<UserRound className="w-4 h-4" />} />
              <DocumentInput type="cpf" value={form.cpf} onValueChange={(v) => setForm((p) => ({ ...p, cpf: v }))} error={cpfError} onBlur={() => validateCpfField(form.cpf)} />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Dados da empresa {validatingCnpj && <Loader2 className="w-3 h-3 animate-spin text-primary inline ml-1" />}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <DocumentInput type="cnpj" value={form.cnpj} onValueChange={(v) => setForm((p) => ({ ...p, cnpj: v }))} error={cnpjError} onBlur={handleCnpjBlur} />
              <TextInput label="Razão Social" value={form.razao_social} onChange={(e) => setForm((p) => ({ ...p, razao_social: e.target.value }))} icon={<Building2 className="w-4 h-4" />} className="uppercase" />
              <TextInput label="Nome Fantasia" value={form.nome_fantasia} onChange={(e) => setForm((p) => ({ ...p, nome_fantasia: e.target.value }))} className="uppercase" />
              <TextInput label="Inscrição Estadual" value={form.inscricao_estadual} onChange={(e) => setForm((p) => ({ ...p, inscricao_estadual: e.target.value }))} />
              <TextInput label="Inscrição Municipal" value={form.inscricao_municipal} onChange={(e) => setForm((p) => ({ ...p, inscricao_municipal: e.target.value }))} />
            </div>
          </div>
        )}

        <div className="h-px bg-border/30" />

        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contato</p>
          <div className="grid grid-cols-2 gap-4">
            <PhoneInput label="Telefone" value={form.telefone} onValueChange={(v) => setForm((p) => ({ ...p, telefone: v }))} />
            <PhoneInput label="WhatsApp" value={form.whatsapp} onValueChange={(v) => setForm((p) => ({ ...p, whatsapp: v }))} />
            <TextInput label="Email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} icon={<Mail className="w-4 h-4" />} />
          </div>
        </div>

        <div className="h-px bg-border/30" />

        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Endereço</p>
          <div className="grid grid-cols-3 gap-4">
            <CepInput value={form.cep} onValueChange={(v) => setForm((p) => ({ ...p, cep: v }))} onAddressFound={handleAddressFound} />
            <TextInput label="Logradouro" value={form.logradouro} onChange={(e) => setForm((p) => ({ ...p, logradouro: e.target.value }))} icon={<Home className="w-4 h-4" />} />
            <TextInput label="Número" value={form.numero} onChange={(e) => setForm((p) => ({ ...p, numero: e.target.value }))} />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <TextInput label="Complemento" value={form.complemento} onChange={(e) => setForm((p) => ({ ...p, complemento: e.target.value }))} />
            <TextInput label="Bairro" value={form.bairro} onChange={(e) => setForm((p) => ({ ...p, bairro: e.target.value }))} />
            <TextInput label="Cidade" value={form.cidade} onChange={(e) => setForm((p) => ({ ...p, cidade: e.target.value }))} icon={<MapPin className="w-4 h-4" />} />
            <TextInput label="Estado" value={form.estado} onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value }))} />
          </div>
        </div>

        <div className="h-px bg-border/30" />

        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Informações internas</p>
          <TextInput label="Responsável interno" value={form.responsavel_interno} onChange={(e) => setForm((p) => ({ ...p, responsavel_interno: e.target.value }))} />
          <TextareaInput label="Observações" value={form.observacoes} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} />
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg">Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || validatingCnpj} className="rounded-lg gap-2 shadow-sm">
            {(mutation.isPending || validatingCnpj) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Salvar
          </Button>
        </div>
      </div>
    </FormModal>
  );
}
