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
type StoreListener = () => void;

class EventBus {
  private handlers = new Map<string, EventHandler[]>();
  private history: HistoryEntry[] = [];
  private notifications: Notification[] = [];
  private automations: Automation[] = this.getDefaultAutomations();
  private listeners = new Set<StoreListener>();

  on(eventType: EventType | "*", handler: EventHandler) {
    const existing = this.handlers.get(eventType) || [];
    this.handlers.set(eventType, [...existing, handler]);

    return () => {
      const handlers = this.handlers.get(eventType) || [];
      this.handlers.set(eventType, handlers.filter((item) => item !== handler));
    };
  }

  emit(event: Omit<SystemEvent, "id" | "timestamp">) {
    const fullEvent: SystemEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    const handlers = [
      ...(this.handlers.get(fullEvent.type) || []),
      ...(this.handlers.get("*") || []),
    ];

    handlers.forEach((handler) => handler(fullEvent));

    this.addHistory(fullEvent);
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

    const nextEntry: HistoryEntry = {
      id: crypto.randomUUID(),
      usuario: (event.data.usuario as string) || "Sistema",
      data: event.timestamp,
      acao: labels[event.type] || event.type,
      registroTipo: event.moduloOrigem,
      registroId: event.registroId || "",
      descricao: (event.data.descricao as string) || `Evento ${event.type} registrado`,
    };

    this.history = [nextEntry, ...this.history];
  }

  private runAutomations(event: SystemEvent) {
    const matching = this.automations.filter((automation) => automation.ativo && automation.eventoGatilho === event.type);

    if (matching.length === 0) return;

    for (const automation of matching) {
      const conditionsMet = automation.condicoes.every((condition) => {
        const value = event.data[condition.campo];

        switch (condition.operador) {
          case "igual":
            return value === condition.valor;
          case "diferente":
            return value !== condition.valor;
          case "contem":
            return String(value ?? "").includes(condition.valor);
          case "maior":
            return Number(value) > Number(condition.valor);
          case "menor":
            return Number(value) < Number(condition.valor);
          default:
            return true;
        }
      });

      if (!conditionsMet && automation.condicoes.length > 0) continue;

      for (const action of automation.acoes) {
        switch (action.tipo) {
          case "criar_notificacao":
            this.pushNotification({
              tipo: (action.config.tipo as Notification["tipo"]) || "informacao",
              titulo: (action.config.titulo as string) || automation.nome,
              descricao: (action.config.descricao as string) || `Automação "${automation.nome}" executada`,
              eventType: event.type,
              registroId: event.registroId,
              moduloOrigem: event.moduloOrigem,
            });
            break;
          case "criar_atividade":
            this.pushNotification({
              tipo: "lembrete",
              titulo: (action.config.titulo as string) || "Nova tarefa",
              descricao: (action.config.descricao as string) || "Atividade criada automaticamente",
              eventType: event.type,
              registroId: event.registroId,
              moduloOrigem: event.moduloOrigem,
            });
            break;
          case "criar_historico":
          case "criar_financeiro":
          case "atualizar_status":
            break;
        }
      }

      this.automations = this.automations.map((item) =>
        item.id === automation.id ? { ...item, executadoCount: item.executadoCount + 1 } : item,
      );
    }
  }

  private pushNotification(notification: Omit<Notification, "id" | "timestamp" | "lida">) {
    const nextNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      lida: false,
    };

    this.notifications = [nextNotification, ...this.notifications];
  }

  addNotification(notification: Omit<Notification, "id" | "timestamp" | "lida">) {
    this.pushNotification(notification);
    this.notifyListeners();
  }

  markNotificationRead(id: string) {
    let changed = false;

    this.notifications = this.notifications.map((notification) => {
      if (notification.id !== id || notification.lida) return notification;
      changed = true;
      return { ...notification, lida: true };
    });

    if (changed) this.notifyListeners();
  }

  markAllRead() {
    const hasUnread = this.notifications.some((notification) => !notification.lida);
    if (!hasUnread) return;

    this.notifications = this.notifications.map((notification) => ({ ...notification, lida: true }));
    this.notifyListeners();
  }

  getNotifications() {
    return this.notifications;
  }

  getUnreadCount() {
    return this.notifications.filter((notification) => !notification.lida).length;
  }

  getHistory() {
    return this.history;
  }

  getAutomations() {
    return this.automations;
  }

  toggleAutomation(id: string) {
    let changed = false;

    this.automations = this.automations.map((automation) => {
      if (automation.id !== id) return automation;
      changed = true;
      return { ...automation, ativo: !automation.ativo };
    });

    if (changed) this.notifyListeners();
  }

  addAutomation(automation: Omit<Automation, "id" | "criadoEm" | "executadoCount">) {
    this.automations = [
      ...this.automations,
      {
        ...automation,
        id: crypto.randomUUID(),
        criadoEm: new Date(),
        executadoCount: 0,
      },
    ];

    this.notifyListeners();
  }

  subscribe(listener: StoreListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
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
