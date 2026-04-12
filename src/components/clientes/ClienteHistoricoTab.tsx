import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock, Sparkles, Plus, Loader2, User, FileText, MessageSquare, DollarSign, Edit, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props {
  clienteId: string;
}

const tipoIcons: Record<string, any> = {
  atualizacao_cadastral: Edit,
  documento_anexado: FileText,
  interacao: MessageSquare,
  evento_financeiro: DollarSign,
  observacao: Eye,
};

const tipoLabels: Record<string, string> = {
  atualizacao_cadastral: "Atualização cadastral",
  documento_anexado: "Documento anexado",
  interacao: "Interação",
  evento_financeiro: "Evento financeiro",
  observacao: "Observação interna",
};

export function ClienteHistoricoTab({ clienteId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [tipo, setTipo] = useState("interacao");
  const [descricao, setDescricao] = useState("");

  const { data: interacoes = [], isLoading } = useQuery({
    queryKey: ["cliente-interacoes", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cliente_interacoes")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cliente_interacoes").insert({
        user_id: user!.id,
        cliente_id: clienteId,
        tipo,
        descricao,
        usuario_nome: user?.email?.split("@")[0] || "Usuário",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cliente-interacoes", clienteId] });
      toast.success("Interação registrada");
      setDescricao("");
      setShowForm(false);
    },
  });

  // Generate smart summary from interactions
  const tempoRelacionamento = interacoes.length > 0
    ? formatDistanceToNow(new Date(interacoes[interacoes.length - 1].created_at), { locale: ptBR })
    : null;

  const ultimaInteracao = interacoes.length > 0
    ? formatDistanceToNow(new Date(interacoes[0].created_at), { locale: ptBR, addSuffix: true })
    : null;

  return (
    <div className="space-y-6">
      {/* Resumo Inteligente */}
      <Card className="p-5 border-border/50 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Resumo Inteligente</h3>
        </div>
        {interacoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma interação registrada ainda. Registre a primeira interação para gerar um resumo automático.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Tempo de relacionamento</p>
              <p className="text-sm font-medium text-foreground">{tempoRelacionamento}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total de interações</p>
              <p className="text-sm font-medium text-foreground">{interacoes.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Última interação</p>
              <p className="text-sm font-medium text-foreground">{ultimaInteracao}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Situação</p>
              <Badge variant="default" className="text-xs">Ativo</Badge>
            </div>
          </div>
        )}
      </Card>

      {/* New interaction */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Timeline de Eventos
        </h3>
        <Button size="sm" variant="outline" className="gap-2 rounded-lg" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4" /> Registrar Interação
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 border-border/50 shadow-sm space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(tipoLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="col-span-2">
              <Textarea
                placeholder="Descreva a interação..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="min-h-[80px] text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" className="gap-2" onClick={() => mutation.mutate()} disabled={!descricao.trim() || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Salvar
            </Button>
          </div>
        </Card>
      )}

      {/* Timeline */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : interacoes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <Clock className="w-8 h-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhuma interação registrada</p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-0">
          <div className="absolute left-2.5 top-2 bottom-2 w-px bg-border/50" />
          {interacoes.map((item) => {
            const Icon = tipoIcons[item.tipo] || MessageSquare;
            return (
              <div key={item.id} className="relative pb-6 last:pb-0">
                <div className="absolute -left-3.5 top-1 w-5 h-5 rounded-full bg-card border-2 border-primary/30 flex items-center justify-center">
                  <Icon className="w-2.5 h-2.5 text-primary" />
                </div>
                <div className="ml-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-foreground">
                      {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                    <Badge variant="outline" className="text-xs">{tipoLabels[item.tipo] || item.tipo}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.descricao}</p>
                  {item.usuario_nome && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground/70">
                      <User className="w-3 h-3" /> {item.usuario_nome}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
