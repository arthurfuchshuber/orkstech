import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, Play } from "lucide-react";
import { GatilhosTab } from "@/components/automacoes/GatilhosTab";
import { AcoesTab } from "@/components/automacoes/AcoesTab";

export default function Automacoes() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Automações</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Gerencie gatilhos e ações do sistema</p>
      </div>

      <Tabs defaultValue="gatilhos" className="space-y-6">
        <TabsList className="bg-muted/30 border border-border/30">
          <TabsTrigger value="gatilhos" className="gap-2 data-[state=active]:bg-background">
            <Target className="w-3.5 h-3.5" /> Gatilhos
          </TabsTrigger>
          <TabsTrigger value="acoes" className="gap-2 data-[state=active]:bg-background">
            <Play className="w-3.5 h-3.5" /> Ações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gatilhos">
          <GatilhosTab />
        </TabsContent>
        <TabsContent value="acoes">
          <AcoesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
