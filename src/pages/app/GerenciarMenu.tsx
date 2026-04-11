import { useState } from "react";
import { useMenus, type MenuItem } from "@/hooks/useMenus";
import { DynamicIcon } from "@/components/DynamicIcon";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChevronRight, ChevronDown, Pencil, GripVertical, Menu, Eye, EyeOff,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

const ICON_OPTIONS = [
  "LayoutDashboard", "DollarSign", "Receipt", "TrendingUp", "PiggyBank", "FileText",
  "Settings", "FolderTree", "Target", "Landmark", "CreditCard", "Users", "Truck",
  "Package", "Zap", "Workflow", "Webhook", "Bell", "Building2", "UserCog", "Shield",
  "Menu", "Circle", "Star", "Heart", "Home", "Mail", "Phone", "Search",
];

interface EditFormData {
  name: string;
  icon: string;
  route: string;
  is_visible: boolean;
  is_active: boolean;
}

export default function GerenciarMenu() {
  const { tree, flatMenus, isLoading, updateMenu, reorder } = useMenus();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EditFormData>({ name: "", icon: "Circle", route: "", is_visible: true, is_active: true });
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setOpenMap((p) => ({ ...p, [id]: !p[id] }));

  const openEdit = (item: MenuItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      icon: item.icon,
      route: item.route || "",
      is_visible: item.is_visible,
      is_active: item.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) {
      toast.error("Nome é obrigatório");
      return;
    }
    try {
      if (editingId) {
        const existing = flatMenus.find((m) => m.id === editingId);
        await updateMenu.mutateAsync({
          id: editingId,
          name: form.name,
          icon: form.icon,
          route: form.route || null,
          is_visible: form.is_visible,
          is_active: form.is_active,
          // preserve existing fields
          slug: existing?.slug,
          module: existing?.module,
          parent_id: existing?.parent_id,
        } as any);
        toast.success("Menu atualizado");
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

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

  const renderDroppable = (items: MenuItem[], droppableId: string, depth = 0) => (
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

                      {item.route && (
                        <span className="text-[10px] text-muted-foreground/60 font-mono max-w-[120px] truncate">
                          {item.route}
                        </span>
                      )}

                      <Badge
                        variant={item.is_active ? "default" : "secondary"}
                        className="text-[10px] h-5"
                      >
                        {item.is_active ? "Ativo" : "Inativo"}
                      </Badge>

                      {!item.is_visible && (
                        <Badge variant="outline" className="text-[10px] h-5 gap-1">
                          <EyeOff className="w-2.5 h-2.5" /> Oculto
                        </Badge>
                      )}

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

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {isOpen && hasChildren && (
                      <div className="ml-6 mt-1 pl-3 border-l-2 border-border/30 space-y-1">
                        {renderDroppable(item.children!, item.id, depth + 1)}
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Menu className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Gerenciar Menu</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Reordene e configure os itens de navegação do sistema
            </p>
          </div>
        </div>
      </div>

      <Card className="p-4">
        {tree.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhum menu encontrado
          </div>
        ) : (
          renderMenuTree(tree, "root")
        )}
      </Card>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Menu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nome</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Rota</label>
              <Input
                value={form.route}
                onChange={(e) => setForm({ ...form, route: e.target.value })}
                placeholder="/app/modulo/pagina"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Ícone</label>
              <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((ic) => (
                    <SelectItem key={ic} value={ic}>
                      <div className="flex items-center gap-2">
                        <DynamicIcon name={ic} className="w-4 h-4" />
                        <span>{ic}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <label className="text-sm text-foreground">Ativo</label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_visible} onCheckedChange={(v) => setForm({ ...form, is_visible: v })} />
                <label className="text-sm text-foreground">Visível</label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
