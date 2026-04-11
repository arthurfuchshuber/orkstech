import * as React from "react";
import { cn } from "@/lib/utils";
import { DollarSign } from "lucide-react";

interface CurrencyInputProps {
  value: number; // value in cents
  onValueChange: (cents: number) => void;
  label?: string;
  error?: string;
  placeholder?: string;
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CurrencyInput({ value, onValueChange, label = "Valor", error, placeholder = "0,00" }: CurrencyInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    const cents = parseInt(raw || "0", 10);
    onValueChange(cents);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const raw = e.clipboardData.getData("text").replace(/\D/g, "");
    onValueChange(parseInt(raw || "0", 10));
  };

  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
          R$
        </div>
        <input
          type="text"
          inputMode="numeric"
          value={value > 0 ? formatCurrency(value) : ""}
          onChange={handleChange}
          onPaste={handlePaste}
          placeholder={placeholder}
          className={cn(
            "flex h-10 w-full rounded-lg border border-input bg-background pl-10 pr-3 py-2 text-sm transition-all duration-200",
            "placeholder:text-muted-foreground/50",
            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
            "hover:border-muted-foreground/30",
            error && "border-destructive focus:ring-destructive/30 focus:border-destructive"
          )}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
