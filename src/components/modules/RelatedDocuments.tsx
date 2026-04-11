import { FileText, Upload, Calendar, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface RelatedDocumentsProps {
  documents?: Array<{ id: string; nome: string; tipo: string; data: string; usuario?: string }>;
}

export function RelatedDocuments({ documents = [] }: RelatedDocumentsProps) {
  if (documents.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center">
        <div className="w-11 h-11 rounded-xl bg-muted/30 flex items-center justify-center mb-3">
          <FileText className="w-5 h-5 text-muted-foreground/30" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">Nenhum documento vinculado</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Anexe documentos como contratos, notas fiscais e comprovantes</p>
        <Button variant="outline" size="sm" className="mt-4 rounded-lg gap-1.5">
          <Upload className="w-3 h-3" /> Anexar documento
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <Card key={doc.id} className="p-3 border-border/40 flex items-center justify-between hover:bg-muted/20 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{doc.nome}</p>
              <p className="text-xs text-muted-foreground">{doc.tipo}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{doc.data}</span>
            {doc.usuario && <span className="flex items-center gap-1"><User className="w-3 h-3" />{doc.usuario}</span>}
          </div>
        </Card>
      ))}
    </div>
  );
}
