import { Phone, Mail, Video, CheckSquare, Calendar, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const activityIcons = {
  ligacao: Phone,
  email: Mail,
  reuniao: Video,
  tarefa: CheckSquare,
};

const activityLabels = {
  ligacao: "Ligação",
  email: "Email",
  reuniao: "Reunião",
  tarefa: "Tarefa",
};

interface ActivityItem {
  id: string;
  tipo: "ligacao" | "email" | "reuniao" | "tarefa";
  descricao: string;
  data: string;
  usuario?: string;
}

interface RelatedActivitiesProps {
  activities?: ActivityItem[];
}

export function RelatedActivities({ activities = [] }: RelatedActivitiesProps) {
  if (activities.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center">
        <div className="w-11 h-11 rounded-xl bg-muted/30 flex items-center justify-center mb-3">
          <Phone className="w-5 h-5 text-muted-foreground/30" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">Nenhuma atividade registrada</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Registre ligações, emails, reuniões e tarefas</p>
        <Button variant="outline" size="sm" className="mt-4 rounded-lg gap-1.5">
          <Phone className="w-3 h-3" /> Nova atividade
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activities.map((act) => {
        const Icon = activityIcons[act.tipo];
        return (
          <Card key={act.id} className="p-3 border-border/40 flex items-center gap-3 hover:bg-muted/20 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">{activityLabels[act.tipo]}</span>
              </div>
              <p className="text-sm text-foreground truncate">{act.descricao}</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{act.data}</span>
              {act.usuario && <span className="flex items-center gap-1"><User className="w-3 h-3" />{act.usuario}</span>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
