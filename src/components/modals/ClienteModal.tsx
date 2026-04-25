import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/FormModal";
import { TextInput } from "@/components/inputs/TextInput";
import { TextareaInput } from "@/components/inputs/TextareaInput";
import { DocumentInput } from "@/components/inputs/DocumentInput";
import { PhoneInput } from "@/components/inputs/PhoneInput";
import { CepInput } from "@/components/inputs/CepInput";
import { useDocumentValidation } from "@/hooks/useDocumentValidation";
import { ManagedSelectInput } from "@/components/inputs/ManagedSelectInput";
import { useManagedSelect } from "@/hooks/useManagedSelect";
import {
  Building2, UserRound, Check, Loader2, Mail, MapPin, Home, Package,
} from "lucide-react";

export interface ClientePrefill {
  type?: "empresa" | "pessoa";
  nome?: string;
  cpfCnpj?: string;
  telefone?: string;
  email?: string;
  endereco?: { logradouro?: string; bairro?: string; cidade?: string; estado?: string; cep?: string };
}

interface ClienteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId?: string | null;
  onSaved?: (id: string) => void;
  prefill?: ClientePrefill | null;
}

interface ClienteForm {
  type: "empresa" | "pessoa";
  nome: string;
  cpfCnpj: string;
  telefone: string;
  email: string;
  observacoes: string;
  produto_segmento_id: string;
  endereco: { cep: string; logradouro: string; bairro: string; cidade: string; estado: string };
}

const initialForm: ClienteForm = {
  type: "empresa",
  nome: "",
  cpfCnpj: "",
  telefone: "",
  email: "",
  observacoes: "",
  produto_segmento_id: "",
  endereco: { cep: "", logradouro: "", bairro: "", cidade: "", estado: "" },
};

