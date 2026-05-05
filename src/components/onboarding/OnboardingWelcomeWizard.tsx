import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Wallet, ListChecks, Rocket, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useEmpresa } from "@/hooks/useEmpresa";
import { ContaBancariaModal } from "@/components/modals/ContaBancariaModal";

/**
 * Wizard de boas-vindas mostrado UMA VEZ por empresa, opcional (skip permitido).
 * Apresenta o produto, oferece criar a 1ª conta e termina entregando o checklist.
 */
export function OnboardingWelcomeWizard() {
  const { empresa } = useEmpresa();
  const { status, completeWizard, refetch } = useOnboarding();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [contaOpen, setContaOpen] = useState(false);

  useEffect(() => {
    if (!empresa || !status) return;
    if (status.wizard_completed_at) return;
    // Mostra na 1ª vez que abre o app após criar a empresa
    setOpen(true);
  }, [empresa, status]);

  const finish = () => {
    completeWizard();
    setOpen(false);
    setStep(0);
  };

  const skip = () => {
    completeWizard();
    setOpen(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (!o ? skip() : setOpen(o))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <DialogTitle className="text-lg">Bem-vindo ao Orks</DialogTitle>
            </div>
            <DialogDescription className="pt-1">
              Em 3 passos rápidos você entende como o sistema funciona. Pode pular a qualquer momento — nada é obrigatório.
            </DialogDescription>
          </DialogHeader>

          {step === 0 && (
            <div className="space-y-4 py-2">
              <Tile
                icon={Wallet}
                title="Caixa em tempo real"
                desc="Conecte contas via Open Finance ou cadastre manualmente. O saldo da empresa fica sempre atualizado."
              />
              <Tile
                icon={ListChecks}
                title="Operação financeira completa"
                desc="Contas a pagar/receber, DRE, centros de custo e relatórios — tudo conectado."
              />
              <Tile
                icon={Rocket}
                title="Cresça com a equipe"
                desc="Convide colegas com permissões granulares por módulo quando estiver pronto."
              />
            </div>
          )}

          {step === 1 && (
            <div className="py-2 space-y-4">
              <h3 className="font-semibold">Vamos cadastrar sua primeira conta?</h3>
              <p className="text-sm text-muted-foreground">
                Sem uma conta bancária, o caixa fica vazio. Você pode adicionar agora ou depois — fica disponível no
                checklist no canto da tela.
              </p>
              <Button
                onClick={() => setContaOpen(true)}
                className="w-full"
                variant="outline"
              >
                <Wallet className="w-4 h-4 mr-2" /> Adicionar conta bancária agora
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="py-2 space-y-3 text-center">
              <div className="w-14 h-14 rounded-full bg-success/15 mx-auto flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-success" />
              </div>
              <h3 className="font-semibold">Tudo pronto para começar!</h3>
              <p className="text-sm text-muted-foreground">
                Use o botão <strong>Configurar Orks</strong> no canto inferior direito para continuar configurando
                quando quiser. Cada passo te orienta sobre o que fazer e por quê.
              </p>
            </div>
          )}

          <div className="flex justify-between items-center pt-3 border-t">
            <button
              onClick={skip}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Pular tutorial
            </button>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${i === step ? "bg-primary" : "bg-muted"}`}
                  />
                ))}
              </div>
              {step < 2 ? (
                <Button size="sm" onClick={() => setStep(step + 1)}>
                  Continuar <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              ) : (
                <Button size="sm" onClick={finish}>
                  Começar a usar
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ContaBancariaModal
        open={contaOpen}
        onOpenChange={setContaOpen}
        onSaved={() => {
          setContaOpen(false);
          refetch();
        }}
      />
    </>
  );
}

function Tile({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-3 p-3 rounded-lg border bg-card/50">
      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
