import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Users } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  nome: string | null;
  ativo: boolean;
  nivel: string;
  empresa: string;
}

export default function AdminUsers() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-all-users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-dashboard", {
        body: { action: "list_all_users" },
      });
      if (error) throw error;
      return data.users as AdminUser[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ user_id, ativo }: { user_id: string; ativo: boolean }) => {
      const { data, error } = await supabase.functions.invoke("admin-dashboard", {
        body: { action: "toggle_user_active", user_id, ativo },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-all-users"] });
      toast.success("Status atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 animate-fade-in">

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            {data?.length ?? 0} usuários
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Ativo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell>
                  </TableRow>
                ) : !data?.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum usuário</TableCell>
                  </TableRow>
                ) : (
                  data.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="text-sm">{u.nome || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                      <TableCell className="text-sm">{u.empresa}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{u.nivel}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(u.created_at), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={u.ativo}
                          onCheckedChange={(v) => toggleMutation.mutate({ user_id: u.id, ativo: v })}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
