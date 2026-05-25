import * as React from "react";
import { ResponsiveDialog } from "@/components/responsive/ResponsiveDialog";

interface FormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  preventOutsideClose?: boolean;
}

/**
 * Modal padrão para formulários.
 * Em desktop renderiza Dialog centralizado; em mobile vira Drawer (bottom sheet)
 * full-height com handle no topo — automaticamente via ResponsiveDialog.
 */
export function FormModal(props: FormModalProps) {
  return <ResponsiveDialog {...props} />;
}