export function ClienteModal({ open, onOpenChange, editingId, onSaved, prefill }: ClienteModalProps) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const qc = useQueryClient();
  const [form, setForm] = useState<ClienteForm>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { validatingCnpj, cnpjError, cpfError, validateCpfField, validateCnpjField, clearErrors } = useDocumentValidation();

  const { data: existing } = useQuery({
    queryKey: ["cliente_edit", editingId],
    enabled: !!editingId && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").eq("id", editingId!).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existing && editingId) {
      setForm({
        type: existing.tipo === "pj" ? "empresa" : "pessoa",
        nome: existing.tipo === "pj" ? (existing.razao_social || "") : (existing.nome_completo || ""),
        cpfCnpj: existing.tipo === "pj" ? (existing.cnpj || "") : (existing.cpf || ""),
        telefone: existing.telefone || "",
        email: existing.email || "",
        observacoes: existing.observacoes || "",
        produto_segmento_id: (existing as any).produto_segmento_id || "",
        endereco: {
          cep: existing.cep || "",
          logradouro: existing.logradouro || "",
          bairro: existing.bairro || "",
          cidade: existing.cidade || "",
          estado: existing.estado || "",
        },
      });
    } else if (!editingId && open) {
      if (prefill) {
        setForm({
          ...initialForm,
          type: prefill.type || "empresa",
          nome: prefill.nome || "",
          cpfCnpj: prefill.cpfCnpj || "",
          telefone: prefill.telefone || "",
          email: prefill.email || "",
          endereco: {
            cep: prefill.endereco?.cep || "",
            logradouro: prefill.endereco?.logradouro || "",
            bairro: prefill.endereco?.bairro || "",
            cidade: prefill.endereco?.cidade || "",
            estado: prefill.endereco?.estado || "",
          },
        });
      } else {
        setForm(initialForm);
      }
      setErrors({});
      clearErrors();
    }
  }, [existing, editingId, open, prefill]);

  const update = (key: string, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const updateAddr = (key: string, value: string) =>
    setForm((p) => ({ ...p, endereco: { ...p.endereco, [key]: value } }));

  const handleCnpjBlur = async () => {
    if (form.type !== "empresa") return;
    const raw = form.cpfCnpj.replace(/\D/g, "");
    if (raw.length !== 14) return;

    const result = await validateCnpjField(raw);
    if (result.valid && result.data) {
      setForm((p) => ({
        ...p,
        nome: result.data!.razao_social || p.nome,
        endereco: {
          logradouro: result.data!.logradouro || p.endereco.logradouro,
          bairro: result.data!.bairro || p.endereco.bairro,
          cidade: result.data!.cidade || p.endereco.cidade,
          estado: result.data!.estado || p.endereco.estado,
          cep: result.data!.cep ? result.data!.cep.replace(/\D/g, "") : p.endereco.cep,
        },
      }));
      toast.success("Dados preenchidos automaticamente");
    }
  };

  const handleAddressFound = (addr: { logradouro: string; bairro: string; cidade: string; estado: string }) => {
    setForm((p) => ({ ...p, endereco: { ...p.endereco, ...addr } }));
    toast.success("Endereço preenchido");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const tipoDb = form.type === "empresa" ? "pj" as const : "pf" as const;
      const docRaw = form.cpfCnpj.replace(/\D/g, "");

      if (docRaw) {
        if (form.type === "pessoa") {
          if (!validateCpfField(docRaw)) throw new Error("CPF inválido");
        } else {
          const result = await validateCnpjField(docRaw);
          if (!result.valid) throw new Error("CNPJ inválido ou inativo");
        }
      }

      const payload: any = {
        tipo: tipoDb,
        nome_completo: form.type === "pessoa" ? form.nome : null,
        cpf: form.type === "pessoa" ? docRaw || null : null,
        razao_social: form.type === "empresa" ? (form.nome ? form.nome.toUpperCase() : null) : null,
        cnpj: form.type === "empresa" ? docRaw || null : null,
        telefone: form.telefone.replace(/\D/g, "") || null,
        email: form.email || null,
        logradouro: form.endereco.logradouro || null,
        bairro: form.endereco.bairro || null,
        cidade: form.endereco.cidade || null,
        estado: form.endereco.estado || null,
        cep: form.endereco.cep || null,
        observacoes: form.observacoes || null,
        produto_segmento_id: form.produto_segmento_id || null,
      };

      if (editingId) {
        const { error } = await supabase.from("clientes").update(payload).eq("id", editingId);
        if (error) throw error;
        return editingId;
      } else {
        const { data, error } = await supabase.from("clientes")
          .insert({ ...payload, user_id: user!.id, empresa_id: empresa?.id || null })
          .select("id").single();
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: async (id) => {
      qc.invalidateQueries({ queryKey: ["clientes"] });
      toast.success(editingId ? "Cliente atualizado" : "Cliente cadastrado");

      // Push to Asaas if integration is active and cliente has a charge linked there
      if (editingId && empresa?.id) {
        try {
          const { data: cred } = await supabase
            .from("integracoes_credenciais")
            .select("id")
            .eq("empresa_id", empresa.id)
            .eq("provider", "asaas")
            .eq("ativo", true)
            .maybeSingle();
          if (cred) {
            const { data: linked } = await supabase
              .from("asaas_cobrancas")
              .select("id")
              .eq("cliente_id", editingId)
              .limit(1)
              .maybeSingle();
            if (linked) {
              const { data: res, error: fnErr } = await supabase.functions.invoke("asaas-api", {
                body: { action: "update_customer", cliente_id: editingId, empresa_id: empresa.id },
              });
              if (fnErr || (res as any)?.error) {
                toast.warning(`Cliente salvo, mas falhou ao sincronizar com Asaas: ${(res as any)?.error || fnErr?.message}`);
              } else if (!(res as any)?.skipped) {
                toast.success("Cliente sincronizado com Asaas");
              }
            }
          }
        } catch (e) {
          console.warn("[ClienteModal] asaas sync failed:", e);
        }
      }

      onSaved?.(id);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar cliente"),
  });

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.nome.trim()) errs.nome = "Nome obrigatório";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    saveMutation.mutate();
  };

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={editingId ? "Editar Cliente" : "Novo Cliente"}
      description="CNPJ e CEP preenchem dados automaticamente."
      size="lg"
    >
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Tipo</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: "empresa" as const, label: "Empresa", icon: Building2 },
              { key: "pessoa" as const, label: "Pessoa Física", icon: UserRound },
            ]).map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" onClick={() => { update("type", key); setErrors({}); clearErrors(); }}
                className={`flex items-center gap-2.5 p-3 rounded-lg border-2 transition-all duration-200 ${form.type === key ? "border-primary bg-primary/5" : "border-border/50 hover:border-muted-foreground/30"}`}>
                <Icon className={`w-4 h-4 ${form.type === key ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-sm font-medium ${form.type === key ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                {form.type === key && <Check className="w-4 h-4 text-primary ml-auto" />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border/30" />
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-medium">
            Dados cadastrais {validatingCnpj && <Loader2 className="w-3 h-3 animate-spin text-primary inline ml-1" />}
          </span>
          <div className="h-px flex-1 bg-border/30" />
        </div>

        <DocumentInput
          type={form.type === "empresa" ? "cnpj" : "cpf"}
          value={form.cpfCnpj}
          onValueChange={(raw) => update("cpfCnpj", raw)}
          onBlur={form.type === "empresa" ? handleCnpjBlur : () => validateCpfField(form.cpfCnpj)}
          error={form.type === "empresa" ? cnpjError : cpfError}
        />

        <TextInput
          label={form.type === "empresa" ? "Razão Social" : "Nome completo"}
          placeholder={form.type === "empresa" ? "Razão social do cliente" : "Nome do cliente"}
          value={form.nome}
          onChange={(e) => update("nome", e.target.value)}
          error={errors.nome}
          className={form.type === "empresa" ? "uppercase" : ""}
        />

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border/30" />
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-medium">Contato</span>
          <div className="h-px flex-1 bg-border/30" />
        </div>

        <PhoneInput value={form.telefone} onValueChange={(raw) => update("telefone", raw)} />
        <TextInput label="Email" type="email" placeholder="email@exemplo.com" value={form.email} onChange={(e) => update("email", e.target.value)} icon={<Mail className="w-4 h-4" />} />

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border/30" />
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-medium">Endereço</span>
          <div className="h-px flex-1 bg-border/30" />
        </div>

        <CepInput value={form.endereco.cep} onValueChange={(raw) => updateAddr("cep", raw)} onAddressFound={handleAddressFound} />
        <TextInput label="Logradouro" placeholder="Rua, Avenida..." value={form.endereco.logradouro} onChange={(e) => updateAddr("logradouro", e.target.value)} icon={<Home className="w-4 h-4" />} />
        <div className="grid grid-cols-3 gap-3">
          <TextInput label="Bairro" placeholder="Bairro" value={form.endereco.bairro} onChange={(e) => updateAddr("bairro", e.target.value)} />
          <TextInput label="Cidade" placeholder="Cidade" value={form.endereco.cidade} onChange={(e) => updateAddr("cidade", e.target.value)} icon={<MapPin className="w-4 h-4" />} />
          <TextInput label="Estado" placeholder="UF" value={form.endereco.estado} onChange={(e) => updateAddr("estado", e.target.value)} maxLength={2} />
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border/30" />
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-medium">Extras</span>
          <div className="h-px flex-1 bg-border/30" />
        </div>

        <TextareaInput label="Observações" placeholder="Observações sobre o cliente..." value={form.observacoes} onChange={(e) => update("observacoes", e.target.value)} />

        <div className="flex justify-end gap-3 pt-3 border-t border-border/20">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg">Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saveMutation.isPending || validatingCnpj} className="rounded-lg gap-2 shadow-sm">
            {(saveMutation.isPending || validatingCnpj) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {editingId ? "Salvar Alterações" : "Salvar Cliente"}
          </Button>
        </div>
      </div>
    </FormModal>
  );
}
