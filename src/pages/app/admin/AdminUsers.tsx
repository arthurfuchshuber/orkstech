import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Users, Building2, Pencil, Trash2, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

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
}

interface NivelPermissao {
  id: string;
  nome: string;
}

interface Company {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  email: string | null;
  telefone: string | null;
  owner_email: string;
  created_at: string;
}

export default function AdminUsers() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", cpf: "", telefone: "", data_nascimento: "", nivel_permissao_id: "" });
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
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

  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-dashboard", {
        body: { action: "list_companies" },
      });
      if (error) throw error;
      return data.companies as Company[];
    },
  });

  const users = data?.users ?? [];
  const niveis = data?.niveis ?? [];
  const companies = companiesData ?? [];

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    const q = searchTerm.toLowerCase();
    return users.filter(
      (u) =>
        u.email?.toLowerCase().includes(q) ||
        u.nome?.toLowerCase().includes(q) ||
        u.empresa?.toLowerCase().includes(q)
    );
  }, [users, searchTerm]);

  const filteredCompanies = useMemo(() => {
    if (!searchTerm) return companies;
    const q = searchTerm.toLowerCase();
    return companies.filter(
      (c) =>
        c.razao_social?.toLowerCase().includes(q) ||
        c.nome_fantasia?.toLowerCase().includes(q) ||
        c.cnpj?.includes(q) ||
        c.owner_email?.toLowerCase().includes(q)
    );
  }, [companies, searchTerm]);

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
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
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
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
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

  const openEditCompany = (c: Company) => {
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

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Usuários ({filteredUsers.length})
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            Empresas ({filteredCompanies.length})
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-4">
          <Card className="overflow-hidden border-border/50">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[25%]">Usuário</TableHead>
                  <TableHead className="w-[25%]">Empresa</TableHead>
                  <TableHead className="w-[15%]">Nível</TableHead>
                  <TableHead className="w-[13%]">Criado em</TableHead>
                  <TableHead className="w-[10%] text-center">Ativo</TableHead>
                  <TableHead className="w-[12%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">Carregando...</TableCell></TableRow>
                ) : !filteredUsers.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">Nenhum usuário</TableCell></TableRow>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelf = u.id === user?.id;
                    return (
                      <TableRow key={u.id} className={cn(!u.ativo && "opacity-50")}>
                        <TableCell>
                          <div>
                            <span className="text-sm font-medium">{u.nome || "Sem nome"}</span>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{u.empresa}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-normal">{u.nivel}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(u.created_at), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={u.ativo}
                            onCheckedChange={(v) => toggleMutation.mutate({ user_id: u.id, ativo: v })}
                            disabled={isSelf}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditUser(u)}>
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
                                      Tem certeza que deseja excluir <strong>{u.email}</strong>? Esta ação é irreversível e removerá todos os dados vinculados.
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
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Companies Tab */}
        <TabsContent value="companies" className="mt-4">
          <Card className="overflow-hidden border-border/50">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Empresa</TableHead>
                  <TableHead className="w-[20%]">CNPJ</TableHead>
                  <TableHead className="w-[25%]">Proprietário</TableHead>
                  <TableHead className="w-[15%]">Criado em</TableHead>
                  <TableHead className="w-[10%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {companiesLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-sm">Carregando...</TableCell></TableRow>
                ) : !filteredCompanies.length ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-sm">Nenhuma empresa</TableCell></TableRow>
                ) : (
                  filteredCompanies.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div>
                          <span className="text-sm font-medium">{c.nome_fantasia || c.razao_social}</span>
                          {c.nome_fantasia && <p className="text-xs text-muted-foreground">{c.razao_social}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{c.cnpj}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.owner_email}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(c.created_at), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditCompany(c)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir empresa</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir <strong>{c.nome_fantasia || c.razao_social}</strong>? Esta ação é irreversível e removerá todos os dados vinculados.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteCompanyMutation.mutate(c.id)}
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
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

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
