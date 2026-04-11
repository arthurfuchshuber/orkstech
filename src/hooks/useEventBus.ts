import { useSyncExternalStore, useCallback } from "react";
import { eventBus } from "@/lib/events";

export function useNotifications() {
  const subscribe = useCallback((cb: () => void) => eventBus.subscribe(cb), []);
  const getSnapshot = useCallback(() => eventBus.getNotifications(), []);
  const notifications = useSyncExternalStore(subscribe, getSnapshot);
  const unreadCount = notifications.filter(n => !n.lida).length;

  return {
    notifications,
    unreadCount,
    markRead: (id: string) => eventBus.markNotificationRead(id),
    markAllRead: () => eventBus.markAllRead(),
  };
}

export function useAutomations() {
  const subscribe = useCallback((cb: () => void) => eventBus.subscribe(cb), []);
  const getSnapshot = useCallback(() => eventBus.getAutomations(), []);
  const automations = useSyncExternalStore(subscribe, getSnapshot);

  return {
    automations,
    toggle: (id: string) => eventBus.toggleAutomation(id),
    add: (a: Parameters<typeof eventBus.addAutomation>[0]) => eventBus.addAutomation(a),
  };
}

export function useHistory() {
  const subscribe = useCallback((cb: () => void) => eventBus.subscribe(cb), []);
  const getSnapshot = useCallback(() => eventBus.getHistory(), []);
  return useSyncExternalStore(subscribe, getSnapshot);
}
