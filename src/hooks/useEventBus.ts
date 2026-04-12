import { useSyncExternalStore } from "react";
import { eventBus } from "@/lib/events";

export function useNotifications() {
  const notifications = useSyncExternalStore(
    (listener) => eventBus.subscribe(listener),
    () => eventBus.getNotifications(),
  );

  return {
    notifications,
    unreadCount: notifications.filter((notification) => !notification.lida).length,
    markRead: (id: string) => eventBus.markNotificationRead(id),
    markAllRead: () => eventBus.markAllRead(),
  };
}

export function useAutomations() {
  const automations = useSyncExternalStore(
    (listener) => eventBus.subscribe(listener),
    () => eventBus.getAutomations(),
  );

  return {
    automations,
    toggle: (id: string) => eventBus.toggleAutomation(id),
    add: (automation: Parameters<typeof eventBus.addAutomation>[0]) => eventBus.addAutomation(automation),
    remove: (id: string) => eventBus.removeAutomation(id),
  };
}

export function useHistory() {
  return useSyncExternalStore(
    (listener) => eventBus.subscribe(listener),
    () => eventBus.getHistory(),
  );
}
