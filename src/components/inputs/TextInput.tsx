import * as React from "react";
import { cn } from "@/lib/utils";

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, error, hint, icon, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && <label className="text-sm font-medium text-foreground">{label}</label>}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            maxLength={props.maxLength ?? 60}
            className={cn(
              "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all duration-200",
              "placeholder:text-muted-foreground/50",
              "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
              "hover:border-muted-foreground/30",
              icon && "pl-10",
              error && "border-destructive focus:ring-destructive/30 focus:border-destructive",
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    );
  }
);
TextInput.displayName = "TextInput";

export { TextInput };
