import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";

const fmtDt = (s: string) => new Date(s).toLocaleString("pt-BR");

const sourceLabel: Record<string, string> = { csv: "CSV", xlsx: "Excel", google_sheets: "Google Sheets", manual: "Manual", system: "Sistema" };

export function ImportsHistory({ refreshKey }: { refreshKey: number }) {
  const { user } = useAuth();
  const { empresa: empresaAtiva } = useEmpresa();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    let q = supabase.from("cashflow_imports").select("*").order("created_at", { ascending: false }).limit(50);
    if (empresaAtiva?.id) q = q.eq("empresa_id", empresaAtiva.id);
    q.then(({ data }) => setRows(data ?? []));
  }, [user, empresaAtiva?.id, refreshKey]);

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Histórico de Importações</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Nenhuma importação realizada.</div>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{fmtDt(r.created_at)}</TableCell>
                  <TableCell className="text-sm font-medium truncate max-w-[300px]">{r.filename}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{sourceLabel[r.source] ?? r.source}</Badge></TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{r.total_rows}</TableCell>
                  <TableCell className="text-right text-sm font-semibold text-emerald-600 tabular-nums">{r.inserted_count}</TableCell>
                  <TableCell className="text-right text-sm text-amber-600 tabular-nums">{r.duplicate_count}</TableCell>
                  <TableCell className="text-right text-sm text-rose-600 tabular-nums">{r.skipped_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
