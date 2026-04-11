import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Paperclip, X, FileText, Image, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileAttachmentProps {
  value?: string | null;
  onValueChange: (url: string | null) => void;
  label?: string;
  folder?: string;
}

const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function FileAttachment({ value, onValueChange, label = "Anexo (opcional)", folder = "general" }: FileAttachmentProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fileName = value ? decodeURIComponent(value.split("/").pop() || "") : null;
  const isImage = value && /\.(jpg|jpeg|png|webp)$/i.test(value);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > MAX_SIZE) {
      toast.error("Arquivo muito grande (máx. 10MB)");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${folder}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("attachments")
        .getPublicUrl(path);

      onValueChange(urlData.publicUrl);
      toast.success("Arquivo anexado");
    } catch {
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!value) return;
    // Extract path from URL
    try {
      const url = new URL(value);
      const pathParts = url.pathname.split("/storage/v1/object/public/attachments/");
      if (pathParts[1]) {
        await supabase.storage.from("attachments").remove([decodeURIComponent(pathParts[1])]);
      }
    } catch { /* ignore delete errors */ }
    onValueChange(null);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>

      {value ? (
        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 bg-muted/20">
          {isImage ? (
            <Image className="w-4 h-4 text-primary flex-shrink-0" />
          ) : (
            <FileText className="w-4 h-4 text-primary flex-shrink-0" />
          )}
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline truncate flex-1"
          >
            {fileName}
          </a>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 flex-shrink-0"
            onClick={handleRemove}
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </div>
      ) : (
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
            {uploading ? "Enviando..." : "Clique para anexar um arquivo"}
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        onChange={handleUpload}
        className="hidden"
      />
    </div>
  );
}
