import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Target, Play } from "lucide-react";
import { RegrasTab } from "@/components/automacoes/RegrasTab";
import { GatilhosTab } from "@/components/automacoes/GatilhosTab";
import { AcoesTab } from "@/components/automacoes/AcoesTab";

export default function Automacoes() {
  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Automações</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Gerencie regras, gatilhos e ações do sistema</p>
      </div>

      <Tabs defaultValue="regras" className="space-y-6">
        <TabsList className="bg-muted/30 border border-border/30">
          <TabsTrigger value="regras" className="gap-2 data-[state=active]:bg-background">
            <Zap className="w-3.5 h-3.5" /> Regras
          </TabsTrigger>
          <TabsTrigger value="gatilhos" className="gap-2 data-[state=active]:bg-background">
            <Target className="w-3.5 h-3.5" /> Gatilhos
          </TabsTrigger>
          <TabsTrigger value="acoes" className="gap-2 data-[state=active]:bg-background">
            <Play className="w-3.5 h-3.5" /> Ações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="regras">
          <RegrasTab />
        </TabsContent>
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
