import * as React from "react";
import { cn } from "@/lib/utils";

interface PercentInputProps {
  value: number;
  onValueChange: (value: number) => void;
  label?: string;
  error?: string;
  placeholder?: string;
  min?: number;
  max?: number;
}

export function PercentInput({ value, onValueChange, label = "Porcentagem", error, placeholder = "0", min = 0, max = 100 }: PercentInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    const num = Math.min(Math.max(parseInt(raw || "0", 10), min), max);
    onValueChange(num);
  };

  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={value > 0 ? String(value) : ""}
          onChange={handleChange}
          placeholder={placeholder}
          className={cn(
            "flex h-10 w-full rounded-lg border border-input bg-background px-3 pr-8 py-2 text-sm transition-all duration-200",
            "placeholder:text-muted-foreground/50",
            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
            "hover:border-muted-foreground/30",
            error && "border-destructive focus:ring-destructive/30 focus:border-destructive"
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
          %
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
