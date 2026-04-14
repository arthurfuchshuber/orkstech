import { useState } from "react";
import { useMenus, type MenuItem } from "@/hooks/useMenus";
import { DynamicIcon } from "@/components/DynamicIcon";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  ChevronDown,
  Menu,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

export default function GerenciarMenu() {
  const { tree, flatMenus, isLoading, reorder } = useMenus();
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    // Start with all groups open
    const map: Record<string, boolean> = {};
    flatMenus.forEach((m) => {
      if (flatMenus.some((c) => c.parent_id === m.id)) {
        map[m.id] = true;
      }
    });
    return map;
  });

  const toggle = (id: string) => setOpenMap((p) => ({ ...p, [id]: !p[id] }));

  const moveItem = (parentId: string | null, currentIndex: number, direction: "up" | "down") => {
    const siblings = flatMenus
      .filter((m) => m.parent_id === parentId)
      .sort((a, b) => a.order_index - b.order_index);

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= siblings.length) return;

    // Swap
    const temp = siblings[currentIndex];
    siblings[currentIndex] = siblings[newIndex];
    siblings[newIndex] = temp;

    const updates = siblings.map((s, i) => ({ id: s.id, order_index: i, parent_id: parentId }));
    reorder.mutate(updates);
  };

  const renderItems = (items: MenuItem[], parentId: string | null, depth = 0) => (
    <div className={depth > 0 ? "ml-6 pl-3 border-l-2 border-border/30 space-y-1 mt-1" : "space-y-1"}>
      {items.map((item, index) => {
        const hasChildren = !!item.children?.length;
        const isOpen = openMap[item.id] ?? true;
        const isFirst = index === 0;
        const isLast = index === items.length - 1;

        return (
          <div key={item.id}>
            <div
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors
                border-border/40 bg-card hover:bg-muted/30
                ${!item.is_active ? "opacity-50" : ""}`}
            >
              {/* Move buttons */}
              <div className="flex flex-col gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 rounded"
                  disabled={isFirst || reorder.isPending}
                  onClick={() => moveItem(parentId, index, "up")}
                >
                  <ArrowUp className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 rounded"
                  disabled={isLast || reorder.isPending}
                  onClick={() => moveItem(parentId, index, "down")}
                >
                  <ArrowDown className="w-3 h-3" />
                </Button>
              </div>

              <DynamicIcon name={item.icon} className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="flex-1 text-sm font-medium text-foreground">{item.name}</span>

              {item.route && (
                <span className="text-[10px] text-muted-foreground/50 font-mono hidden md:inline">
                  {item.route}
                </span>
              )}

              {hasChildren && (
                <button
                  onClick={() => toggle(item.id)}
                  className="p-1.5 rounded-md hover:bg-muted/50 transition-colors"
                >
                  {isOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
              )}
            </div>

            {isOpen && hasChildren && renderItems(item.children!, item.id, depth + 1)}
          </div>
        );
      })}
    </div>
  );

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Menu className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Gerenciar Menu</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Use as setas para reordenar os itens de navegação do sistema
          </p>
        </div>
      </div>

      <Card className="p-4">
        {tree.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhum menu encontrado
          </div>
        ) : (
          renderItems(tree, null)
        )}
      </Card>
    </div>
  );
}
