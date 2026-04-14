import { useEffect, useState } from "react";
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
      flatMenus.forEach((menu) => {
        if (flatMenus.some((child) => child.parent_id === menu.id)) {
          map[menu.id] = true;
        }
      });
      setOpenMap((prev) => ({ ...map, ...prev }));
    }
  }, [flatMenus]);

  const toggle = (id: string) => setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }));

  const getDescendantIds = (itemId: string) => {
    const descendants = new Set<string>();

    const collect = (parentId: string) => {
      flatMenus
        .filter((menu) => menu.parent_id === parentId)
        .forEach((menu) => {
          descendants.add(menu.id);
          collect(menu.id);
        });
    };

    collect(itemId);
    return descendants;
  };

  const canMoveToParent = (itemId: string, targetParentId: string | null) => {
    if (targetParentId === null) return true;
    if (itemId === targetParentId) return false;
    return !getDescendantIds(itemId).has(targetParentId);
  };

  const getParentOptions = (itemId: string) => {
    const blockedIds = getDescendantIds(itemId);
    blockedIds.add(itemId);

    const rootItems = flatMenus.filter(
      (menu) => menu.parent_id === null && !blockedIds.has(menu.id)
    );

    const groups = flatMenus.filter(
      (menu) =>
        !blockedIds.has(menu.id) &&
        menu.parent_id !== null &&
        flatMenus.some((child) => child.parent_id === menu.id)
    );

    return { rootItems, groups };
  };

  const moveToParent = (
    itemId: string,
    currentParentId: string | null,
    newParentId: string | null
  ) => {
    if (currentParentId === newParentId || !canMoveToParent(itemId, newParentId)) return;

    const currentSiblings = flatMenus
      .filter((menu) => menu.parent_id === currentParentId && menu.id !== itemId)
      .sort((a, b) => a.order_index - b.order_index);

    const newSiblings = flatMenus
      .filter((menu) => menu.parent_id === newParentId && menu.id !== itemId)
      .sort((a, b) => a.order_index - b.order_index);

    const updates = [
      ...currentSiblings.map((menu, index) => ({
        id: menu.id,
        order_index: index,
        parent_id: currentParentId,
      })),
      {
        id: itemId,
        order_index: newSiblings.length,
        parent_id: newParentId,
      },
    ];

    if (newParentId) {
      setOpenMap((prev) => ({ ...prev, [newParentId]: true }));
    }

    reorder.mutate(updates);
  };

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceParentId = source.droppableId === "root" ? null : source.droppableId;
    const destinationParentId = destination.droppableId === "root" ? null : destination.droppableId;

    if (!canMoveToParent(draggableId, destinationParentId)) return;

    const sourceSiblings = flatMenus
      .filter((menu) => menu.parent_id === sourceParentId)
      .sort((a, b) => a.order_index - b.order_index);

    const movedItem = sourceSiblings[source.index];
    if (!movedItem) return;

    if (sourceParentId === destinationParentId) {
      const reordered = [...sourceSiblings];
      reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, movedItem);

      reorder.mutate(
        reordered.map((menu, index) => ({
          id: menu.id,
          order_index: index,
          parent_id: sourceParentId,
        }))
      );
      return;
    }

    const nextSourceSiblings = sourceSiblings.filter((menu) => menu.id !== movedItem.id);
    const destinationSiblings = flatMenus
      .filter((menu) => menu.parent_id === destinationParentId && menu.id !== movedItem.id)
      .sort((a, b) => a.order_index - b.order_index);

    const nextDestinationSiblings = [...destinationSiblings];
    const insertIndex = Math.min(destination.index, nextDestinationSiblings.length);
    nextDestinationSiblings.splice(insertIndex, 0, movedItem);

    const updates = [
      ...nextSourceSiblings.map((menu, index) => ({
        id: menu.id,
        order_index: index,
        parent_id: sourceParentId,
      })),
      ...nextDestinationSiblings.map((menu, index) => ({
        id: menu.id,
        order_index: index,
        parent_id: destinationParentId,
      })),
    ];

    if (destinationParentId) {
      setOpenMap((prev) => ({ ...prev, [destinationParentId]: true }));
    }

    reorder.mutate(updates);
  };

  const renderDroppable = (
    items: MenuItem[],
    droppableId: string,
    depth = 0,
    emptyHint = false
  ) => (
    <Droppable droppableId={droppableId}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`rounded-md transition-colors ${
            snapshot.isDraggingOver ? "bg-primary/5" : ""
          } ${depth > 0 ? "ml-6 mt-1 pl-3 border-l-2 border-border/30" : "space-y-1"} ${
            items.length === 0 ? "min-h-[18px]" : "space-y-1 min-h-[4px]"
          }`}
        >
          {items.map((item, index) => {
            const hasChildren = !!item.children?.length;
            const isOpen = openMap[item.id] ?? true;
            const { rootItems, groups } = getParentOptions(item.id);
            const showChildList = !hasChildren || isOpen;

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
                            .filter((rootItem) => rootItem.id !== item.id)
                            .map((rootItem) => (
                              <DropdownMenuItem
                                key={rootItem.id}
                                disabled={item.parent_id === rootItem.id}
                                onClick={() => moveToParent(item.id, item.parent_id, rootItem.id)}
                              >
                                <DynamicIcon
                                  name={rootItem.icon}
                                  className="w-3.5 h-3.5 mr-2 text-muted-foreground"
                                />
                                <span className="text-xs">{rootItem.name}</span>
                                {item.parent_id === rootItem.id && (
                                  <span className="ml-auto text-[10px] text-muted-foreground">
                                    (atual)
                                  </span>
                                )}
                              </DropdownMenuItem>
                            ))}
                          {groups.length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              {groups.map((group) => (
                                <DropdownMenuItem
                                  key={group.id}
                                  disabled={item.parent_id === group.id}
                                  onClick={() => moveToParent(item.id, item.parent_id, group.id)}
                                >
                                  <span className="text-xs ml-3">↳ {group.name}</span>
                                  {item.parent_id === group.id && (
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

                    {showChildList && renderDroppable(item.children ?? [], item.id, depth + 1, true)}
                  </div>
                )}
              </Draggable>
            );
          })}

          {provided.placeholder}

          {emptyHint && items.length === 0 && snapshot.isDraggingOver && (
            <div className="px-3 py-2 text-xs text-muted-foreground rounded-md border border-dashed border-primary/40 bg-primary/5">
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
          <DragDropContext onDragEnd={handleDragEnd}>
            {renderDroppable(tree, "root")}
          </DragDropContext>
        )}
      </Card>
    </div>
  );
}
