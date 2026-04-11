import { useState } from "react";
import { useMenus, type MenuItem } from "@/hooks/useMenus";
import { useAuth } from "@/hooks/useAuth";
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
  ChevronRight, ChevronDown, Plus, Pencil, Trash2, GripVertical, Menu,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

const ICON_OPTIONS = [
  "LayoutDashboard", "DollarSign", "Receipt", "TrendingUp", "PiggyBank", "FileText",
  "Settings", "FolderTree", "Target", "Landmark", "CreditCard", "Users", "Truck",
  "Package", "Zap", "Workflow", "Webhook", "Bell", "Building2", "UserCog", "Shield",
  "Menu", "Circle", "Star", "Heart", "Home", "Mail", "Phone", "Search",
];

const MODULE_OPTIONS = ["financeiro", "cadastros", "automacoes", "sistema"];

interface FormData {
  name: string;
  slug: string;
  icon: string;
  route: string;
  module: string;
  parent_id: string | null;
  is_visible: boolean;
  is_active: boolean;
}

const emptyForm: FormData = {
  name: "", slug: "", icon: "Circle", route: "", module: "sistema",
  parent_id: null, is_visible: true, is_active: true,
};

function flattenForParentSelect(items: MenuItem[], depth = 0): { id: string; name: string; depth: number }[] {
  const result: { id: string; name: string; depth: number }[] = [];
  for (const item of items) {
    result.push({ id: item.id, name: item.name, depth });
    if (item.children?.length) {
      result.push(...flattenForParentSelect(item.children, depth + 1));
    }
  }
  return result;
}

export default function GerenciarMenu() {
  const { user } = useAuth();
  const { tree, flatMenus, isLoading, createMenu, updateMenu, deleteMenu, reorder } = useMenus();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setOpenMap((p) => ({ ...p, [id]: !p[id] }));

  const openCreate = (parentId: string | null = null) => {
    setEditingId(null);
    setForm({ ...emptyForm, parent_id: parentId });
    setDialogOpen(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      slug: item.slug,
      icon: item.icon,
      route: item.route || "",
      module: item.module,
      parent_id: item.parent_id,
      is_visible: item.is_visible,
      is_active: item.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.slug) {
      toast.error("Nome e slug são obrigatórios");
      return;
    }
    try {
      if (editingId) {
        await updateMenu.mutateAsync({
          id: editingId,
          name: form.name,
          slug: form.slug,
          icon: form.icon,
          route: form.route || null,
          module: form.module,
          parent_id: form.parent_id,
          is_visible: form.is_visible,
          is_active: form.is_active,
        } as any);
        toast.success("Menu atualizado");
      } else {
        const siblings = flatMenus.filter((m) => m.parent_id === form.parent_id);
        await createMenu.mutateAsync({
          user_id: user!.id,
          name: form.name,
          slug: form.slug,
          icon: form.icon,
          route: form.route || null,
          module: form.module,
          parent_id: form.parent_id,
          order_index: siblings.length,
          is_visible: form.is_visible,
          is_active: form.is_active,
        } as any);
        toast.success("Menu criado");
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este menu e todos seus submenus?")) return;
    try {
      await deleteMenu.mutateAsync(id);
      toast.success("Menu excluído");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const parentId = result.source.droppableId === "root" ? null : result.source.droppableId;
    const siblings = flatMenus
      .filter((m) => m.parent_id === parentId)
      .sort((a, b) => a.order_index - b.order_index);
    const moved = siblings.splice(result.source.index, 1)[0];
    siblings.splice(result.destination.index, 0, moved);
    const updates = siblings.map((s, i) => ({ id: s.id, order_index: i, parent_id: parentId }));
    reorder.mutate(updates);
  };

  const parentOptions = flattenForParentSelect(tree);

  const renderMenuTree = (items: MenuItem[], droppableId: string) => (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId={droppableId}>
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
            {items.map((item, index) => (
              <Draggable key={item.id} draggableId={item.id} index={index}>
                {(prov) => (
                  <div ref={prov.innerRef} {...prov.draggableProps}>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/40 bg-card hover:bg-muted/30 transition-colors">
                      <div {...prov.dragHandleProps} className="cursor-grab">
                        <GripVertical className="w-4 h-4 text-muted-foreground/40" />
                      </div>
                      <DynamicIcon name={item.icon} className="w-4 h-4 text-muted-foreground" />
                      <span className="flex-1 text-sm font-medium">{item.name}</span>
                      <Badge variant={item.is_active ? "default" : "secondary"} className="text-[10px]">
                        {item.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                      {!item.is_visible && (
                        <Badge variant="outline" className="text-[10px]">Oculto</Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">{item.module}</span>
                      {item.children && item.children.length > 0 && (
                        <button onClick={() => toggle(item.id)} className="p-1">
                          {openMap[item.id] ? (
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCreate(item.id)}>
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    {openMap[item.id] && item.children && item.children.length > 0 && (
                      <div className="ml-6 mt-1 pl-3 border-l-2 border-border/30 space-y-1">
                        {renderMenuTree(item.children, item.id)}
                      </div>
                    )}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Menu className="w-5 h-5" /> Gerenciar Menu
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organize a estrutura de navegação do sistema
          </p>
        </div>
        <Button onClick={() => openCreate(null)} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Novo Menu
        </Button>
      </div>

      <Card className="p-4">
        {renderMenuTree(tree, "root")}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Menu" : "Novo Menu"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Slug</label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="identificador-unico"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Rota</label>
              <Input
                value={form.route}
                onChange={(e) => setForm({ ...form, route: e.target.value })}
                placeholder="/app/modulo/pagina"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Ícone</label>
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
            <div>
              <label className="text-sm font-medium">Módulo</label>
              <Select value={form.module} onValueChange={(v) => setForm({ ...form, module: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODULE_OPTIONS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Menu Pai</label>
              <Select
                value={form.parent_id || "none"}
                onValueChange={(v) => setForm({ ...form, parent_id: v === "none" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum (raiz) —</SelectItem>
                  {parentOptions
                    .filter((p) => p.id !== editingId)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {"  ".repeat(p.depth)}{p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <label className="text-sm">Ativo</label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_visible} onCheckedChange={(v) => setForm({ ...form, is_visible: v })} />
                <label className="text-sm">Visível</label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingId ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
