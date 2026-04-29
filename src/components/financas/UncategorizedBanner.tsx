import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useUncategorizedTransactions } from "@/hooks/useUncategorizedTransactions";

interface Props {
  /** Se true, ao clicar não navega — apenas chama onAction (útil quando já está no Extrato) */
  inline?: boolean;
  onAction?: () => void;
}

/**
 * Banner proativo: alerta sobre transações Pluggy sem subcategoria DRE.
 * Reutilizável entre Extrato Bancário e Dashboard Financeiro 360.
 */
export function UncategorizedBanner({ inline = false, onAction }: Props) {
  const navigate = useNavigate();
  const { count } = useUncategorizedTransactions();

  if (count === 0) return null;

  const handleClick = () => {
    if (inline && onAction) {
      onAction();
    } else {
      navigate("/app/financas/extrato?filtro=sem-categoria");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full text-left flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 transition-colors px-4 py-3 cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-foreground">
            {count} transação{count !== 1 ? "ões" : ""} bancária{count !== 1 ? "s" : ""} sem categorização
          </p>
          <p className="text-xs text-muted-foreground">
            Categorize agora para manter seu DRE preciso. Use a sugestão inteligente para acelerar.
          </p>
        </div>
      </div>
      <span className="shrink-0 inline-flex items-center justify-center rounded-md bg-primary/15 hover:bg-primary/25 text-primary text-xs font-semibold px-3 py-1.5 transition-colors">
        Categorizar agora
      </span>
    </button>
  );
}
