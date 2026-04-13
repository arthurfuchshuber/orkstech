import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Users, Building2, Pencil, Trash2, Search, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface EmpresaInfo {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  email: string | null;
  telefone: string | null;
  created_at: string;
}

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  nome: string | null;
  cpf: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  ativo: boolean;
  nivel: string;
  nivel_permissao_id: string | null;
  empresa: string;
  empresa_id: string | null;
  is_owner: boolean;
  empresas: EmpresaInfo[];
}

interface NivelPermissao {
  id: string;
  nome: string;
}

export default function AdminUsers() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", cpf: "", telefone: "", data_nascimento: "", nivel_permissao_id: "" });
  const [editingCompany, setEditingCompany] = useState<EmpresaInfo | null>(null);
  const [companyForm, setCompanyForm] = useState({ razao_social: "", nome_fantasia: "", cnpj: "", email: "", telefone: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-all-users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-dashboard", {
        body: { action: "list_all_users" },
      });
      if (error) throw error;
      return data as { users: AdminUser[]; niveis: NivelPermissao[] };
    },
  });

  const users = data?.users ?? [];
  const niveis = data?.niveis ?? [];

  // Only show owner users
  const ownerUsers = useMemo(() => {
    const owners = users.filter((u) => u.is_owner);
    if (!searchTerm) return owners;
    const q = searchTerm.toLowerCase();
    return owners.filter(
      (u) =>
        u.email?.toLowerCase().includes(q) ||
        u.nome?.toLowerCase().includes(q) ||
        u.empresas.some(
          (e) =>
            e.razao_social?.toLowerCase().includes(q) ||
            e.nome_fantasia?.toLowerCase().includes(q) ||
            e.cnpj?.includes(q)
        )
    );
  }, [users, searchTerm]);

  const toggleExpanded = (userId: string) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  // Mutations
  const toggleMutation = useMutation({
    mutationFn: async ({ user_id, ativo }: { user_id: string; ativo: boolean }) => {
      const { error } = await supabase.functions.invoke("admin-dashboard", {
        body: { action: "toggle_user_active", user_id, ativo },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-all-users"] });
      toast.success("Status atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      if (!editingUser) return;
      const { error } = await supabase.functions.invoke("admin-dashboard", {
        body: {
          action: "update_user",
          user_id: editingUser.id,
          nome: editForm.nome || null,
          cpf: editForm.cpf || null,
          telefone: editForm.telefone || null,
          data_nascimento: editForm.data_nascimento || null,
          nivel_permissao_id: editForm.nivel_permissao_id || null,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuário atualizado");
      setEditingUser(null);
      qc.invalidateQueries({ queryKey: ["admin-all-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (user_id: string) => {
      const { error } = await supabase.functions.invoke("admin-dashboard", {
        body: { action: "delete_user", user_id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuário excluído");
      setEditingUser(null);
      qc.invalidateQueries({ queryKey: ["admin-all-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async () => {
      if (!editingCompany) return;
      const { error } = await supabase.functions.invoke("admin-dashboard", {
        body: {
          action: "update_company",
          empresa_id: editingCompany.id,
          ...companyForm,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Empresa atualizada");
      setEditingCompany(null);
      qc.invalidateQueries({ queryKey: ["admin-all-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (empresa_id: string) => {
      const { error } = await supabase.functions.invoke("admin-dashboard", {
        body: { action: "delete_company", empresa_id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Empresa excluída");
      setEditingCompany(null);
      qc.invalidateQueries({ queryKey: ["admin-all-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEditUser = (u: AdminUser) => {
    setEditingUser(u);
    setEditForm({
      nome: u.nome ?? "",
      cpf: u.cpf ?? "",
      telefone: u.telefone ?? "",
      data_nascimento: u.data_nascimento ?? "",
      nivel_permissao_id: u.nivel_permissao_id ?? "",
    });
  };

  const openEditCompany = (c: EmpresaInfo) => {
    setEditingCompany(c);
    setCompanyForm({
      razao_social: c.razao_social ?? "",
      nome_fantasia: c.nome_fantasia ?? "",
      cnpj: c.cnpj ?? "",
      email: c.email ?? "",
      telefone: c.telefone ?? "",
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, e-mail, empresa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      <Card className="overflow-hidden border-border/50">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/30">
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Nível</TableHead>
              <TableHead>Empresas</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-center w-[80px]">Ativo</TableHead>
              <TableHead className="w-[90px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">Carregando...</TableCell>
              </TableRow>
            ) : !ownerUsers.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-sm">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="w-8 h-8 text-muted-foreground/30" />
                    <p>Nenhum usuário encontrado</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              ownerUsers.map((u) => {
                const isSelf = u.id === user?.id;
                const isExpanded = expandedUsers.has(u.id);
                const empresaCount = u.empresas.length;

                return (
                  <>
                    {/* User row */}
                    <TableRow
                      key={u.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/50 transition-colors border-border/20",
                        !u.ativo && "opacity-50"
                      )}
                      onClick={() => empresaCount > 0 && toggleExpanded(u.id)}
                    >
                      <TableCell className="pr-0">
                        {empresaCount > 0 && (
                          <ChevronRight
                            className={cn(
                              "w-4 h-4 text-muted-foreground transition-transform duration-200",
                              isExpanded && "rotate-90"
                            )}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="text-sm font-medium text-foreground">{u.nome || "Sem nome"}</span>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-normal">{u.nivel}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {empresaCount} {empresaCount === 1 ? "empresa" : "empresas"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(u.created_at), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={u.ativo}
                          onCheckedChange={(v) => toggleMutation.mutate({ user_id: u.id, ativo: v })}
                          disabled={isSelf}
                        />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditUser(u)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {!isSelf && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                                  <Trash2 className="w-3.5 h-3.5" />
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
                                    onClick={() => deleteUserMutation.mutate(u.id)}
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

                    {/* Expanded company sub-rows */}
                    {isExpanded &&
                      u.empresas.map((emp) => (
                        <TableRow key={emp.id} className="bg-muted/20 border-border/10 hover:bg-muted/30">
                          <TableCell></TableCell>
                          <TableCell colSpan={2}>
                            <div className="flex items-center gap-2 pl-2">
                              <Building2 className="w-3.5 h-3.5 text-primary/60 shrink-0" />
                              <div>
                                <span className="text-sm font-medium text-foreground">
                                  {emp.nome_fantasia || emp.razao_social}
                                </span>
                                {emp.nome_fantasia && (
                                  <p className="text-xs text-muted-foreground">{emp.razao_social}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {emp.cnpj}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(emp.created_at), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-0.5">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditCompany(emp)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir empresa</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir <strong>{emp.nome_fantasia || emp.razao_social}</strong>? Esta ação é irreversível.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteCompanyMutation.mutate(emp.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Edit User Dialog */}
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
              <Input value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">CPF</label>
              <Input value={editForm.cpf} onChange={(e) => setEditForm({ ...editForm, cpf: e.target.value })} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Telefone</label>
              <Input value={editForm.telefone} onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data de Nascimento</label>
              <Input type="date" value={editForm.data_nascimento} onChange={(e) => setEditForm({ ...editForm, data_nascimento: e.target.value })} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nível de Acesso</label>
              <Select value={editForm.nivel_permissao_id} onValueChange={(v) => setEditForm({ ...editForm, nivel_permissao_id: v })}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione" />
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
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
            <Button onClick={() => updateUserMutation.mutate()} disabled={updateUserMutation.isPending}>
              {updateUserMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Company Dialog */}
      <Dialog open={!!editingCompany} onOpenChange={(open) => !open && setEditingCompany(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Empresa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Razão Social</label>
              <Input value={companyForm.razao_social} onChange={(e) => setCompanyForm({ ...companyForm, razao_social: e.target.value })} className="h-9 text-sm uppercase" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome Fantasia</label>
              <Input value={companyForm.nome_fantasia} onChange={(e) => setCompanyForm({ ...companyForm, nome_fantasia: e.target.value })} className="h-9 text-sm uppercase" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">CNPJ</label>
              <Input value={companyForm.cnpj} onChange={(e) => setCompanyForm({ ...companyForm, cnpj: e.target.value })} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">E-mail</label>
              <Input value={companyForm.email} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Telefone</label>
              <Input value={companyForm.telefone} onChange={(e) => setCompanyForm({ ...companyForm, telefone: e.target.value })} className="h-9 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCompany(null)}>Cancelar</Button>
            <Button onClick={() => updateCompanyMutation.mutate()} disabled={updateCompanyMutation.isPending}>
              {updateCompanyMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
