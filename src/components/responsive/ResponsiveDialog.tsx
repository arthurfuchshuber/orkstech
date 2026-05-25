import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  preventOutsideClose?: boolean;
}

const sizeMap = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

/**
 * Modal responsivo: Dialog em desktop, Drawer (bottom sheet) em mobile.
 * Use no lugar de Dialog para qualquer modal/formulário do app.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = "lg",
  preventOutsideClose = false,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={(o) => {
          if (!o && preventOutsideClose) return;
          onOpenChange(o);
        }}
      >
        <DrawerContent className="max-h-[92dvh] bg-card border-border/50 px-0">
          <DrawerHeader className="px-5 pt-3 pb-3 text-left border-b border-border/30">
            <DrawerTitle className="text-base font-semibold">{title}</DrawerTitle>
            {description && (
              <DrawerDescription className="text-xs text-muted-foreground">
                {description}
              </DrawerDescription>
            )}
          </DrawerHeader>
          <ScrollArea className="max-h-[calc(92dvh-80px)]">
            <div className="px-5 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
              {children}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => preventOutsideClose && e.preventDefault()}
        onInteractOutside={(e) => preventOutsideClose && e.preventDefault()}
        className={cn(
          sizeMap[size],
          "p-0 gap-0 border-border/50 bg-card shadow-2xl rounded-xl overflow-hidden"
        )}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/30">
          <DialogTitle className="text-lg font-semibold tracking-tight">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <div className="px-6 py-5">{children}</div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
