import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useMenus, type MenuItem } from "@/hooks/useMenus";
import { DynamicIcon } from "@/components/DynamicIcon";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  ChevronDown,
  GripVertical,
  Menu,
  FolderInput,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function GerenciarMenu() {
  const { tree, flatMenus, isLoading, reorder } = useMenus();
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (flatMenus.length > 0) {
      const map: Record<string, boolean> = {};
      flatMenus.forEach((m) => {
        if (flatMenus.some((c) => c.parent_id === m.id)) {
          map[m.id] = true;
        }
      });
      setOpenMap((prev) => ({ ...map, ...prev }));
    }
  }, [flatMenus]);

  const toggle = (id: string) => setOpenMap((p) => ({ ...p, [id]: !p[id] }));

  // Get all possible parent targets (root + groups)
  const getParentOptions = (itemId: string) => {
    // Groups = items that have children OR items at root level (which could become groups)
    // Exclude the item itself and its descendants
    const descendants = new Set<string>();
    const collectDescendants = (parentId: string) => {
      flatMenus
        .filter((m) => m.parent_id === parentId)
        .forEach((m) => {
          descendants.add(m.id);
          collectDescendants(m.id);
        });
    };
    descendants.add(itemId);
    collectDescendants(itemId);

    // Root-level items that can be parents (groups)
    const rootItems = flatMenus.filter(
      (m) => m.parent_id === null && !descendants.has(m.id)
    );

    // Also include items that already have children (nested groups)
    const groups = flatMenus.filter(
      (m) =>
        !descendants.has(m.id) &&
        m.parent_id !== null &&
        flatMenus.some((c) => c.parent_id === m.id)
    );

    return { rootItems, groups };
  };

  const moveToParent = (itemId: string, currentParentId: string | null, newParentId: string | null) => {
    if (currentParentId === newParentId) return;

    const updates: { id: string; order_index: number; parent_id: string | null }[] = [];

    // Remove from current siblings and reindex
    const currentSiblings = flatMenus
      .filter((m) => m.parent_id === currentParentId && m.id !== itemId)
      .sort((a, b) => a.order_index - b.order_index);
    currentSiblings.forEach((s, i) => {
      updates.push({ id: s.id, order_index: i, parent_id: currentParentId });
    });

    // Add to new parent at the end
    const newSiblings = flatMenus
      .filter((m) => m.parent_id === newParentId && m.id !== itemId)
      .sort((a, b) => a.order_index - b.order_index);
    updates.push({ id: itemId, order_index: newSiblings.length, parent_id: newParentId });

    // Open new parent
    if (newParentId) {
      setOpenMap((p) => ({ ...p, [newParentId]: true }));
    }

    reorder.mutate(updates);
  };

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const parentId = source.droppableId === "root" ? null : source.droppableId;
    // Only allow reorder within same list
    if (source.droppableId !== destination.droppableId) return;

    const siblings = flatMenus
      .filter((m) => m.parent_id === parentId)
      .sort((a, b) => a.order_index - b.order_index);
    const moved = siblings.splice(source.index, 1)[0];
    siblings.splice(destination.index, 0, moved);

    const updates = siblings.map((s, i) => ({ id: s.id, order_index: i, parent_id: parentId }));
    reorder.mutate(updates);
  };

  const renderDroppable = (items: MenuItem[], droppableId: string, depth = 0) => (
    <Droppable droppableId={droppableId}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`space-y-1 min-h-[4px] rounded-md transition-colors ${
            snapshot.isDraggingOver ? "bg-primary/5" : ""
          } ${depth > 0 ? "ml-6 mt-1 pl-3 border-l-2 border-border/30" : ""}`}
        >
          {items.map((item, index) => {
            const hasChildren = !!item.children?.length;
            const isOpen = openMap[item.id] ?? true;
            const { rootItems, groups } = getParentOptions(item.id);

            return (
              <Draggable key={item.id} draggableId={item.id} index={index}>
                {(prov, dragSnap) => (
                  <div ref={prov.innerRef} {...prov.draggableProps}>
                    <div
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
                        dragSnap.isDragging
                          ? "border-primary/40 bg-primary/[0.08] shadow-lg ring-1 ring-primary/20"
                          : "border-border/40 bg-card hover:bg-muted/30"
                      } ${!item.is_active ? "opacity-50" : ""}`}
                    >
                      <div
                        {...prov.dragHandleProps}
                        className="cursor-grab active:cursor-grabbing p-1 -m-1 rounded hover:bg-muted/50 transition-colors"
                      >
                        <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                      </div>
                      <DynamicIcon name={item.icon} className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 text-sm font-medium text-foreground">{item.name}</span>

                      {/* Move to group dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-md opacity-50 hover:opacity-100"
                            title="Mover para outro grupo"
                          >
                            <FolderInput className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem
                            disabled={item.parent_id === null}
                            onClick={() => moveToParent(item.id, item.parent_id, null)}
                          >
                            <span className="text-xs">📂 Raiz (nível principal)</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {rootItems
                            .filter((r) => r.id !== item.id)
                            .map((r) => (
                              <DropdownMenuItem
                                key={r.id}
                                disabled={item.parent_id === r.id}
                                onClick={() => moveToParent(item.id, item.parent_id, r.id)}
                              >
                                <DynamicIcon name={r.icon} className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                                <span className="text-xs">{r.name}</span>
                                {item.parent_id === r.id && (
                                  <span className="ml-auto text-[10px] text-muted-foreground">(atual)</span>
                                )}
                              </DropdownMenuItem>
                            ))}
                          {groups.length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              {groups.map((g) => (
                                <DropdownMenuItem
                                  key={g.id}
                                  disabled={item.parent_id === g.id}
                                  onClick={() => moveToParent(item.id, item.parent_id, g.id)}
                                >
                                  <span className="text-xs ml-3">↳ {g.name}</span>
                                  {item.parent_id === g.id && (
                                    <span className="ml-auto text-[10px] text-muted-foreground">(atual)</span>
                                  )}
                                </DropdownMenuItem>
                              ))}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>

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

                    {isOpen && hasChildren && renderDroppable(item.children!, item.id, depth + 1)}
                  </div>
                )}
              </Draggable>
            );
          })}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
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
            Arraste para reordenar · Clique no ícone 📁 para mover entre grupos
          </p>
        </div>
      </div>

      <Card className="p-4">
        {tree.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhum menu encontrado
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            {renderDroppable(tree, "root")}
          </DragDropContext>
        )}
      </Card>
    </div>
  );
}
