---
name: Reorder Pattern
description: Drag-and-drop com GripVertical é o padrão único de reordenação no SaaS — substitui setas up/down em qualquer lista
type: design
---

Padrão único e obrigatório para qualquer reordenação de itens no SaaS NexusOS:

- Biblioteca: `@hello-pangea/dnd` (`DragDropContext`, `Droppable`, `Draggable`).
- Handle: ícone `GripVertical` (lucide-react), tamanho `w-3.5 h-3.5`, cor `text-muted-foreground/40`.
- Cursor: `cursor-grab active:cursor-grabbing` no handle.
- Feedback de arrasto: aplicar `bg-muted/40` quando `snapshot.isDragging`.
- Persistência: ao soltar, atualizar campo `ordem` no banco via mutation (trocar/recalcular ordens dos itens afetados).

**Proibido:** botões com setas ↑/↓ (ArrowUp/ArrowDown) para reordenar. Caso encontre, substituir pelo padrão acima.

Exemplos de referência: `PlanoDeContasSection.tsx`, `DRERegrasSection.tsx`.
