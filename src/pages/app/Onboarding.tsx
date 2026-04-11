import { useState } from "react";
import { Building2, Loader2, Zap } from "lucide-react";
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

export default function Onboarding() {
  const { user, signOut } = useAuth();
  const { refetch } = useEmpresa();
  const [form, setForm] = useState<EmpresaForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (field: keyof EmpresaForm) => (v: string) =>
    setForm((prev) => ({ ...prev, [field]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.razao_social.trim()) e.razao_social = "Razão social é obrigatória";
    if (!form.cnpj.trim()) e.cnpj = "CNPJ é obrigatório";
    else if (form.cnpj.replace(/\D/g, "").length !== 14) e.cnpj = "CNPJ inválido";
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
      toast.success("Empresa cadastrada com sucesso!");
      await refetch();
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar empresa");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Minimal header */}
      <header className="h-14 flex items-center justify-between border-b border-border/30 px-6 bg-background/80 backdrop-blur-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">NexusOS</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground text-xs">
          Sair
        </Button>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Bem-vindo ao NexusOS</h1>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Para começar, cadastre os dados da sua empresa. Isso é necessário para acessar todos os recursos do sistema.
            </p>
          </div>

          <Card className="p-6 border-border/50 bg-card">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Dados da Empresa
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <TextInput label="Razão Social *" value={form.razao_social} onChange={set("razao_social")} error={errors.razao_social} />
              </div>
              <TextInput label="Nome Fantasia" value={form.nome_fantasia} onChange={set("nome_fantasia")} />
              <DocumentInput label="CNPJ *" value={form.cnpj} onChange={set("cnpj")} type="cnpj" error={errors.cnpj} />
              <TextInput label="Inscrição Estadual" value={form.inscricao_estadual} onChange={set("inscricao_estadual")} />
              <TextInput label="Inscrição Municipal" value={form.inscricao_municipal} onChange={set("inscricao_municipal")} />
              <PhoneInput label="Telefone" value={form.telefone} onChange={set("telefone")} />
              <TextInput label="E-mail" value={form.email} onChange={set("email")} />
            </div>

            <h3 className="text-sm font-medium mt-6 mb-3 text-muted-foreground">Endereço</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <TextInput label="Logradouro" value={form.logradouro} onChange={set("logradouro")} />
              </div>
              <TextInput label="Bairro" value={form.bairro} onChange={set("bairro")} />
              <TextInput label="Cidade" value={form.cidade} onChange={set("cidade")} />
              <TextInput label="Estado" value={form.estado} onChange={set("estado")} />
              <CepInput label="CEP" value={form.cep} onChange={set("cep")} />
            </div>

            <div className="mt-4">
              <TextareaInput label="Observações" value={form.observacoes} onChange={set("observacoes")} />
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={handleSubmit} disabled={saving} className="min-w-[180px]">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Building2 className="w-4 h-4 mr-2" />}
                Cadastrar Empresa
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
