import { Construction } from "lucide-react";
import { useLocation } from "react-router-dom";

export default function PlaceholderPage() {
  const location = useLocation();
  const path = location.pathname.split("/").filter(Boolean);
  const title = path[path.length - 1] || "Página";
  const formatted = title.charAt(0).toUpperCase() + title.slice(1);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Construction className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">{formatted}</h1>
      <p className="text-muted-foreground text-sm">Esta seção está em desenvolvimento.</p>
    </div>
  );
}
