import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { CriarRegraAutoModal } from "./CriarRegraAutoModal";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Descrições das transações que acabaram de ser categorizadas em massa */
  descricoes: string[];
  /** Categoria aplicada */
  categoriaId: string;
  categoriaNome?: string;
  /** Direção predominante (saída/entrada) */
  tipoSugerido: "pagar" | "receber";
}

/**
 * Detecta o termo comum mais relevante entre as descrições selecionadas.
 * Estratégia: tokeniza, remove stopwords curtas/numéricas, e elege o token
 * (1-3 palavras) que mais aparece em descrições distintas.
 */
function detectCommonTerm(descricoes: string[]): string {
  const stop = new Set([
    "de","da","do","das","dos","e","para","a","o","com","em","no","na",
    "pix","pagamento","recebido","enviado","compra","cartao","cartão",
    "ltda","me","sa","s","s.a","mei","eireli","-","via","boleto","ted","doc",
  ]);
  const counts = new Map<string, Set<number>>();
  descricoes.forEach((desc, idx) => {
    const tokens = (desc || "")
      .toLowerCase()
      .replace(/[^\p{L}0-9 ]+/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !stop.has(t) && !/^\d+$/.test(t));
    const seen = new Set<string>();
    // unigramas + bigramas
    tokens.forEach((t, i) => {
      if (!seen.has(t)) {
        seen.add(t);
        if (!counts.has(t)) counts.set(t, new Set());
        counts.get(t)!.add(idx);
      }
      const bi = tokens[i + 1] ? `${t} ${tokens[i + 1]}` : null;
      if (bi && !seen.has(bi)) {
        seen.add(bi);
        if (!counts.has(bi)) counts.set(bi, new Set());
        counts.get(bi)!.add(idx);
      }
    });
  });
  let best = "";
  let bestScore = 0;
  counts.forEach((set, term) => {
    const score = set.size * (term.includes(" ") ? 1.4 : 1);
    if (score > bestScore && set.size >= Math.max(2, Math.floor(descricoes.length * 0.5))) {
      bestScore = score;
      best = term;
    }
  });
  return best.toUpperCase();
}

export function OfertaCriarRegraModal({
  open,
  onOpenChange,
  descricoes,
  categoriaId,
  categoriaNome,
  tipoSugerido,
}: Props) {
  const sugerido = useMemo(() => detectCommonTerm(descricoes), [descricoes]);
  const [termo, setTermo] = useState(sugerido);
  const [criarOpen, setCriarOpen] = useState(false);

  useEffect(() => {
    if (open) setTermo(sugerido);
  }, [open, sugerido]);

  const preview = descricoes.slice(0, 4);

  return (
    <>
      <Dialog open={open && !criarOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Criar regra automática?
            </DialogTitle>
            <DialogDescription>
              Você categorizou {descricoes.length} lançamentos como{" "}
              <strong className="text-foreground">{categoriaNome ?? "essa categoria"}</strong>.
              Quer criar uma regra para classificar futuras transações automaticamente — e
              também aplicar ao histórico ainda não categorizado?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Termo a procurar na descrição</Label>
              <Input
                value={termo}
                onChange={(e) => setTermo(e.target.value.toUpperCase())}
                placeholder="Ex: UBER, POSTO, TIM"
                className="h-9 text-sm font-mono"
                maxLength={60}
              />
              <p className="text-[11px] text-muted-foreground">
                Sugerimos um termo comum entre as descrições. Edite se precisar.
              </p>
            </div>

            {preview.length > 0 && (
              <div className="rounded-md bg-muted/40 border border-border/40 p-2.5 space-y-1">
                <p className="text-[11px] text-muted-foreground">Baseado em:</p>
                <div className="flex flex-wrap gap-1">
                  {preview.map((d, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] font-mono">
                      {d.length > 28 ? `${d.slice(0, 28)}…` : d}
                    </Badge>
                  ))}
                  {descricoes.length > preview.length && (
                    <Badge variant="secondary" className="text-[10px]">
                      +{descricoes.length - preview.length}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Agora não
            </Button>
            <Button
              onClick={() => setCriarOpen(true)}
              disabled={!termo.trim() || termo.trim().length < 2}
            >
              Criar regra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CriarRegraAutoModal
        open={criarOpen}
        onOpenChange={(v) => {
          setCriarOpen(v);
          if (!v) onOpenChange(false);
        }}
        initialTerm={termo}
        initialCategoriaId={categoriaId}
        tipoSugerido={tipoSugerido}
      />
    </>
  );
}
