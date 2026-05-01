import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "Quanto tempo leva para começar?",
    a: "Menos de 5 minutos. Você cria a conta, valida o CNPJ via Receita Federal e já tem acesso ao dashboard. Importação de plano de contas e cadastros pode ser feita por planilha ou manualmente.",
  },
  {
    q: "Vocês integram com meu banco?",
    a: "Sim. Via Pluggy (Open Finance), suportamos os principais bancos do Brasil — Itaú, Bradesco, Santander, BB, Caixa, Inter, Nubank, C6 e muitos outros — com sincronização automática de extratos e cartões.",
  },
  {
    q: "Posso gerenciar mais de uma empresa?",
    a: "Sim. O Orks é multi-empresa nativo. Os planos definem o número máximo de empresas ativas, e os dados ficam totalmente isolados por empresa.",
  },
  {
    q: "Existe trial gratuito?",
    a: "Sim. 7 dias gratuitos em qualquer plano. Após o trial, sua assinatura é ativada automaticamente — você pode cancelar quando quiser, sem multa.",
  },
  {
    q: "Como funciona a segurança e LGPD?",
    a: "Criptografia em trânsito e em repouso, multi-tenant com Row-Level Security, audit logs completos, backups diários e conformidade LGPD. Seus dados são seus — exporte a qualquer momento.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. Sem fidelidade, sem multa. Cancele direto pelo portal de assinatura a qualquer momento.",
  },
];

export const FAQ = () => {
  return (
    <section id="faq" className="py-20 md:py-28 relative">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12 reveal">
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs font-medium text-muted-foreground mb-5">
            Perguntas frequentes
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight">
            Tudo que você precisa saber.
          </h2>
        </div>

        <Accordion type="single" collapsible className="space-y-3 reveal">
          {faqs.map((f, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="border border-border rounded-2xl bg-surface px-6 hover:border-primary/30 transition-colors data-[state=open]:border-primary/40 data-[state=open]:shadow-glow-sm"
            >
              <AccordionTrigger className="text-left font-display font-semibold text-base md:text-lg hover:no-underline py-5">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};
