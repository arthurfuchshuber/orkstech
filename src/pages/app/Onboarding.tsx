import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Loader2, CheckCircle2, AlertCircle, Search } from "lucide-react";
import orksLogo from "@/assets/orks-icon.png";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextInput } from "@/components/inputs/TextInput";
import { DocumentInput } from "@/components/inputs/DocumentInput";
import { PhoneInput } from "@/components/inputs/PhoneInput";
import { CepInput } from "@/components/inputs/CepInput";
import { TextareaInput } from "@/components/inputs/TextareaInput";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

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

export default function Onboarding() {
  const { user, signOut } = useAuth();
  const { refetch } = useEmpresa();
  const navigate = useNavigate();
  const [form, setForm] = useState<EmpresaForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cnpjStatus, setCnpjStatus] = useState<CnpjStatus>("idle");
  const [cnpjValidated, setCnpjValidated] = useState(false);

  const setField = (field: keyof EmpresaForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleInputChange = (field: keyof EmpresaForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setField(field, e.target.value);

  const handleValueChange = (field: keyof EmpresaForm) => (raw: string, _formatted: string) =>
    setField(field, raw);

  const handleCnpjChange = (raw: string, _formatted: string) => {
    setField("cnpj", raw);
    // Reset validation when CNPJ changes
    if (cnpjValidated) {
      setCnpjValidated(false);
      setCnpjStatus("idle");
      setErrors((prev) => {
        const { cnpj, ...rest } = prev;
        return rest;
      });
    }
  };

  const consultarCnpj = async () => {
    const cleanCnpj = form.cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) {
      setErrors((prev) => ({ ...prev, cnpj: "CNPJ deve ter 14 dígitos" }));
      return;
    }

    setCnpjStatus("loading");
    setErrors((prev) => {
      const { cnpj, ...rest } = prev;
      return rest;
    });

    try {
      const { data, error } = await supabase.functions.invoke("consulta-cnpj", {
        body: { cnpj: cleanCnpj },
      });

      if (error) throw new Error("Erro ao consultar CNPJ");

      if (data.error) {
        setCnpjStatus("error");
        setErrors((prev) => ({ ...prev, cnpj: data.error }));
        setCnpjValidated(false);
        return;
      }

      // Auto-fill form with data from Receita Federal
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
      toast.success("CNPJ validado! Dados preenchidos automaticamente.");
    } catch (err: any) {
      setCnpjStatus("error");
      setErrors((prev) => ({ ...prev, cnpj: "Erro ao consultar CNPJ na Receita Federal" }));
      setCnpjValidated(false);
    }
  };

  const handleCnpjBlur = () => {
    const cleanCnpj = form.cnpj.replace(/\D/g, "");
    if (cleanCnpj.length === 14 && !cnpjValidated) {
      consultarCnpj();
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.cnpj.trim()) e.cnpj = "CNPJ é obrigatório";
    else if (!cnpjValidated) e.cnpj = "Valide o CNPJ antes de continuar";
    if (!form.razao_social.trim()) e.razao_social = "Razão social é obrigatória";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("empresas").insert({
        user_id: user.id,
        razao_social: form.razao_social.trim(),
        nome_fantasia: form.nome_fantasia.trim() || null,
        cnpj: form.cnpj.replace(/\D/g, ""),
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
      });
      if (error) throw error;
      toast.success("Empresa cadastrada! Agora escolha seu plano.");
      await refetch();
      navigate("/app/config/assinatura", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar empresa");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  const isFormDisabled = !cnpjValidated;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-14 flex items-center justify-between border-b border-border/30 px-6 bg-background/80 backdrop-blur-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden ring-1 ring-border/40">
            <img src={orksLogo} alt="Orks" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-tight text-foreground">Orks</span>
            <span className="text-[10px] text-muted-foreground tracking-wider uppercase">Gestão 360º</span>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground text-xs">
          Sair
        </Button>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Bem-vindo ao Orks</h1>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Para começar, informe o CNPJ da sua empresa. Os dados serão preenchidos automaticamente pela Receita Federal.
            </p>
          </div>

          <Card className="p-6 border-border/50 bg-card">
            {/* STEP 1: CNPJ First */}
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
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
                  disabled={cnpjStatus === "loading" || form.cnpj.replace(/\D/g, "").length !== 14}
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

            {/* STEP 2: Company details (only after CNPJ validated) */}
            <div className={`mt-8 transition-opacity duration-300 ${isFormDisabled ? "opacity-30 pointer-events-none select-none" : "opacity-100"}`}>
              <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                2. Dados da Empresa
                {isFormDisabled && <span className="text-xs text-muted-foreground font-normal">(valide o CNPJ primeiro)</span>}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <TextInput label="Razão Social *" value={form.razao_social} onChange={handleInputChange("razao_social")} error={errors.razao_social} className="uppercase" />
                </div>
                <TextInput label="Nome Fantasia" value={form.nome_fantasia} onChange={handleInputChange("nome_fantasia")} className="uppercase" />
                <TextInput label="Inscrição Estadual" value={form.inscricao_estadual} onChange={handleInputChange("inscricao_estadual")} />
                <TextInput label="Inscrição Municipal" value={form.inscricao_municipal} onChange={handleInputChange("inscricao_municipal")} />
                <PhoneInput label="Telefone" value={form.telefone} onValueChange={handleValueChange("telefone")} />
                <TextInput label="E-mail" value={form.email} onChange={handleInputChange("email")} />
              </div>

              <h3 className="text-sm font-medium mt-6 mb-3 text-muted-foreground">Endereço</h3>
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

              <div className="mt-6 flex justify-end">
                <Button onClick={handleSubmit} disabled={saving || isFormDisabled} className="min-w-[180px]">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Building2 className="w-4 h-4 mr-2" />}
                  Cadastrar Empresa
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
