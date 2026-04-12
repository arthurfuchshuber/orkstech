import { Settings, ChevronRight, Building2, CreditCard, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

const sections: { icon: LucideIcon; title: string; description: string; url: string }[] = [
  { icon: Settings, title: "Geral", description: "Preferências gerais do sistema, fuso horário e moeda", url: "/app/config/geral" },
  { icon: Building2, title: "Empresa e Usuários", description: "Dados da empresa, informações de usuários e permissões de acesso", url: "/app/config/conta" },
  { icon: CreditCard, title: "Planos e Assinatura", description: "Gerencie seu plano, faturamento e métodos de pagamento", url: "/app/config/planos" },
  { icon: Menu, title: "Gerenciar Menu", description: "Reordene e configure os itens de navegação do sistema", url: "/app/config/menus" },
];

export default function Configuracoes() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Gerencie as configurações da plataforma</p>
      </div>

      <div className="space-y-3">
        {sections.map((s) => (
          <div
            key={s.title}
            onClick={() => navigate(s.url)}
            className="p-5 rounded-xl glass hover:border-primary/20 transition-all duration-300 cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <s.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.description}</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        ))}
      </div>
    </div>
  );
}
