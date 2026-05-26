import { useState, useCallback } from "react";
import { Building2, Pencil, Trash2, UserPlus, Users, ShieldAlert, ShieldCheck, MoreHorizontal, ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PermissionsModal } from "@/components/admin/PermissionsModal";
import { DocumentInput } from "@/components/inputs/DocumentInput";
import { PhoneInput } from "@/components/inputs/PhoneInput";
import { DateInput } from "@/components/inputs/DateInput";
import { CepInput } from "@/components/inputs/CepInput";
import { SociosSection } from "@/components/socios/SociosSection";
import { BusinessUnitsSection } from "@/components/financas/BusinessUnitsSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

async function getFunctionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.name === "FunctionsHttpError") {
    try {
      const response = (error as Error & { context?: Response }).context;
      const payload = response ? await response.json() : null;
      return payload?.error || fallback;
    } catch {
      return fallback;
    }
  }

  return error instanceof Error ? error.message : fallback;
}


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

        {/* Quadro Societário */}
        <SociosSection />

        {/* Unidades de Negócio */}
        <BusinessUnitsSection />
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
  const { canEdit, isOwner } = usePermissions();
  const qc = useQueryClient();
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", cpf: "", telefone: "", data_nascimento: "" });
  const [newPassword, setNewPassword] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [adminBlockMsg, setAdminBlockMsg] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({ email: "", password: "", nome: "" });
  const [permModal, setPermModal] = useState<{ userId: string; email: string; isOwner: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const { data, isLoading } = useUserManagementData();
  const users = data?.users ?? [];
  const niveis = data?.niveis ?? [];

  const canChangePassword = isOwner || canEdit("system:alterar-senha-usuarios");

  const openEdit = (u: UserRow) => {
    setEditingUser(u);
    setEditForm({ nome: u.nome ?? "", cpf: u.cpf ?? "", telefone: u.telefone ?? "", data_nascimento: u.data_nascimento ?? "" });
    setNewPassword("");
  };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const createUser = useMutation({
    mutationFn: async () => {
      const nome = createForm.nome.trim();
      const email = createForm.email.trim().toLowerCase();
      const password = createForm.password.trim();

      if (!emailRegex.test(email)) {
        throw new Error("E-mail inválido. Use o formato usuario@dominio.com");
      }
      if (password.length < 6) {
        throw new Error("A senha temporária precisa ter no mínimo 6 caracteres");
      }
      if (!empresa?.id) {
        throw new Error("Selecione uma empresa ativa antes de criar usuários");
      }

      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "create_user", nome, email, password, empresa_id: empresa?.id },
      });
      if (error) throw error; if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { toast.success("Usuário criado! Configure as permissões em seguida."); setShowCreateModal(false); setCreateForm({ email: "", password: "", nome: "" }); qc.invalidateQueries({ queryKey: ["manage-users"] }); },
    onError: async (e: Error) => toast.error(await getFunctionErrorMessage(e, "Não foi possível criar o usuário")),
  });

  const setPassword = useMutation({
    mutationFn: async () => {
      if (!editingUser) throw new Error("Usuário não selecionado");
      const password = newPassword.trim();
      if (password.length < 6) throw new Error("A nova senha precisa ter no mínimo 6 caracteres");
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "set_password", user_id: editingUser.id, password, empresa_id: empresa?.id },
      });
      if (error) throw error; if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { toast.success("Senha alterada com sucesso"); setNewPassword(""); },
    onError: async (e: Error) => toast.error(await getFunctionErrorMessage(e, "Não foi possível alterar a senha")),
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

  const ownerUserId = empresa?.user_id;

  return (
    <div className="space-y-4">

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Usuários & Permissões</h2>
          <p className="text-xs text-muted-foreground">
            {users.length} {users.length === 1 ? "usuário" : "usuários"} · permissões individuais por página
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreateModal(true)} className="gap-1.5 self-start sm:self-auto">
          <UserPlus className="h-3.5 w-3.5" /> Novo Usuário
        </Button>
      </div>

      <Card className="overflow-hidden">
        {users.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum usuário encontrado</p>
        ) : (
          <ul className="divide-y divide-border">
            {[...users]
              .sort((a, b) =>
                (a.nome || a.email).localeCompare(b.nome || b.email, "pt-BR", { sensitivity: "base" }),
              )
              .map((u) => {
                const isSelf = u.id === user?.id;
                const isOwner = u.id === ownerUserId;
                const nivel = isOwner ? "Acesso total" : "Permissões personalizadas";
                const isExpanded = expandedUserId === u.id;
                return (
                  <li
                    key={u.id}
                    className={`${!u.ativo ? "opacity-60" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm font-medium text-foreground truncate">
                            {u.nome || u.email.split("@")[0]}
                          </span>
                          {isSelf && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 shrink-0">
                              Você
                            </Badge>
                          )}
                          {isOwner && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 h-4 bg-primary/10 text-primary border-primary/30 shrink-0 gap-0.5"
                            >
                              <ShieldCheck className="h-2 w-2" /> Dono
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{nivel}</p>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={() => setPermModal({ userId: u.id, email: u.email, isOwner })}
                            >
                              <ShieldCheck className="h-3.5 w-3.5 mr-2" /> Permissões
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(u)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                            </DropdownMenuItem>
                            {!isSelf && !isOwner && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    toggleActive.mutate({ user_id: u.id, ativo: !u.ativo })
                                  }
                                >
                                  {u.ativo ? "Desativar" : "Ativar"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setDeleteTarget(u)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-3 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] border-t border-border/40 bg-muted/10">
                        <div className="pt-2">
                          <span className="text-muted-foreground">E-mail</span>
                          <p className="text-foreground truncate">{u.email}</p>
                        </div>
                        <div className="pt-2">
                          <span className="text-muted-foreground">Telefone</span>
                          <p className="text-foreground">{u.telefone || "—"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">CPF</span>
                          <p className="text-foreground">{u.cpf || "—"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Criado em</span>
                          <p className="text-foreground">{new Date(u.created_at).toLocaleDateString("pt-BR")}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Status</span>
                          <p className="text-foreground">{u.ativo ? "Ativo" : "Inativo"}</p>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.email}</strong>? Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteTarget) { deleteUser.mutate(deleteTarget.id); setDeleteTarget(null); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Permissions Modal */}
      <PermissionsModal
        userId={permModal?.userId ?? null}
        userEmail={permModal?.email ?? null}
        isOwner={permModal?.isOwner ?? false}
        open={!!permModal}
        onOpenChange={(open) => !open && setPermModal(null)}
      />

      {/* Create User Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" /> Novo Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Nome completo *</label><Input value={createForm.nome} onChange={(e) => setCreateForm({ ...createForm, nome: e.target.value })} className="h-9 text-sm" placeholder="Ex: João Silva" /></div>
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">E-mail *</label><Input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} className="h-9 text-sm" placeholder="usuario@empresa.com" /></div>
            <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Senha temporária *</label><Input type="password" minLength={6} value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} className="h-9 text-sm" placeholder="Mínimo 6 caracteres" /><p className="mt-1 text-[10px] text-muted-foreground">O usuário poderá alterar a senha após o primeiro login.</p>{createForm.password.length > 0 && createForm.password.length < 6 && <p className="mt-1 text-[10px] text-destructive">A senha precisa ter pelo menos 6 caracteres.</p>}</div>
            <div className="rounded-md border border-info/30 bg-info/5 p-2.5">
              <p className="text-[11px] text-muted-foreground">
                <ShieldCheck className="w-3 h-3 inline mr-1 text-info" />
                Após criar o usuário, defina suas permissões clicando em <strong>Permissões</strong> na lista.
              </p>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancelar</Button><Button onClick={() => createUser.mutate()} disabled={createUser.isPending || !emailRegex.test(createForm.email.trim().toLowerCase()) || !createForm.password.trim() || !createForm.nome.trim() || createForm.password.trim().length < 6}>{createUser.isPending ? "Criando..." : "Criar Usuário"}</Button></DialogFooter>
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

            {canChangePassword && editingUser && editingUser.id !== user?.id && (
              <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  <p className="text-xs font-semibold text-foreground">Alterar senha</p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Defina uma nova senha para este usuário. Ele poderá usá-la imediatamente no próximo login.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-9 text-sm"
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                    maxLength={72}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setPassword.mutate()}
                    disabled={setPassword.isPending || newPassword.trim().length < 6}
                  >
                    {setPassword.isPending ? "Aplicando..." : "Aplicar"}
                  </Button>
                </div>
                {newPassword.length > 0 && newPassword.length < 6 && (
                  <p className="text-[10px] text-destructive">A senha precisa ter pelo menos 6 caracteres.</p>
                )}
              </div>
            )}
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

      {/* Admin block popup */}
      <AlertDialog open={!!adminBlockMsg} onOpenChange={(open) => !open && setAdminBlockMsg(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center">Ação bloqueada</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-sm">
              {adminBlockMsg}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction onClick={() => setAdminBlockMsg(null)}>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
