// Event Bus System - Core event-driven architecture

export type EventType =
  | "cliente.criado" | "cliente.atualizado" | "cliente.removido"
  | "fornecedor.criado" | "fornecedor.atualizado"
  | "contrato.criado" | "contrato.atualizado" | "contrato.renovado" | "contrato.vencendo"
  | "financeiro.cobranca_criada" | "financeiro.pagamento_recebido" | "financeiro.cobranca_vencida"
  | "documento.anexado" | "documento.removido"
  | "atividade.criada"
  | "usuario.criado" | "usuario.atualizado";

export interface SystemEvent {
  id: string;
  type: EventType;
  timestamp: Date;
  data: Record<string, unknown>;
  userId?: string;
  moduloOrigem: string;
  registroId?: string;
}

export interface Notification {
  id: string;
  tipo: "alerta" | "lembrete" | "informacao";
  titulo: string;
  descricao: string;
  timestamp: Date;
  lida: boolean;
  eventType?: EventType;
  registroId?: string;
  moduloOrigem?: string;
}

export interface HistoryEntry {
  id: string;
  usuario: string;
  data: Date;
  acao: string;
  registroTipo: string;
  registroId: string;
  descricao: string;
}

export interface Automation {
  id: string;
  nome: string;
  descricao: string;
  ativo: boolean;
  eventoGatilho: EventType;
  condicoes: AutomationCondition[];
  acoes: AutomationAction[];
  criadoEm: Date;
  executadoCount: number;
}

export interface AutomationCondition {
  campo: string;
  operador: "igual" | "diferente" | "contem" | "maior" | "menor";
  valor: string;
}

export interface AutomationAction {
  tipo: "criar_historico" | "criar_atividade" | "criar_notificacao" | "criar_financeiro" | "atualizar_status";
  config: Record<string, unknown>;
}

type EventHandler = (event: SystemEvent) => void;

