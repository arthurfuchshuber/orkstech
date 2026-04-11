import * as React from "react";
import { cn } from "@/lib/utils";

interface MaskedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  mask: string; // e.g. "000.000.000-00"
  value: string;
  onValueChange: (raw: string, formatted: string) => void;
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
}

function applyMask(raw: string, mask: string): string {
  let result = "";
  let rawIndex = 0;
  for (let i = 0; i < mask.length && rawIndex < raw.length; i++) {
    if (mask[i] === "0") {
      result += raw[rawIndex];
      rawIndex++;
    } else {
      result += mask[i];
      if (raw[rawIndex] === mask[i]) rawIndex++;
    }
  }
  return result;
}

function stripMask(value: string): string {
  return value.replace(/\D/g, "");
}

function maxDigits(mask: string): number {
  return (mask.match(/0/g) || []).length;
}

const MaskedInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ mask, value, onValueChange, label, error, hint, icon, suffix, className, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = stripMask(e.target.value).slice(0, maxDigits(mask));
      const formatted = applyMask(raw, mask);
      onValueChange(raw, formatted);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = stripMask(e.clipboardData.getData("text")).slice(0, maxDigits(mask));
      const formatted = applyMask(pasted, mask);
      onValueChange(pasted, formatted);
    };

    const formatted = applyMask(stripMask(value), mask);

    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-sm font-medium text-foreground">{label}</label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            type="text"
            inputMode="numeric"
            value={formatted}
            onChange={handleChange}
            onPaste={handlePaste}
            className={cn(
              "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all duration-200",
              "placeholder:text-muted-foreground/50",
              "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
              "hover:border-muted-foreground/30",
              icon && "pl-10",
              suffix && "pr-10",
              error && "border-destructive focus:ring-destructive/30 focus:border-destructive",
              className
            )}
            {...props}
          />
          {suffix && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              {suffix}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    );
  }
);
MaskedInput.displayName = "MaskedInput";

export { MaskedInput, applyMask, stripMask };
