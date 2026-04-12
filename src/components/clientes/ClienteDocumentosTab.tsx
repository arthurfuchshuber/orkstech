import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Download, Trash2, FileText, Loader2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  clienteId: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

export function ClienteDocumentosTab({ clienteId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["cliente-documentos", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cliente_documentos")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo deve ter no máximo 10MB");
      return;
    }

    setUploading(true);
    try {
      const path = `${user.id}/${clienteId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("client-documents")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("client-documents").getPublicUrl(path);

      const { error: dbError } = await supabase.from("cliente_documentos").insert({
        user_id: user.id,
        cliente_id: clienteId,
        nome: file.name,
        tipo: file.type || "application/octet-stream",
        url: urlData.publicUrl,
        tamanho: file.size,
      });
      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["cliente-documentos", clienteId] });
      toast.success("Documento enviado com sucesso");
    } catch (err) {
      toast.error("Erro ao enviar documento");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase.from("cliente_documentos").delete().eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente-documentos", clienteId] });
      toast.success("Documento excluído");
      setDeleteId(null);
    },
  });

  const getFileIcon = (tipo?: string | null) => {
    if (tipo?.includes("pdf")) return "📄";
    if (tipo?.includes("image")) return "🖼️";
    if (tipo?.includes("sheet") || tipo?.includes("excel")) return "📊";
    return "📎";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{docs.length} documento(s)</p>
        <div>
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" />
          <Button size="sm" className="gap-2 rounded-lg" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload
          </Button>
        </div>
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/30">
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Nome</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Tipo</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Tamanho</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Data</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : docs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-8 h-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Nenhum documento anexado</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              docs.map((doc) => (
                <TableRow key={doc.id} className="border-border/20">
                  <TableCell className="font-medium text-foreground">
                    <span className="mr-2">{getFileIcon(doc.tipo)}</span>
                    {doc.nome}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{doc.tipo?.split("/").pop() || "arquivo"}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {doc.tamanho ? formatBytes(doc.tamanho) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(doc.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <a href={doc.url} target="_blank" rel="noopener noreferrer"><Eye className="w-4 h-4" /></a>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <a href={doc.url} download={doc.nome}><Download className="w-4 h-4" /></a>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(doc.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
