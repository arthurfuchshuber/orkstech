import { OrksWordmark } from "@/components/OrksWordmark";

export const Footer = () => {
  return (
    <footer className="border-t border-border/60 py-12 mt-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-3 gap-10">
          <div>
            <div className="flex items-center gap-3">
              <OrksWordmark size="text-xl" />
              <span className="text-[10px] text-muted-foreground tracking-[0.25em] uppercase border-l border-border/40 pl-3">
                Gestão 360º
              </span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground max-w-sm">
              Plataforma de Gestão 360º para prestadores de serviço. Financeiro, clientes, contratos e operação em uma única tela.
            </p>
          </div>

          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Navegação
            </div>
            <ul className="space-y-2 text-sm">
              <li><a href="#dores" className="hover:text-primary transition-colors">Dores resolvidas</a></li>
              <li><a href="#produto" className="hover:text-primary transition-colors">Produto</a></li>
              <li><a href="#prova" className="hover:text-primary transition-colors">Resultados</a></li>
              <li><a href="#planos" className="hover:text-primary transition-colors">Planos</a></li>
              <li><a href="#faq" className="hover:text-primary transition-colors">FAQ</a></li>
            </ul>
          </div>

          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
              Legal
            </div>
            <ul className="space-y-2 text-sm">
              <li><a href="/termos" className="hover:text-primary transition-colors">Termos de uso</a></li>
              <li><a href="/privacidade" className="hover:text-primary transition-colors">Privacidade</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border/60 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>© {new Date().getFullYear()} Orks. Todos os direitos reservados.</div>
          <div>By Anfitrião Sigma</div>
        </div>
      </div>
    </footer>
  );
};
