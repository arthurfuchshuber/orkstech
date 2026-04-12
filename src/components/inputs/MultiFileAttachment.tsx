import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Paperclip, X, FileText, Image, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface UploadedFile {
  name: string;
  url: string;
  size: number;
  type: string;
}

interface MultiFileAttachmentProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  label?: string;
  folder?: string;
  maxFiles?: number;
}

const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt";
const MAX_SIZE = 10 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

export function MultiFileAttachment({
  files,
  onFilesChange,
  label = "Anexos",
  folder = "atividades",
  maxFiles = 10,
}: MultiFileAttachmentProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || !user) return;

    const remaining = maxFiles - files.length;
    if (remaining <= 0) {
      toast.error(`Máximo de ${maxFiles} arquivos`);
      return;
    }

    const toUpload = Array.from(selectedFiles).slice(0, remaining);
    setUploading(true);

    try {
      const uploaded: UploadedFile[] = [];

      for (const file of toUpload) {
        if (file.size > MAX_SIZE) {
          toast.error(`${file.name}: máximo 10MB`);
          continue;
        }

        const path = `${user.id}/${folder}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("client-documents")
          .upload(path, file);
        if (uploadError) {
          toast.error(`Erro ao enviar ${file.name}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("client-documents")
          .getPublicUrl(path);

        uploaded.push({
          name: file.name,
          url: urlData.publicUrl,
          size: file.size,
          type: file.type || "application/octet-stream",
        });
      }

      if (uploaded.length > 0) {
        onFilesChange([...files, ...uploaded]);
        toast.success(`${uploaded.length} arquivo(s) anexado(s)`);
      }
    } catch {
      toast.error("Erro ao enviar arquivos");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((file, idx) => {
            const isImage = /\.(jpg|jpeg|png|webp)$/i.test(file.name);
            return (
              <div
                key={idx}
                className="flex items-center gap-2 p-2 rounded-lg border border-border/50 bg-muted/20"
              >
                {isImage ? (
                  <Image className="w-4 h-4 text-primary flex-shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                )}
                <span className="text-sm text-foreground truncate flex-1">{file.name}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">{formatBytes(file.size)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 flex-shrink-0"
                  onClick={() => removeFile(idx)}
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload button */}
      {files.length < maxFiles && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "flex items-center gap-2 w-full p-2.5 rounded-lg border border-dashed border-border/60 text-sm transition-colors",
            "hover:border-primary/40 hover:bg-primary/[0.03] cursor-pointer",
            uploading && "opacity-50 cursor-wait"
          )}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <Paperclip className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="text-muted-foreground">
            {uploading ? "Enviando..." : files.length > 0 ? "Adicionar mais arquivos" : "Clique para anexar arquivos"}
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        onChange={handleUpload}
        className="hidden"
      />
    </div>
  );
}
