import { useState } from "react";
import { DragDropContext } from "@hello-pangea/dnd";
import { useMenus, type MenuItem } from "@/hooks/useMenus";
import { DynamicIcon } from "@/components/DynamicIcon";
import { Card } from "@/components/ui/card";
import { ChevronRight, ChevronDown, GripVertical, Menu } from "lucide-react";
import { Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

export default function GerenciarMenu() {
  const { tree, flatMenus, isLoading, reorder } = useMenus();
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setOpenMap((p) => ({ ...p, [id]: !p[id] }));

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;
    const parentId = result.source.droppableId === "root" ? null : result.source.droppableId;
    const siblings = flatMenus
      .filter((m) => m.parent_id === parentId)
      .sort((a, b) => a.order_index - b.order_index);
    const moved = siblings.splice(result.source.index, 1)[0];
    siblings.splice(result.destination.index, 0, moved);
    const updates = siblings.map((s, i) => ({ id: s.id, order_index: i, parent_id: parentId }));
    reorder.mutate(updates);
  };

  const renderDroppable = (items: MenuItem[], droppableId: string) => (
    <Droppable droppableId={droppableId}>
      {(provided) => (
        <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
          {items.map((item, index) => {
            const hasChildren = !!item.children?.length;
            const isOpen = openMap[item.id] ?? false;

            return (
              <Draggable key={item.id} draggableId={item.id} index={index}>
                {(prov, snapshot) => (
                  <div ref={prov.innerRef} {...prov.draggableProps}>
                    <div
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                        snapshot.isDragging
                          ? "border-primary/30 bg-primary/[0.05] shadow-lg"
                          : "border-border/40 bg-card hover:bg-muted/30"
                      } ${!item.is_active ? "opacity-50" : ""}`}
                    >
                      <div {...prov.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                        <GripVertical className="w-4 h-4 text-muted-foreground/40" />
                      </div>
                      <DynamicIcon name={item.icon} className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 text-sm font-medium text-foreground">{item.name}</span>

                      {hasChildren && (
                        <button
                          onClick={() => toggle(item.id)}
                          className="p-1 rounded hover:bg-muted/50"
                        >
                          {isOpen ? (
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </button>
                      )}
                    </div>

                    {isOpen && hasChildren && (
                      <div className="ml-6 mt-1 pl-3 border-l-2 border-border/30 space-y-1">
                        {renderDroppable(item.children!, item.id)}
                      </div>
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
    <div className="space-y-6 max-w-4xl animate-fade-in">
      <div className="flex items-center gap-3">
        <Menu className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Gerenciar Menu</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Arraste para reordenar os itens de navegação do sistema
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
