import { useState, useCallback } from "react";
import { Building2, Pencil, Trash2, UserPlus, Users } from "lucide-react";
import { DocumentInput } from "@/components/inputs/DocumentInput";
import { PhoneInput } from "@/components/inputs/PhoneInput";
import { DateInput } from "@/components/inputs/DateInput";
import { CepInput } from "@/components/inputs/CepInput";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMemo } from "react";

/* ─── Types ─── */
interface UserRow {
  id: string; email: string; created_at: string; nome: string | null;
  cpf: string | null; telefone: string | null; data_nascimento: string | null;
  nivel_permissao_id: string | null; nivel_nome: string; ativo: boolean;
}
interface NivelPermissao { id: string; nome: string; }

function useUserManagementData() {
  const { empresa } = useEmpresa();
  return useQuery({
    queryKey: ["manage-users", empresa?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-users", { body: { action: "list", empresa_id: empresa?.id } });
      if (error) throw error;
      return data as { users: UserRow[]; niveis: NivelPermissao[] };
    },
    enabled: !!empresa?.id,
  });
}

/* ─── Field helper ─── */
function Field({ label, value, editing, onChange }: { label: string; value: string; editing: boolean; onChange?: (v: string) => void }) {
  if (!editing) return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  );
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <Input value={value} onChange={(e) => onChange?.(e.target.value)} className="h-9 text-sm" />
    </div>
  );
}

