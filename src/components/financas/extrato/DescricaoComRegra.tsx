import { useState, ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Sparkles, Wand2 } from "lucide-react";
import { CriarRegraAutoModal } from "./CriarRegraAutoModal";

interface Props {
  /** Descrição completa (texto base do lançamento) */
  description: string;
  /** Categoria já aplicada à transação (se houver) — usada como pré-seleção */
  categoriaId?: string | null;
  /** "pagar" ou "receber" — direção da transação */
  tipoSugerido: "pagar" | "receber";
  /** Conteúdo visual da célula (geralmente o próprio texto da descrição) */
  children: ReactNode;
  className?: string;
}

/**
 * Envolve uma descrição com context menu (clique direito) que oferece criar
 * uma regra automática usando o trecho de texto que o usuário selecionou.
 * Se nada estiver selecionado, usa a descrição inteira como termo inicial.
 */
export function DescricaoComRegra({
  description,
  categoriaId,
  tipoSugerido,
  children,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [termo, setTermo] = useState("");

  const handleOpen = () => {
    const sel = window.getSelection?.()?.toString().trim() ?? "";
    const t = (sel || description || "").slice(0, 60).trim();
    setTermo(t);
    setOpen(true);
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <span className={className}>{children}</span>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-64">
          <ContextMenuItem onClick={handleOpen} className="gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Criar regra com este texto
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              setTermo(description.slice(0, 60).trim());
              setOpen(true);
            }}
            className="gap-2"
          >
            <Wand2 className="w-3.5 h-3.5" />
            Criar regra com a descrição inteira
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <CriarRegraAutoModal
        open={open}
        onOpenChange={setOpen}
        initialTerm={termo}
        initialCategoriaId={categoriaId ?? ""}
        tipoSugerido={tipoSugerido}
      />
    </>
  );
}
