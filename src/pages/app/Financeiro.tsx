import { Settings2 } from "lucide-react";
import { PlanoDeContasSection } from "@/components/financas/PlanoDeContasSection";
import { CentrosCustoSection } from "@/components/financas/CentrosCustoSection";
import { FormasPagamentoSection } from "@/components/financas/FormasPagamentoSection";
import { TiposGastoSection } from "@/components/financas/TiposGastoSection";
import { BusinessUnitsSection } from "@/components/financas/BusinessUnitsSection";

import { usePermissions } from "@/hooks/usePermissions";
import ContasBancarias from "./ContasBancarias";

/**
 * Wrapper que aplica readOnly visualmente quando o usuário pode visualizar mas
 * não pode editar uma seção. Bloqueia interações sem ocultar o conteúdo.
 */
function ReadOnlyWrap({ readOnly, children }: { readOnly: boolean; children: React.ReactNode }) {
  if (!readOnly) return <>{children}</>;
  return (
    <div className="relative">
      <div className="pointer-events-none opacity-70 select-none">{children}</div>
      <div className="absolute top-2 right-2 z-10 rounded-md border border-border/60 bg-muted/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        Somente leitura
      </div>
    </div>
  );
}

export default function Financeiro() {
  const { canView, canEdit } = usePermissions();

  const showPlano = canView("finance:plano-contas");
  const showCentros = canView("finance:centros-custo");
  const showContas = canView("finance:contas-bancarias");
  const showFormas = canView("finance:formas-pagamento");

  const editPlano = canEdit("finance:plano-contas");
  const editCentros = canEdit("finance:centros-custo");
  const editContas = canEdit("finance:contas-bancarias");
  const editOpenFinance = canEdit("finance:open-finance");
  const editFormas = canEdit("finance:formas-pagamento");
  const viewOpenFinance = canView("finance:open-finance");

  const nothingVisible = !showPlano && !showCentros && !showContas && !showFormas;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Estruture o financeiro da operação em um único ambiente: plano de contas, centros de custo, formas de pagamento e contas bancárias.
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Settings2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Estrutura financeira</h2>
            <p className="text-xs text-muted-foreground">Defina a base contábil e operacional usada em lançamentos e relatórios.</p>
          </div>
        </div>

        {nothingVisible ? (
          <div className="rounded-xl border border-border/50 bg-card/40 p-10 text-center text-sm text-muted-foreground">
            Você não tem permissão para visualizar nenhuma das configurações financeiras. Solicite acesso ao administrador da empresa.
          </div>
        ) : (
          <>
            {(showPlano || showCentros) && (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {showPlano && (
                  <ReadOnlyWrap readOnly={!editPlano}>
                    <PlanoDeContasSection />
                  </ReadOnlyWrap>
                )}
                {showCentros && (
                  <ReadOnlyWrap readOnly={!editCentros}>
                    <CentrosCustoSection />
                  </ReadOnlyWrap>
                )}
              </div>
            )}

            {showContas && (
              <ContasBancarias
                embedded
                readOnly={!editContas}
                hideOpenFinanceButton={!viewOpenFinance || !editOpenFinance}
              />
            )}


            {showFormas && (
              <ReadOnlyWrap readOnly={!editFormas}>
                <FormasPagamentoSection />
              </ReadOnlyWrap>
            )}

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <BusinessUnitsSection />
              <TiposGastoSection />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
