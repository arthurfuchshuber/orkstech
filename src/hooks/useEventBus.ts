import { useCallback, useRef, useSyncExternalStore } from "react";
import { eventBus } from "@/lib/events";
import type { Notification, Automation, HistoryEntry } from "@/lib/events";

function useStableSnapshot<T>(getter: () => T[]): T[] {
  const ref = useRef<T[]>(getter());
  const prevLen = useRef(0);

  const subscribe = useCallback((cb: () => void) => eventBus.subscribe(cb), []);
  const getSnapshot = useCallback(() => {
    const next = getter();
    if (next.length !== prevLen.current || next !== ref.current) {
      ref.current = next;
      prevLen.current = next.length;
    }
    return ref.current;
  }, [getter]);

  return useSyncExternalStore(subscribe, getSnapshot);
}

export function useNotifications() {
  const getter = useCallback(() => eventBus.getNotifications(), []);
  const notifications = useStableSnapshot<Notification>(getter);
  const unreadCount = notifications.filter(n => !n.lida).length;

  return {
    notifications,
    unreadCount,
    markRead: (id: string) => eventBus.markNotificationRead(id),
    markAllRead: () => eventBus.markAllRead(),
  };
}

export function useAutomations() {
  const getter = useCallback(() => eventBus.getAutomations(), []);
  const automations = useStableSnapshot<Automation>(getter);

  return {
    automations,
    toggle: (id: string) => eventBus.toggleAutomation(id),
    add: (a: Parameters<typeof eventBus.addAutomation>[0]) => eventBus.addAutomation(a),
  };
}

export function useHistory() {
  const getter = useCallback(() => eventBus.getHistory(), []);
  return useStableSnapshot<HistoryEntry>(getter);
}
