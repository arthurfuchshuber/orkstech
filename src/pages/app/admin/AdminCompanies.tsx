import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Search } from "lucide-react";
import { format } from "date-fns";

export default function AdminCompanies() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-dashboard", { body: { action: "list_companies" } });
      if (error) throw error;
      return data.companies as any[];
    },
  });

  const filtered = useMemo(() => {
    if (!search) return data ?? [];
    const s = search.toLowerCase();
    return (data ?? []).filter((c) =>
      (c.razao_social?.toLowerCase().includes(s)) ||
      (c.nome_fantasia?.toLowerCase().includes(s)) ||
      (c.cnpj?.includes(s)) ||
      (c.owner_email?.toLowerCase().includes(s))
    );
  }, [data, search]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Buscar empresa, CNPJ ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="outline">{filtered.length} empresas</Badge>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> Empresas cadastradas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[28%]">Empresa</TableHead>
                  <TableHead className="w-[15%]">CNPJ</TableHead>
                  <TableHead className="w-[22%]">Dono (e-mail)</TableHead>
                  <TableHead className="w-[15%]">Atividade</TableHead>
                  <TableHead className="w-[10%]">Clientes</TableHead>
                  <TableHead className="w-[10%]">Criada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : !filtered.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma empresa encontrada</TableCell></TableRow>
                ) : filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="text-sm font-medium text-foreground truncate">{c.nome_fantasia || c.razao_social}</p>
                      {c.nome_fantasia && <p className="text-[10px] text-muted-foreground truncate">{c.razao_social}</p>}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{c.cnpj}</TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate">{c.owner_email}</TableCell>
                    <TableCell className="text-xs">
                      <span className="text-foreground">{(c.stats?.payables ?? 0) + (c.stats?.receivables ?? 0)}</span>
                      <span className="text-muted-foreground"> lanç.</span>
                    </TableCell>
                    <TableCell className="text-xs text-foreground">{c.stats?.clientes ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(c.created_at), "dd/MM/yy")}</TableCell>
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
