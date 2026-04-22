import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";
import { format } from "date-fns";

interface LogEntry {
  id: string;
  user_id: string;
  evento: string;
  descricao: string | null;
  entidade_tipo: string | null;
  entidade_id: string | null;
  created_at: string;
}

export default function AdminLogs() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-dashboard", {
        body: { action: "list_logs" },
      });
      if (error) throw error;
      return data.logs as LogEntry[];
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            Histórico de Ações
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[15%]">Data</TableHead>
                  <TableHead className="w-[18%]">Evento</TableHead>
                  <TableHead className="w-[35%]">Descrição</TableHead>
                  <TableHead className="w-[15%]">Entidade</TableHead>
                  <TableHead className="w-[17%]">User ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell>
                  </TableRow>
                ) : !data?.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum log encontrado</TableCell>
                  </TableRow>
                ) : (
                  data.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), "dd/MM/yy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{log.evento}</Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{log.descricao || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{log.entidade_tipo || "—"}</TableCell>
                      <TableCell className="text-[10px] font-mono text-muted-foreground/60">{log.user_id.slice(0, 8)}…</TableCell>
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
