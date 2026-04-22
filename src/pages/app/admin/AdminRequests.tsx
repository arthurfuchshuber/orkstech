import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function AdminRequests() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-deletion-requests"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-dashboard", { body: { action: "list_deletion_requests" } });
      if (error) throw error;
      return data.requests as any[];
    },
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-destructive" /> Solicitações de exclusão de conta
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[25%]">E-mail</TableHead>
                  <TableHead className="w-[18%]">Solicitado em</TableHead>
                  <TableHead className="w-[15%]">Status</TableHead>
                  <TableHead className="w-[42%]">Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : !data?.length ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhuma solicitação</TableCell></TableRow>
                ) : data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-foreground truncate">{r.user_email}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(r.created_at), "dd/MM/yy HH:mm")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${r.status === "completed" ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20"}`}>
                        {r.status === "completed" ? "Concluída" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate">{r.descricao}</TableCell>
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
