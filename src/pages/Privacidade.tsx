import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Privacidade() {
  useEffect(() => {
    document.title = "Política de Privacidade | NexusOS";
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
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Política de Privacidade</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <article className="prose prose-invert max-w-none">
          <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">Política de Privacidade</h1>
          <p className="text-sm text-muted-foreground mb-8">Última atualização: 21 de abril de 2026</p>

          <section className="space-y-6 text-sm text-foreground/90 leading-relaxed">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">1. Quem somos</h2>
              <p>
                O <strong>NexusOS</strong> é uma plataforma SaaS de gestão financeira e operacional. Esta
                Política descreve como coletamos, utilizamos, armazenamos e protegemos os dados pessoais e
                empresariais dos nossos usuários, em conformidade com a{" "}
                <strong>Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD)</strong>.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">2. Dados que coletamos</h2>
              <p>Coletamos as seguintes categorias de dados:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li><strong>Cadastrais:</strong> nome, e-mail, telefone, CPF/CNPJ, razão social, endereço.</li>
                <li><strong>Financeiros:</strong> dados de cartão de crédito (processados e armazenados exclusivamente pela Stripe — não temos acesso ao número completo do cartão).</li>
                <li><strong>Operacionais:</strong> lançamentos financeiros, cadastros de clientes/fornecedores, documentos anexados, transações bancárias importadas via Open Finance.</li>
                <li><strong>Técnicos:</strong> endereço IP, tipo de navegador, logs de acesso e cookies essenciais.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">3. Como utilizamos seus dados</h2>
              <p>Utilizamos seus dados exclusivamente para:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Prestação dos serviços contratados (execução do contrato);</li>
                <li>Processamento de pagamentos via Stripe;</li>
                <li>Envio de comunicações transacionais (faturas, alertas, recuperação de senha);</li>
                <li>Cumprimento de obrigações legais e regulatórias;</li>
                <li>Melhoria contínua da plataforma e prevenção a fraudes;</li>
                <li>Suporte técnico ao usuário.</li>
              </ul>
              <p className="mt-2">
                <strong>Não vendemos seus dados.</strong> Não enviamos comunicações de marketing sem seu
                consentimento explícito.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">4. Compartilhamento com terceiros</h2>
              <p>Compartilhamos dados estritamente necessários com os seguintes operadores:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li><strong>Stripe</strong> — processamento de pagamentos e gestão de assinaturas;</li>
                <li><strong>Supabase / Lovable Cloud</strong> — infraestrutura de banco de dados e autenticação;</li>
                <li><strong>Pluggy</strong> — integração de Open Finance (apenas se o usuário conectar contas bancárias);</li>
                <li><strong>Asaas</strong> — geração de boletos e PIX (apenas se o usuário ativar a integração);</li>
                <li><strong>ClickSign</strong> — assinatura eletrônica de documentos (opcional);</li>
                <li><strong>Autoridades públicas</strong> — quando legalmente exigido.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">5. Segurança</h2>
              <p>Adotamos medidas técnicas e organizacionais para proteger seus dados:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Criptografia em trânsito (TLS 1.2+) e em repouso;</li>
                <li>Controle de acesso por papéis (RBAC) e Row-Level Security no banco de dados;</li>
                <li>Multi-tenant com isolamento estrito por organização (empresa);</li>
                <li>Backups automáticos diários;</li>
                <li>Auditoria de acessos e alterações sensíveis;</li>
                <li>Hospedagem em provedores certificados (SOC 2, ISO 27001).</li>
              </ul>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">6. Retenção de dados</h2>
              <p>
                Mantemos seus dados enquanto sua conta estiver ativa. Após o cancelamento, os dados ficam
                disponíveis para exportação por <strong>30 dias</strong> e, em seguida, são excluídos
                permanentemente — exceto quando a retenção for exigida por lei (ex.: dados fiscais por até 5 anos).
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">7. Seus direitos como titular (LGPD)</h2>
              <p>Você pode, a qualquer momento, solicitar:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Confirmação da existência de tratamento de seus dados;</li>
                <li>Acesso e portabilidade dos dados;</li>
                <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
                <li>Anonimização, bloqueio ou eliminação de dados desnecessários;</li>
                <li>Revogação de consentimento;</li>
                <li>Informações sobre o compartilhamento com terceiros.</li>
              </ul>
              <p className="mt-2">
                As solicitações devem ser enviadas para{" "}
                <a href="mailto:privacidade@nexusos.com.br" className="text-primary hover:underline">
                  privacidade@nexusos.com.br
                </a>
                {" "}e serão respondidas em até 15 dias úteis.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">8. Cookies</h2>
              <p>
                Utilizamos apenas <strong>cookies essenciais</strong> para autenticação e funcionamento da
                plataforma. Não usamos cookies de rastreamento publicitário de terceiros.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">9. Encarregado de Dados (DPO)</h2>
              <p>
                Para questões relacionadas à proteção de dados, entre em contato com nosso Encarregado:{" "}
                <a href="mailto:dpo@nexusos.com.br" className="text-primary hover:underline">
                  dpo@nexusos.com.br
                </a>.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">10. Alterações desta Política</h2>
              <p>
                Esta Política pode ser atualizada periodicamente. Alterações materiais serão comunicadas por
                e-mail e/ou aviso na plataforma com no mínimo 15 dias de antecedência.
              </p>
            </div>

            <div className="pt-6 border-t border-border/40">
              <p className="text-xs text-muted-foreground">
                Ao utilizar o NexusOS, você confirma ter lido e compreendido esta Política de Privacidade.
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
