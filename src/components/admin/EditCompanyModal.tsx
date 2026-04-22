import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDocumentValidation } from "@/hooks/useDocumentValidation";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/inputs/TextInput";
import { TextareaInput } from "@/components/inputs/TextareaInput";
import { DocumentInput } from "@/components/inputs/DocumentInput";
import { PhoneInput } from "@/components/inputs/PhoneInput";
import { CepInput } from "@/components/inputs/CepInput";
import { Building2, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface Company {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  email: string | null;
  telefone: string | null;
  inscricao_estadual?: string | null;
  inscricao_municipal?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  observacoes?: string | null;
}

interface Props {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditCompanyModal({ company, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { validatingCnpj, cnpjError, validateCnpjField, setCnpjError } = useDocumentValidation();
  const [form, setForm] = useState<Company>({
    id: "",
    razao_social: "",
    nome_fantasia: "",
    cnpj: "",
    email: "",
    telefone: "",
    inscricao_estadual: "",
    inscricao_municipal: "",
    cep: "",
    logradouro: "",
    bairro: "",
    cidade: "",
    estado: "",
    observacoes: "",
  });
  const [originalCnpj, setOriginalCnpj] = useState("");

  useEffect(() => {
    if (company) {
      setForm({ ...company });
      setOriginalCnpj((company.cnpj || "").replace(/\D/g, ""));
      setCnpjError("");
    }
  }, [company, setCnpjError]);

  const update = (field: keyof Company, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.razao_social.trim()) throw new Error("Razão social é obrigatória");
      const cnpjDigits = (form.cnpj || "").replace(/\D/g, "");
      if (cnpjDigits.length !== 14) throw new Error("CNPJ incompleto");

      // Só revalida na Receita se o CNPJ mudou
      if (cnpjDigits !== originalCnpj) {
        const result = await validateCnpjField(cnpjDigits);
        if (!result.valid) {
          throw new Error("CNPJ inválido ou inativo na Receita Federal");
        }
      }

      const { error } = await supabase.functions.invoke("admin-dashboard", {
        body: {
          action: "update_company",
          empresa_id: form.id,
          razao_social: form.razao_social.trim().toUpperCase(),
          nome_fantasia: form.nome_fantasia?.trim().toUpperCase() || null,
          cnpj: cnpjDigits,
          email: form.email?.trim() || null,
          telefone: form.telefone?.replace(/\D/g, "") || null,
          inscricao_estadual: form.inscricao_estadual?.trim() || null,
          inscricao_municipal: form.inscricao_municipal?.trim() || null,
          cep: form.cep?.replace(/\D/g, "") || null,
          logradouro: form.logradouro?.trim() || null,
          bairro: form.bairro?.trim() || null,
          cidade: form.cidade?.trim() || null,
          estado: form.estado?.trim().toUpperCase() || null,
          observacoes: form.observacoes?.trim() || null,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Empresa atualizada com sucesso");
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!company) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span>Editar empresa</span>
              <span className="text-xs font-normal text-muted-foreground">{company.razao_social}</span>
            </div>
          </DialogTitle>
          <DialogDescription className="text-xs sr-only">
            Edite os dados cadastrais da empresa. O CNPJ será revalidado se alterado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
            <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              Alterações afetam diretamente os usuários da empresa. O CNPJ deve estar <strong>ativo na Receita Federal</strong>.
            </span>
          </div>

          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Identificação</p>
            <DocumentInput
              type="cnpj"
              value={form.cnpj}
              onValueChange={(raw) => update("cnpj", raw)}
              error={cnpjError || undefined}
              label={`CNPJ ${validatingCnpj ? "(validando...)" : ""}`}
            />
            <TextInput
              label="Razão Social *"
              value={form.razao_social}
              onChange={(e) => update("razao_social", e.target.value)}
              maxLength={120}
            />
            <TextInput
              label="Nome Fantasia"
              value={form.nome_fantasia || ""}
              onChange={(e) => update("nome_fantasia", e.target.value)}
              maxLength={120}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextInput
                label="Inscrição Estadual"
                value={form.inscricao_estadual || ""}
                onChange={(e) => update("inscricao_estadual", e.target.value)}
                maxLength={20}
              />
              <TextInput
                label="Inscrição Municipal"
                value={form.inscricao_municipal || ""}
                onChange={(e) => update("inscricao_municipal", e.target.value)}
                maxLength={20}
              />
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Contato</p>
            <div className="grid grid-cols-2 gap-3">
              <TextInput
                label="E-mail"
                type="email"
                value={form.email || ""}
                onChange={(e) => update("email", e.target.value)}
                maxLength={120}
              />
              <PhoneInput
                value={form.telefone || ""}
                onValueChange={(raw) => update("telefone", raw)}
              />
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Endereço</p>
            <div className="grid grid-cols-3 gap-3">
              <CepInput
                value={form.cep || ""}
                onValueChange={(raw) => update("cep", raw)}
                onAddressFound={(addr) => {
                  setForm((p) => ({
                    ...p,
                    logradouro: addr.logradouro,
                    bairro: addr.bairro,
                    cidade: addr.cidade,
                    estado: addr.estado,
                  }));
                }}
              />
              <div className="col-span-2">
                <TextInput
                  label="Logradouro"
                  value={form.logradouro || ""}
                  onChange={(e) => update("logradouro", e.target.value)}
                  maxLength={120}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <TextInput
                label="Bairro"
                value={form.bairro || ""}
                onChange={(e) => update("bairro", e.target.value)}
                maxLength={60}
              />
              <TextInput
                label="Cidade"
                value={form.cidade || ""}
                onChange={(e) => update("cidade", e.target.value)}
                maxLength={60}
              />
              <TextInput
                label="UF"
                value={form.estado || ""}
                onChange={(e) => update("estado", e.target.value.toUpperCase().slice(0, 2))}
                maxLength={2}
              />
            </div>
          </section>

          <section className="space-y-3">
            <TextareaInput
              label="Observações"
              value={form.observacoes || ""}
              onChange={(e) => update("observacoes", e.target.value)}
              rows={3}
              maxLength={500}
            />
          </section>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/50 bg-muted/10">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={save.isPending || validatingCnpj}
            onClick={() => save.mutate()}
          >
            {(save.isPending || validatingCnpj) && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
