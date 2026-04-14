import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useMenus, type MenuItem } from "@/hooks/useMenus";
import { DynamicIcon } from "@/components/DynamicIcon";
import { Card } from "@/components/ui/card";
import { ChevronRight, ChevronDown, GripVertical, Menu } from "lucide-react";

export default function GerenciarMenu() {
  const { tree, flatMenus, isLoading, reorder } = useMenus();
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  // Auto-open all groups on load
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

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceParentId = source.droppableId === "root" ? null : source.droppableId;
    const destParentId = destination.droppableId === "root" ? null : destination.droppableId;

    // Get source siblings and remove the dragged item
    const sourceSiblings = flatMenus
      .filter((m) => m.parent_id === sourceParentId)
      .sort((a, b) => a.order_index - b.order_index);
    const [moved] = sourceSiblings.splice(source.index, 1);

    const updates: { id: string; order_index: number; parent_id: string | null }[] = [];

    if (sourceParentId === destParentId) {
      // Same list — just reorder
      sourceSiblings.splice(destination.index, 0, moved);
      sourceSiblings.forEach((s, i) => {
        updates.push({ id: s.id, order_index: i, parent_id: sourceParentId });
      });
    } else {
      // Moving between lists
      // Reindex source
      sourceSiblings.forEach((s, i) => {
        updates.push({ id: s.id, order_index: i, parent_id: sourceParentId });
      });
      // Insert into destination
      const destSiblings = flatMenus
        .filter((m) => m.parent_id === destParentId && m.id !== moved.id)
        .sort((a, b) => a.order_index - b.order_index);
      destSiblings.splice(destination.index, 0, moved);
      destSiblings.forEach((s, i) => {
        updates.push({ id: s.id, order_index: i, parent_id: destParentId });
      });

      // Open destination parent so the moved item is visible
      if (destParentId) {
        setOpenMap((p) => ({ ...p, [destParentId]: true }));
      }
    }

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

                    {/* Always render droppable zone for this item so items can be dropped into it */}
                    {isOpen && hasChildren && renderDroppable(item.children!, item.id, depth + 1)}
                    {/* If no children but open, still allow dropping into it as a group */}
                    {isOpen && !hasChildren && (
                      <Droppable droppableId={item.id}>
                        {(emptyProv, emptySnap) => (
                          <div
                            ref={emptyProv.innerRef}
                            {...emptyProv.droppableProps}
                            className={`ml-6 mt-1 pl-3 border-l-2 border-dashed min-h-[2px] rounded transition-colors ${
                              emptySnap.isDraggingOver
                                ? "border-primary/40 bg-primary/5 min-h-[32px]"
                                : "border-transparent"
                            }`}
                          >
                            {emptyProv.placeholder}
                          </div>
                        )}
                      </Droppable>
                    )}
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
            Arraste para reordenar ou mover itens entre grupos
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
