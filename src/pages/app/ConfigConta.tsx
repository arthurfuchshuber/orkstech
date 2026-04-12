import { useState, useEffect } from "react";
import { Building2, Users, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
        <Field label="CNPJ" value={val("cnpj")} editing={isEditing} onChange={(v) => setForm({ ...form, cnpj: v })} />
        <Field label="E-mail" value={val("email")} editing={isEditing} onChange={(v) => setForm({ ...form, email: v })} />
        <Field label="Telefone" value={val("telefone")} editing={isEditing} onChange={(v) => setForm({ ...form, telefone: v })} />
        <Field label="CEP" value={val("cep")} editing={isEditing} onChange={(v) => setForm({ ...form, cep: v })} />
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
interface NivelPermissao {
  id: string;
  nome: string;
  descricao: string | null;
}

interface ProfileData {
  id: string;
  user_id: string;
  nome: string | null;
  cpf: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  nivel_permissao_id: string | null;
}

function UsuariosTab() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: niveis = [] } = useQuery({
    queryKey: ["niveis_permissao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("niveis_permissao")
        .select("*")
        .order("ordem");
      if (error) throw error;
      return data as NivelPermissao[];
    },
  });

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as ProfileData | null;
    },
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    telefone: "",
    data_nascimento: "",
    nivel_permissao_id: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        nome: profile.nome ?? "",
        cpf: profile.cpf ?? "",
        telefone: profile.telefone ?? "",
        data_nascimento: profile.data_nascimento ?? "",
        nivel_permissao_id: profile.nivel_permissao_id ?? "",
      });
    }
  }, [profile]);

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado");

      const payload = {
        nome: form.nome || null,
        cpf: form.cpf || null,
        telefone: form.telefone || null,
        data_nascimento: form.data_nascimento || null,
        nivel_permissao_id: form.nivel_permissao_id || null,
      };

      if (profile) {
        const { error } = await supabase
          .from("profiles")
          .update(payload)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("profiles")
          .insert({ ...payload, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Perfil atualizado com sucesso");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const currentNivel = niveis.find((n) => n.id === (profile?.nivel_permissao_id ?? form.nivel_permissao_id));

  if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Informações e permissões do usuário logado.</p>
        {!editing ? (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Editar</Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => {
              setEditing(false);
              if (profile) {
                setForm({
                  nome: profile.nome ?? "",
                  cpf: profile.cpf ?? "",
                  telefone: profile.telefone ?? "",
                  data_nascimento: profile.data_nascimento ?? "",
                  nivel_permissao_id: profile.nivel_permissao_id ?? "",
                });
              }
            }}>Cancelar</Button>
            <Button size="sm" onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        )}
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{user?.email}</p>
            <Badge variant="secondary" className="text-[10px] mt-0.5">
              {currentNivel?.nome ?? "Sem nível"}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!editing ? (
            <>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Nome</p>
                <p className="text-sm text-foreground">{form.nome || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">E-mail</p>
                <p className="text-sm text-foreground">{user?.email ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">CPF</p>
                <p className="text-sm text-foreground">{form.cpf || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Telefone</p>
                <p className="text-sm text-foreground">{form.telefone || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Data de Nascimento</p>
                <p className="text-sm text-foreground">{form.data_nascimento || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Nível de Permissão</p>
                <p className="text-sm text-foreground">{currentNivel?.nome ?? "—"}</p>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">E-mail</label>
                <Input value={user?.email ?? ""} disabled className="h-9 text-sm opacity-60" />
                <p className="text-[10px] text-muted-foreground mt-1">O e-mail não pode ser alterado aqui.</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">CPF</label>
                <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} className="h-9 text-sm" placeholder="000.000.000-00" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Telefone</label>
                <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className="h-9 text-sm" placeholder="(00) 00000-0000" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Data de Nascimento</label>
                <Input type="date" value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nível de Permissão</label>
                <Select value={form.nivel_permissao_id} onValueChange={(v) => setForm({ ...form, nivel_permissao_id: v })}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecione um nível" />
                  </SelectTrigger>
                  <SelectContent>
                    {niveis.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        <div>
                          <span className="font-medium">{n.nome}</span>
                          {n.descricao && <span className="text-muted-foreground ml-2 text-xs">— {n.descricao}</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      </Card>

      <p className="text-xs text-muted-foreground italic">
        O convite de novos usuários e gestão de equipe estará disponível em breve.
      </p>
    </div>
  );
}

/* ─── Page ─── */
export default function ConfigConta() {
  return (
    <div className="space-y-6 max-w-4xl animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Empresa e Usuários</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie os dados da empresa e informações dos usuários
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
        </TabsList>

        <TabsContent value="empresa" className="mt-4">
          <EmpresaTab />
        </TabsContent>
        <TabsContent value="usuarios" className="mt-4">
          <UsuariosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
