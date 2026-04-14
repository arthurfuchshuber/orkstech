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
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

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

  const getDescendantIds = (itemId: string) => {
    const descendants = new Set<string>();

    const collectDescendants = (parentId: string) => {
      flatMenus
        .filter((m) => m.parent_id === parentId)
        .forEach((m) => {
          descendants.add(m.id);
          collectDescendants(m.id);
        });
    };

    collectDescendants(itemId);
    return descendants;
  };

  const canMoveIntoParent = (itemId: string, parentId: string | null) => {
    if (parentId === null) return true;
    if (itemId === parentId) return false;
    return !getDescendantIds(itemId).has(parentId);
  };

  const getParentOptions = (itemId: string) => {
    const blockedIds = getDescendantIds(itemId);
    blockedIds.add(itemId);

    const rootItems = flatMenus.filter(
      (m) => m.parent_id === null && !blockedIds.has(m.id)
    );

    const groups = flatMenus.filter(
      (m) =>
        !blockedIds.has(m.id) &&
        m.parent_id !== null &&
        flatMenus.some((c) => c.parent_id === m.id)
    );

    return { rootItems, groups };
  };

  const moveToParent = (
    itemId: string,
    currentParentId: string | null,
    newParentId: string | null
  ) => {
    if (currentParentId === newParentId || !canMoveIntoParent(itemId, newParentId)) return;

    const updates: { id: string; order_index: number; parent_id: string | null }[] = [];

    const currentSiblings = flatMenus
      .filter((m) => m.parent_id === currentParentId && m.id !== itemId)
      .sort((a, b) => a.order_index - b.order_index);

    currentSiblings.forEach((s, i) => {
      updates.push({ id: s.id, order_index: i, parent_id: currentParentId });
    });

    const newSiblings = flatMenus
      .filter((m) => m.parent_id === newParentId && m.id !== itemId)
      .sort((a, b) => a.order_index - b.order_index);

    updates.push({ id: itemId, order_index: newSiblings.length, parent_id: newParentId });

    if (newParentId) {
      setOpenMap((p) => ({ ...p, [newParentId]: true }));
    }

    reorder.mutate(updates);
  };

  const handleDragEnd = (result: DropResult) => {
    setActiveDragId(null);

    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceParentId = source.droppableId === "root" ? null : source.droppableId;
    const destParentId = destination.droppableId === "root" ? null : destination.droppableId;

    if (!canMoveIntoParent(draggableId, destParentId)) return;

    const sourceSiblings = flatMenus
      .filter((m) => m.parent_id === sourceParentId)
      .sort((a, b) => a.order_index - b.order_index);

    const moved = sourceSiblings[source.index];
    if (!moved) return;

    if (sourceParentId === destParentId) {
      const reordered = [...sourceSiblings];
      reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, moved);

      reorder.mutate(
        reordered.map((item, index) => ({
          id: item.id,
          order_index: index,
          parent_id: sourceParentId,
        }))
      );
      return;
    }

    const nextSourceSiblings = sourceSiblings.filter((item) => item.id !== moved.id);
    const destSiblings = flatMenus
      .filter((m) => m.parent_id === destParentId && m.id !== moved.id)
      .sort((a, b) => a.order_index - b.order_index);

    const nextDestSiblings = [...destSiblings];
    const destinationIndex = Math.min(destination.index, nextDestSiblings.length);
    nextDestSiblings.splice(destinationIndex, 0, moved);

    const updates = [
      ...nextSourceSiblings.map((item, index) => ({
        id: item.id,
        order_index: index,
        parent_id: sourceParentId,
      })),
      ...nextDestSiblings.map((item, index) => ({
        id: item.id,
        order_index: index,
        parent_id: destParentId,
      })),
    ];

    if (destParentId) {
      setOpenMap((p) => ({ ...p, [destParentId]: true }));
    }

    reorder.mutate(updates);
  };

  const renderDroppable = (
    items: MenuItem[],
    droppableId: string,
    depth = 0,
    showEmptyDropZone = false
  ) => (
    <Droppable droppableId={droppableId}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`rounded-md transition-colors ${
            snapshot.isDraggingOver ? "bg-primary/5" : ""
          } ${
            depth > 0 ? "ml-6 mt-1 pl-3 border-l-2 border-border/30" : "space-y-1"
          } ${items.length === 0 ? "min-h-[18px]" : "space-y-1 min-h-[4px]"}`}
        >
          {items.map((item, index) => {
            const hasChildren = !!item.children?.length;
            const isOpen = openMap[item.id] ?? true;
            const { rootItems, groups } = getParentOptions(item.id);
            const allowDropIntoItem = !!activeDragId && canMoveIntoParent(activeDragId, item.id);
            const shouldRenderChildDroppable = (hasChildren && isOpen) || allowDropIntoItem;

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
                      <DynamicIcon
                        name={item.icon}
                        className="w-4 h-4 text-muted-foreground flex-shrink-0"
                      />
                      <span className="flex-1 text-sm font-medium text-foreground">{item.name}</span>

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
                                <DynamicIcon
                                  name={r.icon}
                                  className="w-3.5 h-3.5 mr-2 text-muted-foreground"
                                />
                                <span className="text-xs">{r.name}</span>
                                {item.parent_id === r.id && (
                                  <span className="ml-auto text-[10px] text-muted-foreground">
                                    (atual)
                                  </span>
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
                                    <span className="ml-auto text-[10px] text-muted-foreground">
                                      (atual)
                                    </span>
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

                    {shouldRenderChildDroppable &&
                      renderDroppable(item.children ?? [], item.id, depth + 1, allowDropIntoItem)}
                  </div>
                )}
              </Draggable>
            );
          })}

          {provided.placeholder}

          {showEmptyDropZone && items.length === 0 && (
            <div
              className={`px-3 py-2 text-xs text-muted-foreground rounded-md border border-dashed transition-colors ${
                snapshot.isDraggingOver ? "border-primary/50 bg-primary/5" : "border-border/40"
              }`}
            >
              Solte aqui para transformar em submenu
            </div>
          )}
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
          <DragDropContext
            onDragStart={(start) => setActiveDragId(start.draggableId)}
            onDragEnd={handleDragEnd}
          >
            {renderDroppable(tree, "root")}
          </DragDropContext>
        )}
      </Card>
    </div>
  );
}
