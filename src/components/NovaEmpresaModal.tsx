import { useState } from "react";
import { Building2, Loader2, CheckCircle2, AlertCircle, Search, ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TextInput } from "@/components/inputs/TextInput";
import { DocumentInput } from "@/components/inputs/DocumentInput";
import { PhoneInput } from "@/components/inputs/PhoneInput";
import { CepInput } from "@/components/inputs/CepInput";
import { TextareaInput } from "@/components/inputs/TextareaInput";
import { FormModal } from "@/components/FormModal";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { refreshQueries } from "@/lib/query-refresh";

interface EmpresaForm {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  inscricao_estadual: string;
  inscricao_municipal: string;
  telefone: string;
  email: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  observacoes: string;
}

const initialForm: EmpresaForm = {
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  inscricao_estadual: "",
  inscricao_municipal: "",
  telefone: "",
  email: "",
  logradouro: "",
  bairro: "",
  cidade: "",
  estado: "",
  cep: "",
  observacoes: "",
};

type CnpjStatus = "idle" | "loading" | "valid" | "error";
type Step = "form" | "review";

interface NovaEmpresaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (empresaId: string) => void;
}

export function NovaEmpresaModal({ open, onOpenChange, onCreated }: NovaEmpresaModalProps) {
  const { user } = useAuth();
  const { refetch, selectEmpresa, empresas } = useEmpresa();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EmpresaForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cnpjStatus, setCnpjStatus] = useState<CnpjStatus>("idle");
  const [cnpjValidated, setCnpjValidated] = useState(false);
  const [step, setStep] = useState<Step>("form");

  const resetAll = () => {
    setForm(initialForm);
    setErrors({});
    setCnpjStatus("idle");
    setCnpjValidated(false);
    setSaving(false);
    setStep("form");
  };

  const handleOpenChange = (next: boolean) => {
    if (saving) return;
    if (!next) resetAll();
    onOpenChange(next);
  };

  const setField = (field: keyof EmpresaForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleInputChange =
    (field: keyof EmpresaForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setField(field, e.target.value);

  const handleValueChange = (field: keyof EmpresaForm) => (raw: string) =>
    setField(field, raw);

  const handleCnpjChange = (raw: string) => {
    setField("cnpj", raw);
    if (cnpjValidated) {
      setCnpjValidated(false);
      setCnpjStatus("idle");
      setErrors((prev) => {
        const next = { ...prev };
        delete next.cnpj;
        return next;
      });
    }
  };

  const checkDuplicateCnpj = async (cleanCnpj: string): Promise<boolean> => {
    // 1) Local check (companies already loaded)
    const local = empresas.find((e) => (e.cnpj ?? "").replace(/\D/g, "") === cleanCnpj);
    if (local) {
      toast.error("CNPJ já cadastrado", {
        description: `Esta empresa já está na sua lista (${local.nome_fantasia || local.razao_social}). Selecione-a no menu lateral.`,
        action: {
          label: "Selecionar",
          onClick: () => {
            selectEmpresa(local.id);
            handleOpenChange(false);
          },
        },
      });
      return true;
    }
    // 2) Remote check (other tenants / super admin scope)
    const { data } = await supabase
      .from("empresas")
      .select("id, razao_social, nome_fantasia, user_id")
      .eq("cnpj", cleanCnpj)
      .limit(1)
      .maybeSingle();
    if (data) {
      const isMine = data.user_id === user?.id;
      toast.error("CNPJ já cadastrado", {
        description: isMine
          ? `Esta empresa já existe na sua conta (${data.nome_fantasia || data.razao_social}).`
          : "Este CNPJ já está vinculado a outra conta na plataforma.",
      });
      return true;
    }
    return false;
  };

  const consultarCnpj = async () => {
    const cleanCnpj = form.cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) {
      setErrors((prev) => ({ ...prev, cnpj: "CNPJ deve ter 14 dígitos" }));
      return;
    }

    setCnpjStatus("loading");
    setErrors((prev) => {
      const next = { ...prev };
      delete next.cnpj;
      return next;
    });

    // Duplicate check before hitting Receita Federal
    const isDup = await checkDuplicateCnpj(cleanCnpj);
    if (isDup) {
      setCnpjStatus("error");
      setErrors((prev) => ({ ...prev, cnpj: "Este CNPJ já está cadastrado" }));
      setCnpjValidated(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("consulta-cnpj", {
        body: { cnpj: cleanCnpj },
      });

      if (error) throw new Error("Erro ao consultar CNPJ");

      if (data?.error) {
        setCnpjStatus("error");
        setErrors((prev) => ({ ...prev, cnpj: data.error }));
        setCnpjValidated(false);
        return;
      }

      setForm((prev) => ({
        ...prev,
        razao_social: data.razao_social || prev.razao_social,
        nome_fantasia: data.nome_fantasia || prev.nome_fantasia,
        telefone: data.telefone || prev.telefone,
        email: data.email?.toLowerCase() || prev.email,
        logradouro: data.logradouro || prev.logradouro,
        bairro: data.bairro || prev.bairro,
        cidade: data.cidade || prev.cidade,
        estado: data.estado || prev.estado,
        cep: data.cep || prev.cep,
      }));

      setCnpjStatus("valid");
      setCnpjValidated(true);
      toast.success("CNPJ ATIVO na Receita Federal", {
        description: "Dados preenchidos automaticamente.",
      });
    } catch {
      setCnpjStatus("error");
      setErrors((prev) => ({ ...prev, cnpj: "Erro ao consultar CNPJ na Receita Federal" }));
      setCnpjValidated(false);
    }
  };

  const handleCnpjBlur = () => {
    const cleanCnpj = form.cnpj.replace(/\D/g, "");
    if (cleanCnpj.length === 14 && !cnpjValidated && cnpjStatus !== "loading") consultarCnpj();
  };

  const validateForm = () => {
    const e: Record<string, string> = {};
    if (!form.cnpj.trim()) e.cnpj = "CNPJ é obrigatório";
    else if (!cnpjValidated) e.cnpj = "Valide o CNPJ na Receita Federal antes de continuar";
    if (!form.razao_social.trim()) e.razao_social = "Razão social é obrigatória";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "E-mail inválido";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goToReview = () => {
    if (!validateForm()) {
      toast.error("Revise os campos destacados antes de continuar");
      return;
    }
    setStep("review");
  };

  const handleSubmit = async () => {
    if (!cnpjValidated || !user) {
      toast.error("Valide o CNPJ antes de cadastrar");
      return;
    }
    setSaving(true);
    try {
      const cleanCnpj = form.cnpj.replace(/\D/g, "");
      // Re-check duplicates (race-safety)
      const isDup = await checkDuplicateCnpj(cleanCnpj);
      if (isDup) {
        setSaving(false);
        return;
      }

      const { data, error } = await supabase
        .from("empresas")
        .insert({
          user_id: user.id,
          razao_social: form.razao_social.trim(),
          nome_fantasia: form.nome_fantasia.trim() || null,
          cnpj: cleanCnpj,
          inscricao_estadual: form.inscricao_estadual.trim() || null,
          inscricao_municipal: form.inscricao_municipal.trim() || null,
          telefone: form.telefone.trim() || null,
          email: form.email.trim() || null,
          logradouro: form.logradouro.trim() || null,
          bairro: form.bairro.trim() || null,
          cidade: form.cidade.trim() || null,
          estado: form.estado.trim() || null,
          cep: form.cep.replace(/\D/g, "") || null,
          observacoes: form.observacoes.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Refresh empresas list, select new one and invalidate dependent caches
      await refetch();
      if (data?.id) {
        selectEmpresa(data.id);
        onCreated?.(data.id);
      }
      await refreshQueries(queryClient, [
        ["empresas"],
        ["user-permissions"],
        ["menus"],
        ["subscription"],
      ]);

      toast.success("Empresa cadastrada com sucesso!", {
        description: "Já está selecionada e pronta para uso.",
      });
      handleOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao cadastrar empresa");
    } finally {
      setSaving(false);
    }
  };

  const isFormDisabled = !cnpjValidated;
  const cleanCnpjLen = form.cnpj.replace(/\D/g, "").length;

  // -------- REVIEW STEP --------
  if (step === "review") {
    return (
      <FormModal
        open={open}
        onOpenChange={handleOpenChange}
        title="Revisar e confirmar"
        description="Confira os dados antes de cadastrar a empresa."
        size="xl"
        preventOutsideClose
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              CNPJ validado na Receita Federal. Revise os dados; após confirmar não será possível
              alterar o CNPJ deste registro.
            </div>
          </div>

          <ReviewSection title="Identificação">
            <ReviewItem label="CNPJ" value={formatCnpj(form.cnpj)} />
            <ReviewItem label="Razão Social" value={form.razao_social} />
            <ReviewItem label="Nome Fantasia" value={form.nome_fantasia} />
            <ReviewItem label="Inscrição Estadual" value={form.inscricao_estadual} />
            <ReviewItem label="Inscrição Municipal" value={form.inscricao_municipal} />
          </ReviewSection>

          <ReviewSection title="Contato">
            <ReviewItem label="Telefone" value={form.telefone} />
            <ReviewItem label="E-mail" value={form.email} />
          </ReviewSection>

          <ReviewSection title="Endereço">
            <ReviewItem label="Logradouro" value={form.logradouro} />
            <ReviewItem label="Bairro" value={form.bairro} />
            <ReviewItem label="Cidade / UF" value={[form.cidade, form.estado].filter(Boolean).join(" / ")} />
            <ReviewItem label="CEP" value={form.cep} />
          </ReviewSection>

          {form.observacoes && (
            <ReviewSection title="Observações">
              <p className="text-sm text-foreground whitespace-pre-wrap">{form.observacoes}</p>
            </ReviewSection>
          )}

          <div className="flex justify-between gap-2 pt-4 border-t border-border/30">
            <Button variant="ghost" onClick={() => setStep("form")} disabled={saving}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar e editar
            </Button>
            <Button onClick={handleSubmit} disabled={saving} className="min-w-[200px]">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Cadastrando...
                </>
              ) : (
                <>
                  <Building2 className="w-4 h-4 mr-2" />
                  Confirmar e Cadastrar
                </>
              )}
            </Button>
          </div>
        </div>
      </FormModal>
    );
  }

  // -------- FORM STEP --------
  return (
    <FormModal
      open={open}
      onOpenChange={handleOpenChange}
      title="Adicionar Nova Empresa"
      description="Informe o CNPJ para preenchimento automático pela Receita Federal."
      size="xl"
      preventOutsideClose
    >
      <div className="space-y-6">
        {/* STEP 1: CNPJ */}
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground">
            <Building2 className="w-4 h-4 text-primary" />
            1. Informe o CNPJ
          </h2>
          <div className="flex gap-3 items-start">
            <div className="flex-1">
              <DocumentInput
                label="CNPJ *"
                value={form.cnpj}
                onValueChange={handleCnpjChange}
                type="cnpj"
                error={errors.cnpj}
                onBlur={handleCnpjBlur}
              />
            </div>
            <div className="pt-7">
              <Button
                variant="outline"
                size="sm"
                onClick={consultarCnpj}
                disabled={cnpjStatus === "loading" || cleanCnpjLen !== 14}
                className="h-10 px-4"
              >
                {cnpjStatus === "loading" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span className="ml-2 hidden sm:inline">Consultar</span>
              </Button>
            </div>
          </div>

          {cnpjStatus === "valid" && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <Badge variant="outline" className="border-green-500/30 text-green-400 bg-green-500/10">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                CNPJ Ativo na Receita Federal
              </Badge>
            </div>
          )}

          {cnpjStatus === "error" && errors.cnpj && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <Badge variant="outline" className="border-destructive/30 text-destructive bg-destructive/10">
                <AlertCircle className="w-3 h-3 mr-1" />
                {errors.cnpj}
              </Badge>
            </div>
          )}
        </div>

        {/* STEP 2: Company details */}
        <div
          className={`transition-opacity duration-300 ${
            isFormDisabled ? "opacity-30 pointer-events-none select-none" : "opacity-100"
          }`}
        >
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground">
            <Building2 className="w-4 h-4 text-primary" />
            2. Dados da Empresa
            {isFormDisabled && (
              <span className="text-xs text-muted-foreground font-normal">(valide o CNPJ primeiro)</span>
            )}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <TextInput
                label="Razão Social *"
                value={form.razao_social}
                onChange={handleInputChange("razao_social")}
                error={errors.razao_social}
                className="uppercase"
              />
            </div>
            <TextInput label="Nome Fantasia" value={form.nome_fantasia} onChange={handleInputChange("nome_fantasia")} className="uppercase" />
            <TextInput label="Inscrição Estadual" value={form.inscricao_estadual} onChange={handleInputChange("inscricao_estadual")} />
            <TextInput label="Inscrição Municipal" value={form.inscricao_municipal} onChange={handleInputChange("inscricao_municipal")} />
            <PhoneInput label="Telefone" value={form.telefone} onValueChange={handleValueChange("telefone")} />
            <TextInput label="E-mail" value={form.email} onChange={handleInputChange("email")} error={errors.email} />
          </div>

          <h3 className="text-xs font-medium mt-6 mb-3 text-muted-foreground uppercase tracking-wide">
            Endereço
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <TextInput label="Logradouro" value={form.logradouro} onChange={handleInputChange("logradouro")} />
            </div>
            <TextInput label="Bairro" value={form.bairro} onChange={handleInputChange("bairro")} />
            <TextInput label="Cidade" value={form.cidade} onChange={handleInputChange("cidade")} />
            <TextInput label="Estado" value={form.estado} onChange={handleInputChange("estado")} />
            <CepInput
              label="CEP"
              value={form.cep}
              onValueChange={handleValueChange("cep")}
              onAddressFound={(addr) => {
                setForm((prev) => ({
                  ...prev,
                  logradouro: addr.logradouro,
                  bairro: addr.bairro,
                  cidade: addr.cidade,
                  estado: addr.estado,
                }));
              }}
            />
          </div>

          <div className="mt-4">
            <TextareaInput label="Observações" value={form.observacoes} onChange={handleInputChange("observacoes")} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border/30">
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={goToReview} disabled={isFormDisabled} className="min-w-[180px]">
            Revisar dados
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </FormModal>
  );
}

// ---------- helpers ----------

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{title}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">{children}</div>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">{label}</p>
      <p className="text-sm text-foreground truncate">{value || <span className="text-muted-foreground/60">—</span>}</p>
    </div>
  );
}

function formatCnpj(raw: string) {
  const c = raw.replace(/\D/g, "");
  if (c.length !== 14) return raw;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}
