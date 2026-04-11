import { Settings, User, Shield, Palette, Database, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const sections = [
  { icon: Settings, title: "Geral", description: "Nome da empresa, fuso horário, moeda e preferências gerais", url: "/app/config" },
  { icon: User, title: "Usuários", description: "Gerenciar membros da equipe, convites e permissões individuais", url: "/app/config/usuarios" },
  { icon: Shield, title: "Permissões", description: "Papéis, controle de acesso e políticas de segurança", url: "/app/config/permissoes" },
  { icon: Palette, title: "Aparência", description: "Personalizar tema, cores, logo e branding da plataforma", url: "/app/config/aparencia" },
  { icon: Database, title: "Dados", description: "Exportar, importar, backup e gerenciamento de dados", url: "/app/config/dados" },
];

export default function Configuracoes() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground text-sm">Gerencie as configurações da plataforma</p>
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
