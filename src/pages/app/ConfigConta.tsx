import { useState } from "react";
import { Building2, Users, Trash2, Pencil, UserPlus } from "lucide-react";
import { DocumentInput } from "@/components/inputs/DocumentInput";
import { PhoneInput } from "@/components/inputs/PhoneInput";
import { DateInput } from "@/components/inputs/DateInput";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
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

function UsuariosTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", cpf: "", telefone: "", data_nascimento: "" });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", password: "", nome: "", nivel_permissao_id: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["manage-users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "list" },
      });
      if (error) throw error;
      return data as { users: UserRow[]; niveis: NivelPermissao[] };
    },
  });

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

  if (isLoading) return <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gerencie os usuários do sistema, seus níveis de acesso e status.</p>
        <Button size="sm" onClick={() => setShowCreateModal(true)} className="gap-1.5">
          <UserPlus className="w-3.5 h-3.5" />
          Novo Usuário
        </Button>
      </div>

      <Card className="overflow-hidden">
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
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
                        {isSelf && <Badge variant="secondary" className="text-[10px]">Você</Badge>}
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
                            <SelectItem key={n.id} value={n.id}>{n.nome}</SelectItem>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(u)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {!isSelf && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
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

      {/* Create User Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Novo Usuário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome completo *</label>
              <Input
                value={createForm.nome}
                onChange={(e) => setCreateForm({ ...createForm, nome: e.target.value })}
                className="h-9 text-sm"
                placeholder="Ex: João Silva"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">E-mail *</label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                className="h-9 text-sm"
                placeholder="usuario@empresa.com"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Senha temporária *</label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                className="h-9 text-sm"
                placeholder="Mínimo 6 caracteres"
              />
              <p className="text-[10px] text-muted-foreground mt-1">O usuário poderá alterar a senha após o primeiro login.</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nível de Acesso *</label>
              <Select
                value={createForm.nivel_permissao_id}
                onValueChange={(v) => setCreateForm({ ...createForm, nivel_permissao_id: v })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione o nível" />
                </SelectTrigger>
                <SelectContent>
                  {niveis.map((n) => (
                    <SelectItem key={n.id} value={n.id}>{n.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
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

      {/* Edit Profile Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">E-mail</label>
              <Input value={editingUser?.email ?? ""} disabled className="h-9 text-sm opacity-60" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
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
                value={editForm.data_nascimento ? new Date(editForm.data_nascimento + "T12:00:00") : undefined}
                onValueChange={(date) => setEditForm({ ...editForm, data_nascimento: date ? date.toISOString().split("T")[0] : "" })}
                label="Data de Nascimento"
              />
            </div>
          </div>
          <DialogFooter className="flex !justify-between">
            {editingUser && editingUser.id !== user?.id ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" />
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
              <Button variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
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

/* ─── Page ─── */
export default function ConfigConta() {
  return (
    <div className="space-y-6 animate-fade-in">
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