class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();
  private history: HistoryEntry[] = [];
  private notifications: Notification[] = [];
  private automations: Automation[] = this.getDefaultAutomations();
  private listeners: Set<() => void> = new Set();

  on(eventType: EventType | "*", handler: EventHandler) {
    const existing = this.handlers.get(eventType) || [];
    existing.push(handler);
    this.handlers.set(eventType, existing);
    return () => {
      const handlers = this.handlers.get(eventType) || [];
      this.handlers.set(eventType, handlers.filter(h => h !== handler));
    };
  }

  emit(event: Omit<SystemEvent, "id" | "timestamp">) {
    const fullEvent: SystemEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    // Execute direct handlers
    const handlers = [
      ...(this.handlers.get(event.type) || []),
      ...(this.handlers.get("*") || []),
    ];
    handlers.forEach(h => h(fullEvent));

    // Auto-generate history
    this.addHistory(fullEvent);

    // Run automations
    this.runAutomations(fullEvent);

    this.notifyListeners();
  }

  private addHistory(event: SystemEvent) {
    const labels: Record<string, string> = {
      "cliente.criado": "Cliente criado",
      "cliente.atualizado": "Cliente atualizado",
      "fornecedor.criado": "Fornecedor criado",
      "contrato.criado": "Contrato criado",
      "contrato.renovado": "Contrato renovado",
      "contrato.vencendo": "Contrato próximo do vencimento",
      "financeiro.cobranca_criada": "Cobrança criada",
      "financeiro.pagamento_recebido": "Pagamento recebido",
      "financeiro.cobranca_vencida": "Cobrança vencida",
      "documento.anexado": "Documento anexado",
      "atividade.criada": "Atividade registrada",
    };

    this.history.unshift({
      id: crypto.randomUUID(),
      usuario: (event.data.usuario as string) || "Sistema",
      data: event.timestamp,
      acao: labels[event.type] || event.type,
      registroTipo: event.moduloOrigem,
      registroId: event.registroId || "",
      descricao: (event.data.descricao as string) || `Evento ${event.type} registrado`,
    });
  }

  private runAutomations(event: SystemEvent) {
    const matching = this.automations.filter(a => a.ativo && a.eventoGatilho === event.type);
    
    matching.forEach(automation => {
      // Check conditions
      const conditionsMet = automation.condicoes.every(cond => {
        const value = event.data[cond.campo];
        switch (cond.operador) {
          case "igual": return value === cond.valor;
          case "diferente": return value !== cond.valor;
          case "contem": return String(value).includes(cond.valor);
          default: return true;
        }
      });

      if (!conditionsMet && automation.condicoes.length > 0) return;

      // Execute actions
      automation.acoes.forEach(action => {
        switch (action.tipo) {
          case "criar_notificacao":
            this.addNotification({
              tipo: (action.config.tipo as Notification["tipo"]) || "informacao",
              titulo: (action.config.titulo as string) || automation.nome,
              descricao: (action.config.descricao as string) || `Automação "${automation.nome}" executada`,
              eventType: event.type,
              registroId: event.registroId,
              moduloOrigem: event.moduloOrigem,
            });
            break;
          case "criar_historico":
            // Already added by default
            break;
          case "criar_atividade":
            this.addNotification({
              tipo: "lembrete",
              titulo: (action.config.titulo as string) || "Nova tarefa",
              descricao: (action.config.descricao as string) || "Atividade criada automaticamente",
              eventType: event.type,
              registroId: event.registroId,
              moduloOrigem: event.moduloOrigem,
            });
            break;
        }
      });

      automation.executadoCount++;
    });
  }

  addNotification(notif: Omit<Notification, "id" | "timestamp" | "lida">) {
    this.notifications.unshift({
      ...notif,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      lida: false,
    });
    this.notifyListeners();
  }

  markNotificationRead(id: string) {
    const n = this.notifications.find(n => n.id === id);
    if (n) n.lida = true;
    this.notifyListeners();
  }

  markAllRead() {
    this.notifications.forEach(n => n.lida = true);
    this.notifyListeners();
  }

  getNotifications() { return [...this.notifications]; }
  getUnreadCount() { return this.notifications.filter(n => !n.lida).length; }
  getHistory() { return [...this.history]; }
  getAutomations() { return [...this.automations]; }
  
  toggleAutomation(id: string) {
    const a = this.automations.find(a => a.id === id);
    if (a) a.ativo = !a.ativo;
    this.notifyListeners();
  }

  addAutomation(automation: Omit<Automation, "id" | "criadoEm" | "executadoCount">) {
    this.automations.push({
      ...automation,
      id: crypto.randomUUID(),
      criadoEm: new Date(),
      executadoCount: 0,
    });
    this.notifyListeners();
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(l => l());
  }

  private getDefaultAutomations(): Automation[] {
    return [
      {
        id: "auto-1",
        nome: "Boas-vindas ao cliente",
        descricao: "Quando um cliente é criado, registra atividade de boas-vindas e notifica equipe",
        ativo: true,
        eventoGatilho: "cliente.criado",
        condicoes: [],
        acoes: [
          { tipo: "criar_notificacao", config: { tipo: "informacao", titulo: "Novo cliente cadastrado", descricao: "Um novo cliente foi adicionado ao sistema" } },
          { tipo: "criar_atividade", config: { titulo: "Boas-vindas", descricao: "Agendar contato de boas-vindas com o novo cliente" } },
        ],
        criadoEm: new Date(),
        executadoCount: 0,
      },
      {
        id: "auto-2",
        nome: "Parcelas do contrato",
        descricao: "Quando um contrato é criado, gera parcelas no financeiro e notifica responsável",
        ativo: true,
        eventoGatilho: "contrato.criado",
        condicoes: [],
        acoes: [
          { tipo: "criar_financeiro", config: {} },
          { tipo: "criar_notificacao", config: { tipo: "informacao", titulo: "Contrato criado", descricao: "Novo contrato registrado, parcelas geradas automaticamente" } },
        ],
        criadoEm: new Date(),
        executadoCount: 0,
      },
      {
        id: "auto-3",
        nome: "Alerta de cobrança vencida",
        descricao: "Quando uma cobrança vence, cria alerta para equipe financeira",
        ativo: true,
        eventoGatilho: "financeiro.cobranca_vencida",
        condicoes: [],
        acoes: [
          { tipo: "criar_notificacao", config: { tipo: "alerta", titulo: "Cobrança vencida", descricao: "Uma cobrança está vencida e precisa de atenção" } },
        ],
        criadoEm: new Date(),
        executadoCount: 0,
      },
      {
        id: "auto-4",
        nome: "Registro de pagamento",
        descricao: "Quando um pagamento é recebido, atualiza indicadores e notifica",
        ativo: true,
        eventoGatilho: "financeiro.pagamento_recebido",
        condicoes: [],
        acoes: [
          { tipo: "criar_notificacao", config: { tipo: "informacao", titulo: "Pagamento recebido", descricao: "Um pagamento foi registrado no sistema" } },
          { tipo: "atualizar_status", config: {} },
        ],
        criadoEm: new Date(),
        executadoCount: 0,
      },
      {
        id: "auto-5",
        nome: "Documento vinculado",
        descricao: "Quando um documento é anexado, registra no histórico e notifica",
        ativo: true,
        eventoGatilho: "documento.anexado",
        condicoes: [],
        acoes: [
          { tipo: "criar_notificacao", config: { tipo: "informacao", titulo: "Documento anexado", descricao: "Um novo documento foi vinculado a um registro" } },
        ],
        criadoEm: new Date(),
        executadoCount: 0,
      },
      {
        id: "auto-6",
        nome: "Renovação de contrato",
        descricao: "Quando um contrato está próximo do vencimento, cria atividade de renovação",
        ativo: true,
        eventoGatilho: "contrato.vencendo",
        condicoes: [],
        acoes: [
          { tipo: "criar_notificacao", config: { tipo: "alerta", titulo: "Contrato vencendo", descricao: "Um contrato está próximo do vencimento e precisa de renovação" } },
          { tipo: "criar_atividade", config: { titulo: "Renovação", descricao: "Agendar reunião para renovação do contrato" } },
        ],
        criadoEm: new Date(),
        executadoCount: 0,
      },
    ];
  }
}

export const eventBus = new EventBus();
