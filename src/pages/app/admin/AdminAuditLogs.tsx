import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield } from "lucide-react";
import { format } from "date-fns";

export default function AdminAuditLogs() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-dashboard", { body: { action: "list_admin_logs" } });
      if (error) throw error;
      return data.logs as any[];
    },
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Auditoria de Administradores
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[15%]">Data/Hora</TableHead>
                  <TableHead className="w-[22%]">Admin (e-mail)</TableHead>
                  <TableHead className="w-[20%]">Evento</TableHead>
                  <TableHead className="w-[28%]">Descrição</TableHead>
                  <TableHead className="w-[15%]">Alvo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : !data?.length ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma ação administrativa registrada</TableCell></TableRow>
                ) : data.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(log.created_at), "dd/MM/yy HH:mm:ss")}</TableCell>
                    <TableCell className="text-xs text-foreground truncate">{log.user_email}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{log.evento}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate">{log.descricao || "—"}</TableCell>
                    <TableCell className="text-[10px] text-muted-foreground truncate">{log.target_email || log.entidade_tipo || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
