import * as React from "react";
import { cn } from "@/lib/utils";

interface TextareaInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const TextareaInput = React.forwardRef<HTMLTextAreaElement, TextareaInputProps>(
  ({ label, error, hint, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && <label className="text-sm font-medium text-foreground">{label}</label>}
        <textarea
          ref={ref}
          className={cn(
            "flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-all duration-200 resize-none",
            "placeholder:text-muted-foreground/50",
            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
            "hover:border-muted-foreground/30",
            error && "border-destructive focus:ring-destructive/30 focus:border-destructive",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    );
  }
);
TextareaInput.displayName = "TextareaInput";

export { TextareaInput };
