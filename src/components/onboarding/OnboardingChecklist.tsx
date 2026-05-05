import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles, CheckCircle2, Circle, ChevronRight, Building2,
  Wallet, Coins, Layers, Tags, Users, Truck, Receipt, Rocket,
  CreditCard, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useOnboarding, type OnboardingStepKey } from "@/hooks/useOnboarding";
import { ContaBancariaModal } from "@/components/modals/ContaBancariaModal";
import { CentroCustoModal } from "@/components/modals/CentroCustoModal";
import { CategoriaFinanceiraModal } from "@/components/modals/CategoriaFinanceiraModal";
import { FormaPagamentoModal } from "@/components/modals/FormaPagamentoModal";
import { ClienteModal } from "@/components/modals/ClienteModal";
import { FornecedorModal } from "@/components/modals/FornecedorModal";
import { cn } from "@/lib/utils";

interface StepDef {
  key: OnboardingStepKey;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  why: string;
  cta: string;
  page?: string; // página onde o usuário deveria estar (para coach mark futuro)
  action: () => void;
}

interface Group {
  title: string;
  description: string;
  steps: StepDef[];
}

export function OnboardingChecklist() {
  const navigate = useNavigate();
  const { status, steps, progress, doneSteps, totalSteps, isComplete, isDismissed, dismissChecklist, refetch } =
    useOnboarding();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<null | "conta" | "centro" | "categoria" | "cliente" | "fornecedor">(null);

  const groups: Group[] = useMemo(
    () => [
      {
        title: "Estrutura financeira",
        description: "A base que conecta todo o seu fluxo de caixa.",
        steps: [
          {
            key: "conta",
            icon: Wallet,
            title: "Cadastrar uma conta bancária",
            why: "Sem conta, não há como registrar entradas e saídas. Você pode conectar via Open Finance ou criar manualmente.",
            cta: "Adicionar conta",
            action: () => setModal("conta"),
          },
          {
            key: "saldo",
            icon: Coins,
            title: "Informar o saldo inicial",
            why: "Garante que seu caixa parta de um valor real e que os relatórios sejam precisos desde o primeiro dia.",
            cta: "Definir saldo",
            action: () => navigate("/app/configuracoes/financeiro/contas-bancarias"),
          },
          {
            key: "centro_custo",
            icon: Layers,
            title: "Criar pelo menos 1 centro de custo",
            why: "Organiza seus gastos por área (Marketing, Vendas, Operações). Desbloqueia análises por departamento.",
            cta: "Criar centro de custo",
            action: () => setModal("centro"),
          },
          {
            key: "categoria",
            icon: Tags,
            title: "Criar categorias financeiras",
            why: "Categorias classificam suas movimentações e alimentam o DRE automaticamente.",
            cta: "Criar categoria",
            action: () => setModal("categoria"),
          },
        ],
      },
      {
        title: "Cadastros operacionais",
        description: "Quem paga e quem recebe — para você lançar contas em segundos.",
        steps: [
          {
            key: "cliente",
            icon: Users,
            title: "Cadastrar o primeiro cliente",
            why: "Liga as contas a receber a uma pessoa/empresa real e habilita o workspace 360 do cliente.",
            cta: "Cadastrar cliente",
            action: () => setModal("cliente"),
          },
          {
            key: "fornecedor",
            icon: Truck,
            title: "Cadastrar o primeiro fornecedor",
            why: "Necessário para registrar contas a pagar e acompanhar o histórico por fornecedor.",
            cta: "Cadastrar fornecedor",
            action: () => setModal("fornecedor"),
          },
        ],
      },
      {
        title: "Primeiros passos & equipe",
        description: "Coloque o sistema para trabalhar e traga seu time.",
        steps: [
          {
            key: "lancamento",
            icon: Receipt,
            title: "Registrar o primeiro lançamento",
            why: "É aqui que a mágica acontece: você verá o caixa, DRE e dashboards reagindo em tempo real.",
            cta: "Lançar agora",
            action: () => navigate("/app/financas/pagar"),
          },
        ],
      },
    ],
    [navigate]
  );

  // Empresa step is implicit — sempre verdadeiro nesse ponto (chega aqui só com empresa criada)
  const inviteAction = () => navigate("/app/configuracoes/empresa?tab=permissoes");

  if (!status || isDismissed || isComplete) {
    // Mostra apenas o botão flutuante de "Concluído" se 100%; caso dispensado, esconde.
    if (isComplete && !isDismissed) {
      return (
        <FloatingButton onClick={() => setOpen(true)} progress={100} done={doneSteps} total={totalSteps} complete />
      );
    }
    return null;
  }

  return (
    <>
      <FloatingButton onClick={() => setOpen(true)} progress={progress} done={doneSteps} total={totalSteps} />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-5 py-4 border-b">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Configure seu Orks
                </SheetTitle>
                <SheetDescription className="text-xs mt-1">
                  Tudo é opcional, mas estes passos destravam o melhor do sistema.
                </SheetDescription>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{doneSteps} de {totalSteps} concluídos</span>
                <span className="font-medium text-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {groups.map((group) => (
              <div key={group.title} className="space-y-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.title}
                  </h3>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">{group.description}</p>
                </div>
                <div className="space-y-1.5">
                  {group.steps.map((step) => {
                    const done = !!steps?.[step.key];
                    const Icon = step.icon;
                    return (
                      <Card
                        key={step.key}
                        className={cn(
                          "p-3 transition-colors",
                          done ? "bg-success/5 border-success/30" : "hover:bg-accent/40"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {done ? (
                              <CheckCircle2 className="w-4 h-4 text-success" />
                            ) : (
                              <Circle className="w-4 h-4 text-muted-foreground/40" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                              <h4 className={cn("text-sm font-medium", done && "text-muted-foreground line-through")}>
                                {step.title}
                              </h4>
                            </div>
                            {!done && (
                              <>
                                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{step.why}</p>
                                <Button
                                  size="sm"
                                  variant="link"
                                  className="h-auto p-0 mt-1.5 text-xs text-primary"
                                  onClick={() => {
                                    setOpen(false);
                                    step.action();
                                  }}
                                >
                                  {step.cta} <ChevronRight className="w-3 h-3 ml-0.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Etapa não rastreada — convidar equipe */}
            <div className="space-y-2 pt-2 border-t">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bônus</h3>
              <Card className="p-3 hover:bg-accent/40 transition-colors">
                <div className="flex items-start gap-3">
                  <Rocket className="w-4 h-4 text-primary mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium">Convidar a equipe</h4>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      Adicione colegas com permissões granulares por módulo.
                    </p>
                    <Button
                      size="sm"
                      variant="link"
                      className="h-auto p-0 mt-1.5 text-xs text-primary"
                      onClick={() => {
                        setOpen(false);
                        inviteAction();
                      }}
                    >
                      Gerenciar permissões <ChevronRight className="w-3 h-3 ml-0.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <div className="border-t px-5 py-3 flex items-center justify-between">
            <button
              onClick={() => {
                dismissChecklist(true);
                setOpen(false);
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Dispensar este guia
            </button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Modais lançados pelos passos */}
      <ContaBancariaModal
        open={modal === "conta"}
        onOpenChange={(o) => !o && setModal(null)}
        onSaved={() => {
          setModal(null);
          refetch();
        }}
      />
      <CentroCustoModal
        open={modal === "centro"}
        onOpenChange={(o) => !o && setModal(null)}
        onSaved={() => {
          setModal(null);
          refetch();
        }}
      />
      <CategoriaFinanceiraModal
        open={modal === "categoria"}
        onOpenChange={(o) => !o && setModal(null)}
        defaultTipo="despesa"
        onSaved={() => {
          setModal(null);
          refetch();
        }}
      />
      <ClienteModal
        open={modal === "cliente"}
        onOpenChange={(o) => !o && setModal(null)}
        onSaved={() => {
          setModal(null);
          refetch();
        }}
      />
      <FornecedorModal
        open={modal === "fornecedor"}
        onOpenChange={(o) => !o && setModal(null)}
        onSaved={() => {
          setModal(null);
          refetch();
        }}
      />
    </>
  );
}

function FloatingButton({
  onClick,
  progress,
  done,
  total,
  complete = false,
}: {
  onClick: () => void;
  progress: number;
  done: number;
  total: number;
  complete?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed bottom-6 right-6 z-40 group",
        "flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-full",
        "bg-card border border-border shadow-lg hover:shadow-xl",
        "transition-all hover:scale-[1.02]",
        complete && "border-success/40"
      )}
    >
      <div className="relative w-7 h-7">
        <svg className="w-7 h-7 -rotate-90" viewBox="0 0 28 28">
          <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="2" fill="none" className="text-muted/30" />
          <circle
            cx="14"
            cy="14"
            r="12"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeDasharray={2 * Math.PI * 12}
            strokeDashoffset={2 * Math.PI * 12 * (1 - progress / 100)}
            className={cn("transition-all", complete ? "text-success" : "text-primary")}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {complete ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          )}
        </div>
      </div>
      <div className="flex flex-col items-start leading-tight">
        <span className="text-xs font-semibold">
          {complete ? "Configuração completa" : "Configurar Orks"}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {done}/{total} concluídos · {progress}%
        </span>
      </div>
    </button>
  );
}
