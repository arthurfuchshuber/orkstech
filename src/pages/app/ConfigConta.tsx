import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  Pencil,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { DocumentInput } from "@/components/inputs/DocumentInput";
import { PhoneInput } from "@/components/inputs/PhoneInput";
import { DateInput } from "@/components/inputs/DateInput";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type SectionKey = "empresa" | "usuarios" | "permissoes";

interface UserRow {
  id: string;
  email: string;
  created_at: string;
  nome: string | null;
  cpf: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  nivel_permissao_id: string | null;
  nivel_nome: string;
  ativo: boolean;
}

interface NivelPermissao {
  id: string;
  nome: string;
}

function useUserManagementData() {
  return useQuery({
    queryKey: ["manage-users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "list" },
      });
      if (error) throw error;
      return data as { users: UserRow[]; niveis: NivelPermissao[] };
    },
  });
}

function getNivelDescription(nome: string) {
  const normalized = nome.toLowerCase();

  if (normalized.includes("super")) {
    return "Acesso total à plataforma, empresas e recursos administrativos do SaaS.";
  }

  if (normalized.includes("admin")) {
    return "Gerencia operação, usuários e configurações da empresa com autonomia.";
  }

  if (normalized.includes("finance")) {
    return "Focado em rotinas financeiras, cadastros estruturais e contas bancárias.";
  }

  if (normalized.includes("visual") || normalized.includes("leitura")) {
    return "Acesso consultivo, ideal para acompanhamento sem alterações críticas.";
  }

  return "Define o escopo de acesso e o nível de autonomia do usuário dentro do sistema.";
}

function Field({
  label,
  value,
  editing,
  onChange,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange?: (v: string) => void;
}) {
  if (!editing) {
    return (
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">{value || "—"}</p>
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <Input value={value} onChange={(e) => onChange?.(e.target.value)} className="h-9 text-sm" />
    </div>
  );
}

function EmpresaSection() {
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
      toast.error(`Erro ao salvar: ${error.message}`);
      return;
    }

    toast.success("Dados da empresa atualizados");
    setForm({});
    await refetch();
  };

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>;
  }

  if (!empresa) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma empresa cadastrada.</p>;
  }

  const val = (field: string) => (isEditing ? (form[field] ?? "") : (empresa[field] ?? "—"));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Centralize os dados cadastrais da organização e mantenha o registro institucional sempre atualizado.
          </p>
        </div>
        {!isEditing ? (
          <Button size="sm" variant="outline" onClick={startEdit}>
            Editar empresa
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setForm({})}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
        <Field
          label="Inscrição Estadual"
          value={val("inscricao_estadual")}
          editing={isEditing}
          onChange={(v) => setForm({ ...form, inscricao_estadual: v })}
        />
        <Field
          label="Inscrição Municipal"
          value={val("inscricao_municipal")}
          editing={isEditing}
          onChange={(v) => setForm({ ...form, inscricao_municipal: v })}
        />
      </div>
    </div>
  );
}

function UsuariosSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", cpf: "", telefone: "", data_nascimento: "" });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", password: "", nome: "", nivel_permissao_id: "" });
  const { data, isLoading } = useUserManagementData();

  const users = data?.users ?? [];
  const niveis = data?.niveis ?? [];

  const openEdit = (u: UserRow) => {
    setEditingUser(u);
    setEditForm({
      nome: u.nome ?? "",
      cpf: u.cpf ?? "",
      telefone: u.telefone ?? "",
      data_nascimento: u.data_nascimento ?? "",
    });
  };

  const createUser = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "create_user", ...createForm },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Usuário criado com sucesso!");
      setShowCreateModal(false);
      setCreateForm({ email: "", password: "", nome: "", nivel_permissao_id: "" });
      qc.invalidateQueries({ queryKey: ["manage-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRole = useMutation({
    mutationFn: async ({ user_id, nivel_permissao_id }: { user_id: string; nivel_permissao_id: string }) => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "update_role", user_id, nivel_permissao_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Nível de acesso atualizado");
      qc.invalidateQueries({ queryKey: ["manage-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ user_id, ativo }: { user_id: string; ativo: boolean }) => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "toggle_active", user_id, ativo },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["manage-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: async (user_id: string) => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "delete", user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Usuário excluído");
      qc.invalidateQueries({ queryKey: ["manage-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!editingUser) return;
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "update_profile",
          user_id: editingUser.id,
          nome: editForm.nome || null,
          cpf: editForm.cpf || null,
          telefone: editForm.telefone || null,
          data_nascimento: editForm.data_nascimento || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Dados atualizados");
      setEditingUser(null);
      qc.invalidateQueries({ queryKey: ["manage-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted-foreground">
          Mantenha o time organizado com controle de acesso, status da conta e edição rápida de cadastro.
        </p>
        <Button size="sm" onClick={() => setShowCreateModal(true)} className="gap-1.5">
          <UserPlus className="h-3.5 w-3.5" />
          Novo Usuário
        </Button>
      </div>

      <Card className="overflow-hidden border-border/60 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-mail</TableHead>
              <TableHead className="w-[130px]">Criado em</TableHead>
              <TableHead className="w-[180px]">Nível de Acesso</TableHead>
              <TableHead className="w-[80px] text-center">Ativo</TableHead>
              <TableHead className="w-[90px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nenhum usuário encontrado
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => {
                const isSelf = u.id === user?.id;
                return (
                  <TableRow key={u.id} className={!u.ativo ? "opacity-50" : ""}>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <div>
                          <span>{u.email}</span>
                          {u.nome && <p className="text-xs text-muted-foreground">{u.nome}</p>}
                        </div>
                        {isSelf && (
                          <Badge variant="secondary" className="text-[10px]">
                            Você
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.nivel_permissao_id ?? ""}
                        onValueChange={(v) => updateRole.mutate({ user_id: u.id, nivel_permissao_id: v })}
                        disabled={isSelf}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {niveis.map((n) => (
                            <SelectItem key={n.id} value={n.id}>
                              {n.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={u.ativo}
                        onCheckedChange={(v) => toggleActive.mutate({ user_id: u.id, ativo: v })}
                        disabled={isSelf}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!isSelf && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir <strong>{u.email}</strong>? Esta ação é irreversível.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteUser.mutate(u.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Novo Usuário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome completo *</label>
              <Input
                value={createForm.nome}
                onChange={(e) => setCreateForm({ ...createForm, nome: e.target.value })}
                className="h-9 text-sm"
                placeholder="Ex: João Silva"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">E-mail *</label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                className="h-9 text-sm"
                placeholder="usuario@empresa.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Senha temporária *</label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                className="h-9 text-sm"
                placeholder="Mínimo 6 caracteres"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                O usuário poderá alterar a senha após o primeiro login.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nível de Acesso *</label>
              <Select value={createForm.nivel_permissao_id} onValueChange={(v) => setCreateForm({ ...createForm, nivel_permissao_id: v })}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione o nível" />
                </SelectTrigger>
                <SelectContent>
                  {niveis.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createUser.mutate()}
              disabled={
                createUser.isPending ||
                !createForm.email ||
                !createForm.password ||
                !createForm.nome ||
                !createForm.nivel_permissao_id
              }
            >
              {createUser.isPending ? "Criando..." : "Criar Usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">E-mail</label>
              <Input value={editingUser?.email ?? ""} disabled className="h-9 text-sm opacity-60" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome</label>
              <Input
                value={editForm.nome}
                onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                className="h-9 text-sm"
                placeholder="Nome completo"
              />
            </div>
            <div>
              <DocumentInput
                type="cpf"
                value={editForm.cpf}
                onValueChange={(raw) => setEditForm({ ...editForm, cpf: raw })}
                label="CPF"
              />
            </div>
            <div>
              <PhoneInput
                value={editForm.telefone}
                onValueChange={(raw) => setEditForm({ ...editForm, telefone: raw })}
                label="Telefone"
              />
            </div>
            <div>
              <DateInput
                value={editForm.data_nascimento ? new Date(`${editForm.data_nascimento}T12:00:00`) : undefined}
                onValueChange={(date) =>
                  setEditForm({
                    ...editForm,
                    data_nascimento: date ? date.toISOString().split("T")[0] : "",
                  })
                }
                label="Data de Nascimento"
              />
            </div>
          </div>
          <DialogFooter className="flex !justify-between">
            {editingUser && editingUser.id !== user?.id ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-1.5">
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir usuário
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir <strong>{editingUser.email}</strong>? Esta ação é irreversível.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        deleteUser.mutate(editingUser.id);
                        setEditingUser(null);
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                Cancelar
              </Button>
              <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending}>
                {updateProfile.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PermissoesSection({ onManageUsers }: { onManageUsers: () => void }) {
  const { data, isLoading } = useUserManagementData();
  const users = data?.users ?? [];
  const niveis = data?.niveis ?? [];

  const resumo = useMemo(
    () =>
      niveis.map((nivel) => ({
        ...nivel,
        count: users.filter((user) => user.nivel_permissao_id === nivel.id).length,
      })),
    [niveis, users],
  );

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {resumo.map((nivel) => (
          <div key={nivel.id} className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{nivel.nome}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{getNivelDescription(nivel.nome)}</p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {nivel.count}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      <Card className="border-dashed border-border/60 bg-muted/10 shadow-none">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Permissões são aplicadas por nível de acesso</p>
            <p className="text-xs text-muted-foreground">
              Para alterar o alcance de um usuário, basta trocar o nível diretamente na seção de usuários.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onManageUsers} className="gap-1.5">
            Gerenciar usuários
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {users.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-background px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum usuário disponível para distribuição de permissões.
          </div>
        ) : (
          users.map((u) => (
            <div
              key={u.id}
              className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background px-4 py-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{u.nome || u.email}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{u.nivel_nome}</Badge>
                <Badge variant={u.ativo ? "secondary" : "outline"}>{u.ativo ? "Ativo" : "Inativo"}</Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function ConfigConta({ defaultTab }: { defaultTab?: string }) {
  const activeSection: SectionKey =
    defaultTab === "usuarios" || defaultTab === "permissoes" ? defaultTab : "empresa";

  const empresaRef = useRef<HTMLDivElement>(null);
  const usuariosRef = useRef<HTMLDivElement>(null);
  const permissoesRef = useRef<HTMLDivElement>(null);

  const sectionRefs: Record<SectionKey, React.RefObject<HTMLDivElement>> = {
    empresa: empresaRef,
    usuarios: usuariosRef,
    permissoes: permissoesRef,
  };

  const scrollToSection = (section: SectionKey) => {
    sectionRefs[section].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (!defaultTab || activeSection === "empresa") return;
    requestAnimationFrame(() => scrollToSection(activeSection));
  }, [activeSection, defaultTab]);

  const sections: Array<{
    key: SectionKey;
    title: string;
    description: string;
    icon: typeof Building2;
  }> = [
    {
      key: "empresa",
      title: "Empresa",
      description: "Dados institucionais, fiscais e contato principal da organização.",
      icon: Building2,
    },
    {
      key: "usuarios",
      title: "Usuários",
      description: "Cadastro operacional, status de acesso e gestão de contas do time.",
      icon: Users,
    },
    {
      key: "permissoes",
      title: "Permissões",
      description: "Visão clara dos níveis de acesso e distribuição do time.",
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Empresa, Usuários e Permissões</h1>
        <p className="text-sm text-muted-foreground">
          Uma visão unificada para administrar a estrutura da empresa, o time e os níveis de acesso em um só lugar.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.key;

          return (
            <button
              key={section.key}
              type="button"
              onClick={() => scrollToSection(section.key)}
              className={`rounded-2xl border p-4 text-left transition-all ${
                isActive ? "border-primary/30 bg-primary/5 shadow-sm" : "border-border/60 bg-card hover:border-primary/20"
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                {isActive && <Badge variant="secondary">Em foco</Badge>}
              </div>
              <p className="text-sm font-semibold text-foreground">{section.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{section.description}</p>
            </button>
          );
        })}
      </div>

      <div ref={empresaRef} className="scroll-mt-24">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-4 w-4 text-primary" />
              Empresa
            </CardTitle>
            <CardDescription>Base cadastral da organização e informações que sustentam a operação.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmpresaSection />
          </CardContent>
        </Card>
      </div>

      <div ref={usuariosRef} className="scroll-mt-24">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-4 w-4 text-primary" />
              Usuários
            </CardTitle>
            <CardDescription>Controle as contas do time, o status de acesso e os níveis atribuídos.</CardDescription>
          </CardHeader>
          <CardContent>
            <UsuariosSection />
          </CardContent>
        </Card>
      </div>

      <div ref={permissoesRef} className="scroll-mt-24">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Permissões
            </CardTitle>
            <CardDescription>
              Entenda rapidamente quem pode fazer o quê e distribua responsabilidades com clareza.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PermissoesSection onManageUsers={() => scrollToSection("usuarios")} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
