import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { deleteImportCascade, type ImportTarget } from "@/lib/import-targets";

const fmtDt = (s: string) => new Date(s).toLocaleString("pt-BR");

const sourceLabel: Record<string, string> = {
  csv: "CSV",
  xlsx: "Excel",
  google_sheets: "Google Sheets",
  manual: "Manual",
  system: "Sistema",
};

interface Props {
  target: ImportTarget;
  refreshKey?: number;
  onDeleted?: () => void;
}

export function ImportsHistoryTargeted({ target, refreshKey, onDeleted }: Props) {
  const { user } = useAuth();
  const { empresa: empresaAtiva } = useEmpresa();
  const queryClient = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["cashflow_imports", target, empresaAtiva?.id, refreshKey],
    queryFn: async () => {
      let q = supabase
        .from("cashflow_imports")
        .select("*")
        .eq("target" as any, target)
        .order("created_at", { ascending: false })
        .limit(50);
      if (empresaAtiva?.id) q = q.eq("empresa_id", empresaAtiva.id);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!user,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => deleteImportCascade(id),
    onSuccess: () => {
      toast.success("Importação e seus lançamentos foram removidos");
      queryClient.invalidateQueries({ queryKey: ["cashflow_imports"] });
      onDeleted?.();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao excluir importação"),
  });

  return (
    <>
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Histórico de Importações</CardTitle>
          <p className="text-xs text-muted-foreground">
            Excluir uma importação remove em cascata todos os lançamentos que ela criou.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
              Carregando...
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma importação realizada.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Importadas</TableHead>
                  <TableHead className="text-right">Duplicadas</TableHead>
                  <TableHead className="text-right">Erros</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{fmtDt(r.created_at)}</TableCell>
                    <TableCell className="text-sm font-medium truncate max-w-[300px]">
                      {r.filename}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {sourceLabel[r.source] ?? r.source}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{r.total_rows}</TableCell>
                    <TableCell className="text-right text-sm font-semibold text-emerald-600 tabular-nums">
                      {r.inserted_count}
                    </TableCell>
                    <TableCell className="text-right text-sm text-amber-600 tabular-nums">
                      {r.duplicate_count}
                    </TableCell>
                    <TableCell className="text-right text-sm text-rose-600 tabular-nums">
                      {r.skipped_count}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirmId(r.id)}
                        disabled={deleteMut.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir importação?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os lançamentos criados por esta importação também serão removidos. Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmId) deleteMut.mutate(confirmId);
                setConfirmId(null);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
