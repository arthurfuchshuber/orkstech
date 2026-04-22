import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Download, Trash2, FileText, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { refreshQueries } from "@/lib/query-refresh";
import { logClienteEvent } from "@/lib/cliente-history";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ClickSignContratosClienteSection } from "./ClickSignContratosClienteSection";

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
  const contractRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingContract, setUploadingContract] = useState(false);
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

  // Separate contracts from other documents
  const contracts = docs.filter((d) => d.tipo?.includes("contract") || d.nome?.toLowerCase().includes("contrato"));
  const documents = docs.filter((d) => !d.tipo?.includes("contract") && !d.nome?.toLowerCase().includes("contrato"));

  const uploadFile = async (file: File, isContract: boolean) => {
    if (!user) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo deve ter no máximo 10MB");
      return;
    }

    if (isContract) { setUploadingContract(true); } else { setUploading(true); }
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
        tipo: isContract ? "contract" : (file.type || "application/octet-stream"),
        url: urlData.publicUrl,
        tamanho: file.size,
      });
      if (dbError) throw dbError;

      await refreshQueries(queryClient, [["cliente-documentos", clienteId]]);
      logClienteEvent({
        clienteId,
        userId: user.id,
        tipo: isContract ? "Contrato" : "Documento",
        titulo: isContract ? "Contrato enviado" : "Documento enviado",
        descricao: file.name,
        usuarioNome: user.email || "Sistema",
      });
      toast.success(isContract ? "Contrato enviado" : "Documento enviado");
    } catch {
      toast.error("Erro ao enviar arquivo");
    } finally {
      if (isContract) { setUploadingContract(false); } else { setUploading(false); }
      if (fileRef.current) fileRef.current.value = "";
      if (contractRef.current) contractRef.current.value = "";
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const target = docs.find((d) => d.id === docId);
      const { error } = await supabase.from("cliente_documentos").delete().eq("id", docId);
      if (error) throw error;
      return target;
    },
    onSuccess: async (target) => {
      await refreshQueries(queryClient, [["cliente-documentos", clienteId]]);
      if (user && target) {
        logClienteEvent({
          clienteId,
          userId: user.id,
          tipo: target.tipo === "contract" ? "Contrato" : "Documento",
          titulo: target.tipo === "contract" ? "Contrato excluído" : "Documento excluído",
          descricao: target.nome,
          usuarioNome: user.email || "Sistema",
        });
      }
      toast.success("Arquivo excluído");
      setDeleteId(null);
    },
  });

  const FileItem = ({ doc }: { doc: any }) => (
    <Card className="p-4 border-border/40 shadow-sm flex items-center justify-between group hover:border-border/60 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center">
          <FileText className="w-4 h-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{doc.nome}</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(doc.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            {doc.tamanho ? ` · ${formatBytes(doc.tamanho)}` : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <a href={doc.url} download={doc.nome}><Download className="w-4 h-4" /></a>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => setDeleteId(doc.id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Contracts section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground">Contratos</h3>
          <div>
            <input
              ref={contractRef}
              type="file"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], true)}
              accept=".pdf,.doc,.docx"
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-2 rounded-lg"
              onClick={() => contractRef.current?.click()}
              disabled={uploadingContract}
            >
              {uploadingContract ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Novo Contrato
            </Button>
          </div>
        </div>
        {contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum contrato enviado</p>
        ) : (
          <div className="space-y-2">
            {contracts.map((doc) => <FileItem key={doc.id} doc={doc} />)}
          </div>
        )}
      </div>

      {/* Documents section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground">Documentos</h3>
          <div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], false)}
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-2 rounded-lg"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Enviar Documento
            </Button>
          </div>
        </div>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum documento enviado</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => <FileItem key={doc.id} doc={doc} />)}
          </div>
        )}
      </div>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir arquivo?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
