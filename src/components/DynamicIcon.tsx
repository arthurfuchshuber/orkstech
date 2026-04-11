import { icons, type LucideIcon } from "lucide-react";

interface DynamicIconProps {
  name: string;
  className?: string;
}

export function DynamicIcon({ name, className }: DynamicIconProps) {
  const Icon = (icons as Record<string, LucideIcon>)[name] ?? icons.Circle;
  return <Icon className={className} />;
}
