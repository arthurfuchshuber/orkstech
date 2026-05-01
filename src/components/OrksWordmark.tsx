interface OrksWordmarkProps {
  className?: string;
  /** Tailwind text size class, e.g. "text-2xl" */
  size?: string;
}

/**
 * Orks horizontal wordmark — geometric techno typography (Orbitron),
 * with the "K" highlighted in primary electric blue.
 * Pure CSS, transparent, scales perfectly at any size.
 */
export function OrksWordmark({ className = "", size = "text-xl" }: OrksWordmarkProps) {
  return (
    <span
      className={`inline-flex items-baseline font-black tracking-[0.08em] leading-none select-none ${size} ${className}`}
      style={{ fontFamily: "'Orbitron', 'Inter', sans-serif" }}
      aria-label="Orks"
    >
      <span className="text-foreground">OR</span>
      <span className="text-primary">K</span>
      <span className="text-foreground">S</span>
    </span>
  );
}