/* ─── Tab: Empresa ─── */
function EmpresaTab() {
  const { empresa, loading, refetch } = useEmpresa();
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const openEdit = useCallback(() => {
    if (!empresa) return;
    setForm({
      razao_social: empresa.razao_social ?? "", nome_fantasia: empresa.nome_fantasia ?? "",
      cnpj: empresa.cnpj ?? "", email: empresa.email ?? "", telefone: empresa.telefone ?? "",
      cep: empresa.cep ?? "", logradouro: empresa.logradouro ?? "", bairro: empresa.bairro ?? "",
      cidade: empresa.cidade ?? "", estado: empresa.estado ?? "",
      inscricao_estadual: empresa.inscricao_estadual ?? "", inscricao_municipal: empresa.inscricao_municipal ?? "",
    });
    setShowEditModal(true);
  }, [empresa]);

  const handleSave = async () => {
    if (!empresa) return;
    setSaving(true);
    const { error } = await supabase.from("empresas").update({
      razao_social: form.razao_social, nome_fantasia: form.nome_fantasia, cnpj: form.cnpj,
      email: form.email, telefone: form.telefone, cep: form.cep, logradouro: form.logradouro,
      bairro: form.bairro, cidade: form.cidade, estado: form.estado,
      inscricao_estadual: form.inscricao_estadual, inscricao_municipal: form.inscricao_municipal,
    }).eq("id", empresa.id);
    setSaving(false);
    if (error) { toast.error(`Erro ao salvar: ${error.message}`); return; }
    toast.success("Dados da empresa atualizados");
    setShowEditModal(false);
    await refetch();
  };

  const handleCepFilled = (data: { logradouro?: string; bairro?: string; cidade?: string; estado?: string }) => {
    setForm((prev) => ({
      ...prev,
      logradouro: data.logradouro || prev.logradouro,
      bairro: data.bairro || prev.bairro,
      cidade: data.cidade || prev.cidade,
      estado: data.estado || prev.estado,
    }));
  };

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>;
  if (!empresa) return <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma empresa cadastrada.</p>;

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Dados cadastrais da empresa vinculada à sua conta.</p>
          <Button size="sm" variant="outline" onClick={openEdit} className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Razão Social" value={empresa.razao_social ?? "—"} editing={false} />
          <Field label="Nome Fantasia" value={empresa.nome_fantasia ?? "—"} editing={false} />
          <Field label="CNPJ" value={empresa.cnpj ?? "—"} editing={false} />
          <Field label="E-mail" value={empresa.email ?? "—"} editing={false} />
          <Field label="Telefone" value={empresa.telefone ?? "—"} editing={false} />
          <Field label="CEP" value={empresa.cep ?? "—"} editing={false} />
          <Field label="Logradouro" value={empresa.logradouro ?? "—"} editing={false} />
          <Field label="Bairro" value={empresa.bairro ?? "—"} editing={false} />
          <Field label="Cidade" value={empresa.cidade ?? "—"} editing={false} />
          <Field label="Estado" value={empresa.estado ?? "—"} editing={false} />
          <Field label="Inscrição Estadual" value={empresa.inscricao_estadual ?? "—"} editing={false} />
          <Field label="Inscrição Municipal" value={empresa.inscricao_municipal ?? "—"} editing={false} />
        </div>
      </div>

      {/* Edit Empresa Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-primary" />
              Editar Dados da Empresa
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Identificação */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identificação</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Razão Social *</label>
                  <Input value={form.razao_social ?? ""} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} className="h-9 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome Fantasia</label>
                  <Input value={form.nome_fantasia ?? ""} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} className="h-9 text-sm" />
                </div>
                <DocumentInput type="cnpj" value={form.cnpj ?? ""} onValueChange={(raw) => setForm({ ...form, cnpj: raw })} label="CNPJ" />
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">E-mail</label>
                  <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9 text-sm" />
                </div>
                <PhoneInput value={form.telefone ?? ""} onValueChange={(raw) => setForm({ ...form, telefone: raw })} label="Telefone" />
              </div>
            </div>

            {/* Endereço */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Endereço</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CepInput value={form.cep ?? ""} onValueChange={(raw) => setForm({ ...form, cep: raw })} onAddressFound={handleCepFilled} label="CEP" />
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Logradouro</label>
                  <Input value={form.logradouro ?? ""} onChange={(e) => setForm({ ...form, logradouro: e.target.value })} className="h-9 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Bairro</label>
                  <Input value={form.bairro ?? ""} onChange={(e) => setForm({ ...form, bairro: e.target.value })} className="h-9 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Cidade</label>
                  <Input value={form.cidade ?? ""} onChange={(e) => setForm({ ...form, cidade: e.target.value })} className="h-9 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Estado</label>
                  <Input value={form.estado ?? ""} onChange={(e) => setForm({ ...form, estado: e.target.value })} className="h-9 text-sm" />
                </div>
              </div>
            </div>

            {/* Inscrições */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inscrições</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Inscrição Estadual</label>
                  <Input value={form.inscricao_estadual ?? ""} onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value })} className="h-9 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Inscrição Municipal</label>
                  <Input value={form.inscricao_municipal ?? ""} onChange={(e) => setForm({ ...form, inscricao_municipal: e.target.value })} className="h-9 text-sm" />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.razao_social?.trim()}>
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ─── Tab: Usuários ─── */
function UsuariosTab() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
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
    setEditForm({ nome: u.nome ?? "", cpf: u.cpf ?? "", telefone: u.telefone ?? "", data_nascimento: u.data_nascimento ?? "" });
  };

  const createUser = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-users", { body: { action: "create_user", ...createForm } });
      if (error) throw error; if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { toast.success("Usuário criado!"); setShowCreateModal(false); setCreateForm({ email: "", password: "", nome: "", nivel_permissao_id: "" }); qc.invalidateQueries({ queryKey: ["manage-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRole = useMutation({
    mutationFn: async ({ user_id, nivel_permissao_id }: { user_id: string; nivel_permissao_id: string }) => {
      const { data, error } = await supabase.functions.invoke("manage-users", { body: { action: "update_role", user_id, nivel_permissao_id, empresa_id: empresa?.id } });
      if (error) throw error; if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { toast.success("Nível atualizado"); qc.invalidateQueries({ queryKey: ["manage-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ user_id, ativo }: { user_id: string; ativo: boolean }) => {
      const { data, error } = await supabase.functions.invoke("manage-users", { body: { action: "toggle_active", user_id, ativo, empresa_id: empresa?.id } });
      if (error) throw error; if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { toast.success("Status atualizado"); qc.invalidateQueries({ queryKey: ["manage-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: async (user_id: string) => {
      const { data, error } = await supabase.functions.invoke("manage-users", { body: { action: "delete", user_id, empresa_id: empresa?.id } });
      if (error) throw error; if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { toast.success("Usuário excluído"); qc.invalidateQueries({ queryKey: ["manage-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!editingUser) return;
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "update_profile", user_id: editingUser.id, nome: editForm.nome || null, cpf: editForm.cpf || null, telefone: editForm.telefone || null, data_nascimento: editForm.data_nascimento || null },
      });
      if (error) throw error; if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { toast.success("Dados atualizados"); setEditingUser(null); qc.invalidateQueries({ queryKey: ["manage-users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>;

  const getNivelDescription = (nome: string) => {
    const n = nome.toLowerCase();
    if (n.includes("admin")) return "Gerencia operação, usuários e configurações da empresa.";
    if (n.includes("finance")) return "Focado em rotinas financeiras, cadastros estruturais e contas bancárias.";
    if (n.includes("operac")) return "Acesso às rotinas operacionais do dia a dia.";
    if (n.includes("visual") || n.includes("leitura")) return "Acesso consultivo, ideal para acompanhamento.";
    return "Define o escopo de acesso do usuário dentro do sistema.";
  };

  const niveisFiltered = niveis.filter((n) => n.nome !== "Super Admin");
  const resumo = niveisFiltered.map((nivel) => ({
    ...nivel,
    count: users.filter((u) => u.nivel_permissao_id === nivel.id).length,
  }));
  const adminNivelId = niveis.find((n) => n.nome === "Admin")?.id;
  const activeAdminCount = users.filter((u) => u.ativo && u.nivel_permissao_id === adminNivelId).length;

  const isOnlyActiveAdmin = (targetUser: UserRow) => (
    !!adminNivelId
    && targetUser.ativo
    && targetUser.nivel_permissao_id === adminNivelId
    && activeAdminCount === 1
  );

  const handleRoleChange = (targetUser: UserRow, nextNivelId: string) => {
    if (isOnlyActiveAdmin(targetUser) && nextNivelId !== adminNivelId) {
      toast.error("Não é possível remover o nível Admin do único administrador da empresa.", { duration: 5000 });
      return;
    }

    updateRole.mutate({ user_id: targetUser.id, nivel_permissao_id: nextNivelId });
  };

  return (
    <div className="space-y-4">
      {/* Permissions summary */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {resumo.map((nivel) => (
          <div key={nivel.id} className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{nivel.nome}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{getNivelDescription(nivel.nome)}</p>
              </div>
              <Badge variant="secondary" className="shrink-0">{nivel.count}</Badge>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gerencie os usuários do sistema, seus níveis de acesso e status.</p>
        <Button size="sm" onClick={() => setShowCreateModal(true)} className="gap-1.5"><UserPlus className="h-3.5 w-3.5" /> Novo Usuário</Button>
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
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhum usuário encontrado</TableCell></TableRow>
            ) : users.map((u) => {
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
                  <TableCell className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    <Select value={u.nivel_permissao_id ?? ""} onValueChange={(v) => handleRoleChange(u, v)} disabled={isSelf}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{niveis.map((n) => <SelectItem key={n.id} value={n.id}>{n.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center"><Switch checked={u.ativo} onCheckedChange={(v) => toggleActive.mutate({ user_id: u.id, ativo: v })} disabled={isSelf} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>
                      {!isSelf && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Excluir usuário</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir <strong>{u.email}</strong>? Esta ação é irreversível.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteUser.mutate(u.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Create User Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" /> Novo Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Nome completo *</label><Input value={createForm.nome} onChange={(e) => setCreateForm({ ...createForm, nome: e.target.value })} className="h-9 text-sm" placeholder="Ex: João Silva" /></div>
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">E-mail *</label><Input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} className="h-9 text-sm" placeholder="usuario@empresa.com" /></div>
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Senha temporária *</label><Input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} className="h-9 text-sm" placeholder="Mínimo 6 caracteres" /><p className="mt-1 text-[10px] text-muted-foreground">O usuário poderá alterar a senha após o primeiro login.</p></div>
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Nível de Acesso *</label><Select value={createForm.nivel_permissao_id} onValueChange={(v) => setCreateForm({ ...createForm, nivel_permissao_id: v })}><SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione o nível" /></SelectTrigger><SelectContent>{niveis.map((n) => <SelectItem key={n.id} value={n.id}>{n.nome}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancelar</Button><Button onClick={() => createUser.mutate()} disabled={createUser.isPending || !createForm.email || !createForm.password || !createForm.nome || !createForm.nivel_permissao_id}>{createUser.isPending ? "Criando..." : "Criar Usuário"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">E-mail</label><Input value={editingUser?.email ?? ""} disabled className="h-9 text-sm opacity-60" /></div>
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Nome</label><Input value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} className="h-9 text-sm" placeholder="Nome completo" /></div>
            <div><DocumentInput type="cpf" value={editForm.cpf} onValueChange={(raw) => setEditForm({ ...editForm, cpf: raw })} label="CPF" /></div>
            <div><PhoneInput value={editForm.telefone} onValueChange={(raw) => setEditForm({ ...editForm, telefone: raw })} label="Telefone" /></div>
            <div><DateInput value={editForm.data_nascimento ? new Date(`${editForm.data_nascimento}T12:00:00`) : undefined} onValueChange={(date) => setEditForm({ ...editForm, data_nascimento: date ? date.toISOString().split("T")[0] : "" })} label="Data de Nascimento" /></div>
          </div>
          <DialogFooter className="flex !justify-between">
            {editingUser && editingUser.id !== user?.id ? (
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="destructive" size="sm" className="gap-1.5"><Trash2 className="h-3.5 w-3.5" /> Excluir usuário</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Excluir usuário</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir <strong>{editingUser.email}</strong>?</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { deleteUser.mutate(editingUser.id); setEditingUser(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
              <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending}>{updateProfile.isPending ? "Salvando..." : "Salvar"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Page ─── */
export default function ConfigConta({ defaultTab }: { defaultTab?: string }) {
  const tab = defaultTab ?? "empresa";

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Empresa e Usuários</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie os dados da empresa, usuários e permissões de acesso
        </p>
      </div>

      <Tabs defaultValue={tab} className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="empresa" className="gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            Empresa
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Usuários & Permissões
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
