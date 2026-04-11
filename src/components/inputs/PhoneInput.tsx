import * as React from "react";
import { cn } from "@/lib/utils";
import { Phone } from "lucide-react";

interface PhoneInputProps {
  value: string;
  onValueChange: (raw: string, formatted: string) => void;
  label?: string;
  error?: string;
  placeholder?: string;
}

function formatPhone(raw: string): string {
  if (raw.length <= 2) return `(${raw}`;
  if (raw.length <= 6) return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
  if (raw.length <= 10) return `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
  return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
}

export function PhoneInput({ value, onValueChange, label = "Telefone", error, placeholder = "(00) 00000-0000" }: PhoneInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 11);
    onValueChange(raw, formatPhone(raw));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const raw = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 11);
    onValueChange(raw, formatPhone(raw));
  };

  const formatted = value ? formatPhone(value.replace(/\D/g, "")) : "";

  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Phone className="w-4 h-4" />
        </div>
        <input
          type="text"
          inputMode="numeric"
          value={formatted}
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
