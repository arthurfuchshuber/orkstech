import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface ModuleTab {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

interface ModuleTabsProps {
  tabs: ModuleTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function ModuleTabs({ tabs, activeTab, onTabChange }: ModuleTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-border/30 px-1">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "relative flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <span className={cn(
                "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                isActive ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground"
              )}>
                {tab.count}
              </span>
            )}
            {isActive && (
              <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}
