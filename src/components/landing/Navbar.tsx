import { useEffect, useState } from "react";
import { Menu, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { OrksWordmark } from "@/components/OrksWordmark";

const links = [
  { label: "Dores", href: "#dores" },
  { label: "Produto", href: "#produto" },
  { label: "Resultados", href: "#prova" },
  { label: "Planos", href: "#planos" },
  { label: "FAQ", href: "#faq" },
];

export const Navbar = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "py-2" : "py-4"
      }`}
    >
      <div
        className={`mx-auto max-w-7xl px-4 sm:px-6 transition-all duration-300 ${
          scrolled ? "glass-strong rounded-full" : ""
        }`}
      >
        <nav className="flex items-center justify-between h-14">
          <a href="#top" className="flex items-center gap-3 group min-w-0">
            <OrksWordmark size="text-xl sm:text-2xl" />
            <span className="hidden md:inline text-[10px] text-muted-foreground tracking-[0.25em] uppercase border-l border-border/40 pl-3">
              Gestão 360º
            </span>
          </a>

          <div className="hidden md:flex items-center gap-7">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hidden sm:inline-flex h-9"
              onClick={() => navigate("/login")}
            >
              Entrar
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/register")}
              className="hidden md:inline-flex bg-gradient-primary hover:opacity-90 shadow-glow-sm text-primary-foreground rounded-full px-5"
            >
              Começar grátis
              <ArrowRight className="size-3.5 ml-1" />
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/register")}
              className="md:hidden bg-gradient-primary hover:opacity-90 text-primary-foreground rounded-full px-3 h-9 text-xs"
            >
              Grátis
              <ArrowRight className="size-3.5 ml-1" />
            </Button>
            <button
              className="md:hidden text-foreground p-2"
              onClick={() => setOpen((v) => !v)}
              aria-label="Abrir menu"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </nav>

        {open && (
          <div className="md:hidden mt-2 glass-strong rounded-2xl p-4 animate-fade-in">
            <div className="flex flex-col gap-3">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="text-sm text-muted-foreground hover:text-foreground py-2"
                >
                  {l.label}
                </a>
              ))}
              <Button
                onClick={() => {
                  setOpen(false);
                  navigate("/login");
                }}
                variant="outline"
                className="rounded-full mt-1"
              >
                Já sou cliente
              </Button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
