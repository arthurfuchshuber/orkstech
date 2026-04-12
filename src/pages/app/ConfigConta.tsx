import { useState } from "react";
import { Building2, Users, Shield } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


/* ─── Tab: Empresa ─── */
function EmpresaTab() {
  const { empresa, loading, refetch } = useEmpresa();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const isEditing = Object.keys(form).length > 0;

  const startEdit = () => {
    if (!empresa) return;
    setForm({
      razao_social: empresa.razao_social ?? "",
      nome_fantasia: empresa.nome_fantasia ?? "",
      cnpj: empresa.cnpj ?? "",
      email: empresa.email ?? "",
      telefone: empresa.telefone ?? "",
      cep: empresa.cep ?? "",
      logradouro: empresa.logradouro ?? "",
      bairro: empresa.bairro ?? "",
      cidade: empresa.cidade ?? "",
      estado: empresa.estado ?? "",
      inscricao_estadual: empresa.inscricao_estadual ?? "",
      inscricao_municipal: empresa.inscricao_municipal ?? "",
    });
  };

  const handleSave = async () => {
    if (!empresa) return;
    setSaving(true);
    const { error } = await supabase
      .from("empresas")
      .update({
        razao_social: form.razao_social,
        nome_fantasia: form.nome_fantasia,
        cnpj: form.cnpj,
        email: form.email,
        telefone: form.telefone,
        cep: form.cep,
        logradouro: form.logradouro,
        bairro: form.bairro,
        cidade: form.cidade,
        estado: form.estado,
        inscricao_estadual: form.inscricao_estadual,
        inscricao_municipal: form.inscricao_municipal,
      })
      .eq("id", empresa.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Dados da empresa atualizados");
      setForm({});
      await refetch();
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>;
  if (!empresa) return <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma empresa cadastrada.</p>;

  const val = (field: string) => isEditing ? (form[field] ?? "") : (empresa[field] ?? "—");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Dados cadastrais da empresa vinculada à sua conta.</p>
        {!isEditing ? (
          <Button size="sm" variant="outline" onClick={startEdit}>Editar</Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setForm({})}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Razão Social" value={val("razao_social")} editing={isEditing} onChange={(v) => setForm({ ...form, razao_social: v })} />
        <Field label="Nome Fantasia" value={val("nome_fantasia")} editing={isEditing} onChange={(v) => setForm({ ...form, nome_fantasia: v })} />
        <Field label="CNPJ" value={val("cnpj")} editing={isEditing} onChange={(v) => setForm({ ...form, cnpj: v })} mask="cnpj" />
        <Field label="E-mail" value={val("email")} editing={isEditing} onChange={(v) => setForm({ ...form, email: v })} />
        <Field label="Telefone" value={val("telefone")} editing={isEditing} onChange={(v) => setForm({ ...form, telefone: v })} mask="phone" />
        <Field label="CEP" value={val("cep")} editing={isEditing} onChange={(v) => setForm({ ...form, cep: v })} mask="cep" />
        <Field label="Logradouro" value={val("logradouro")} editing={isEditing} onChange={(v) => setForm({ ...form, logradouro: v })} />
        <Field label="Bairro" value={val("bairro")} editing={isEditing} onChange={(v) => setForm({ ...form, bairro: v })} />
        <Field label="Cidade" value={val("cidade")} editing={isEditing} onChange={(v) => setForm({ ...form, cidade: v })} />
        <Field label="Estado" value={val("estado")} editing={isEditing} onChange={(v) => setForm({ ...form, estado: v })} />
        <Field label="Inscrição Estadual" value={val("inscricao_estadual")} editing={isEditing} onChange={(v) => setForm({ ...form, inscricao_estadual: v })} />
        <Field label="Inscrição Municipal" value={val("inscricao_municipal")} editing={isEditing} onChange={(v) => setForm({ ...form, inscricao_municipal: v })} />
      </div>
    </div>
  );
}

function Field({ label, value, editing, onChange }: { label: string; value: string; editing: boolean; onChange?: (v: string) => void }) {
  if (!editing) {
    return (
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
        <p className="text-sm text-foreground">{value || "—"}</p>
      </div>
    );
  }
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <Input value={value} onChange={(e) => onChange?.(e.target.value)} className="h-9 text-sm" />
    </div>
  );
}

/* ─── Tab: Usuários ─── */
function UsuariosTab() {
  const { user } = useAuth();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Gerencie os usuários com acesso ao sistema.</p>
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground">Proprietário</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">Admin</Badge>
        </div>
      </Card>
      <p className="text-xs text-muted-foreground italic">
        O convite de novos usuários e gestão de equipe estará disponível em breve.
      </p>
    </div>
  );
}

/* ─── Tab: Permissões ─── */
function PermissoesTab() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Configure os papéis e permissões de acesso ao sistema.</p>

      <Card className="p-4 space-y-3">
        {[
          { role: "Admin", desc: "Acesso total ao sistema, incluindo configurações e gestão de usuários." },
          { role: "Financeiro", desc: "Acesso a contas a pagar, conciliação, extratos e relatórios financeiros." },
          { role: "Operacional", desc: "Acesso a cadastros de clientes, fornecedores e produtos." },
          { role: "Visualizador", desc: "Acesso somente leitura a dashboards e relatórios." },
        ].map((p) => (
          <div key={p.role} className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
            <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">{p.role}</p>
              <p className="text-xs text-muted-foreground">{p.desc}</p>
            </div>
          </div>
        ))}
      </Card>

      <p className="text-xs text-muted-foreground italic">
        A configuração avançada de permissões por módulo estará disponível em breve.
      </p>
    </div>
  );
}

/* ─── Page ─── */
export default function ConfigConta() {
  return (
    <div className="space-y-6 max-w-4xl animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Conta e Acessos</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie os dados da empresa, usuários e permissões
        </p>
      </div>

      <Tabs defaultValue="empresa" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="empresa" className="gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            Empresa
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="permissoes" className="gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            Permissões
          </TabsTrigger>
        </TabsList>

        <TabsContent value="empresa" className="mt-4">
          <EmpresaTab />
        </TabsContent>
        <TabsContent value="usuarios" className="mt-4">
          <UsuariosTab />
        </TabsContent>
        <TabsContent value="permissoes" className="mt-4">
          <PermissoesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
