import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Termos() {
  useEffect(() => {
    document.title = "Termos de Uso | Orks";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Termos de Uso</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <article className="prose prose-invert max-w-none">
          <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">Termos de Uso</h1>
          <p className="text-sm text-muted-foreground mb-8">Última atualização: 21 de abril de 2026</p>

          <section className="space-y-6 text-sm text-foreground/90 leading-relaxed">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">1. Aceitação dos Termos</h2>
              <p>
                Ao criar uma conta e utilizar a plataforma <strong>Orks</strong> ("Plataforma", "Serviço"),
                você ("Usuário") declara que leu, compreendeu e concorda integralmente com estes
                Termos de Uso, bem como com a nossa{" "}
                <Link to="/privacidade" className="text-primary hover:underline">Política de Privacidade</Link>.
                Caso não concorde, você não deve utilizar o Serviço.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">2. Descrição do Serviço</h2>
              <p>
                O Orks é uma plataforma SaaS (Software as a Service) de gestão financeira e operacional
                voltada para empresas prestadoras de serviços, oferecendo módulos de Contas a Pagar/Receber,
                Fluxo de Caixa, DRE, Cadastros, integração com Open Finance e automações.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">3. Cadastro e Conta</h2>
              <p>Para utilizar o Serviço, o Usuário deve:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Fornecer dados verdadeiros, completos e atualizados;</li>
                <li>Possuir CNPJ ativo na Receita Federal;</li>
                <li>Selecionar um plano de assinatura e fornecer um método de pagamento válido;</li>
                <li>Manter a confidencialidade de suas credenciais de acesso;</li>
                <li>Notificar imediatamente qualquer uso não autorizado da conta.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">4. Planos, Pagamentos e Trial</h2>
              <p>
                O Orks opera em modelo de assinatura recorrente (mensal, semestral ou anual). Todos os
                novos cadastros incluem <strong>7 dias de teste gratuito</strong>, ao final dos quais a
                cobrança é automaticamente processada via Stripe no método de pagamento informado.
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Os preços são exibidos em Reais (BRL) e podem ser reajustados com aviso prévio de 30 dias;</li>
                <li>O cancelamento pode ser feito a qualquer momento pelo portal de gestão da assinatura;</li>
                <li>Não há reembolso proporcional para períodos já pagos;</li>
                <li>Em caso de inadimplência, o acesso à plataforma é suspenso até a regularização.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">5. Uso Aceitável</h2>
              <p>O Usuário compromete-se a não:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Utilizar o Serviço para atividades ilícitas ou fraudulentas;</li>
                <li>Tentar acessar áreas restritas ou dados de outros usuários;</li>
                <li>Realizar engenharia reversa, descompilar ou copiar o software;</li>
                <li>Sobrecarregar a infraestrutura com requisições automatizadas não autorizadas;</li>
                <li>Inserir conteúdo ofensivo, ilegal ou que viole direitos de terceiros.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">6. Propriedade Intelectual</h2>
              <p>
                Todo o software, design, marcas, logos e conteúdo da Plataforma são de propriedade exclusiva
                do Orks. Os dados inseridos pelo Usuário (cadastros, lançamentos, documentos) permanecem
                de propriedade do próprio Usuário, que concede licença limitada para que o Orks os
                processe e armazene exclusivamente para a prestação do Serviço.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">7. Disponibilidade e Limitação de Responsabilidade</h2>
              <p>
                Buscamos manter a disponibilidade do Serviço em <strong>99,5% mensal</strong>, mas o Serviço
                é fornecido "no estado em que se encontra". O Orks não se responsabiliza por:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Decisões financeiras tomadas com base nos relatórios da plataforma;</li>
                <li>Indisponibilidades causadas por terceiros (provedores de cloud, bancos, Open Finance);</li>
                <li>Perdas indiretas, lucros cessantes ou danos morais decorrentes do uso ou impossibilidade de uso.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">8. Cancelamento e Encerramento</h2>
              <p>
                O Usuário pode cancelar sua assinatura a qualquer momento. O Orks reserva-se o direito de
                suspender ou encerrar contas que violem estes Termos, mediante notificação prévia sempre que
                possível. Após o encerramento, os dados ficam disponíveis para exportação por 30 dias e em
                seguida são permanentemente excluídos.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">9. Alterações dos Termos</h2>
              <p>
                Estes Termos podem ser atualizados a qualquer momento. Alterações materiais serão
                comunicadas por e-mail e/ou via aviso na plataforma com pelo menos 15 dias de antecedência.
                O uso continuado após essas alterações implica aceitação automática.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">10. Foro</h2>
              <p>
                Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro
                da comarca do domicílio do contratante para dirimir quaisquer controvérsias.
              </p>
            </div>

            <div className="pt-6 border-t border-border/40">
              <p className="text-xs text-muted-foreground">
                Para dúvidas sobre estes Termos, entre em contato pelo e-mail{" "}
                <a href="mailto:contato@nexusos.com.br" className="text-primary hover:underline">
                  contato@nexusos.com.br
                </a>.
              </p>
            </div>
          </section>

          <div className="mt-10 flex justify-center">
            <Button asChild variant="outline">
              <Link to="/">Voltar para a página inicial</Link>
            </Button>
          </div>
        </article>
      </main>
    </div>
  );
}
