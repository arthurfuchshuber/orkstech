import { useEffect, useRef, useState } from "react";
import { Star, Quote } from "lucide-react";

const stats = [
  { v: 99.9, suffix: "%", l: "Disponibilidade garantida", decimal: true },
  { v: 50, suffix: "k+", l: "Transações sincronizadas/dia" },
  { v: 80, suffix: "%", l: "Menos tempo no fechamento" },
  { v: 4.9, suffix: "★", l: "Satisfação dos usuários", decimal: true },
];

const cases = [
  { local: "Escritório de advocacia · SP", before: "24h/semana", after: "4h/semana", lift: "−83%" },
  { local: "Agência de marketing · RS", before: "5 sistemas", after: "1 plataforma", lift: "−80%" },
  { local: "Consultoria contábil · MG", before: "Mensal", after: "Tempo real", lift: "+100% visibilidade" },
];

const depoimentos = [
  {
    name: "Rafael M.",
    role: "Sócio-diretor",
    location: "Escritório jurídico",
    text: "Trocamos quatro planilhas e dois sistemas pelo Orks. Hoje tenho o resultado do mês em tempo real, e meu time recuperou um dia inteiro por semana.",
    initials: "RM",
  },
  {
    name: "Camila A.",
    role: "Head Financeiro",
    location: "Agência B2B",
    text: "O scanner de boletos e a classificação automática transformaram a rotina. Conciliação bancária deixou de ser sofrimento.",
    initials: "CA",
  },
  {
    name: "Lucas H.",
    role: "CEO",
    location: "Consultoria",
    text: "O Workspace 360º do cliente é o que faltava. Agora vendas, jurídico e financeiro vêem a mesma realidade.",
    initials: "LH",
  },
];

function Counter({ to, suffix = "", decimal = false }: { to: number; suffix?: string; decimal?: boolean }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true;
          const dur = 1600;
          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min(1, (now - start) / dur);
            const eased = 1 - Math.pow(1 - p, 3);
            setVal(to * eased);
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [to]);

  const display = decimal ? val.toFixed(1) : Math.round(val).toString();
  return (
    <span ref={ref} className="font-display text-3xl md:text-5xl font-bold text-gradient">
      {display}
      <span className="text-primary">{suffix}</span>
    </span>
  );
}

export const SocialProof = () => {
  return (
    <section id="prova" className="py-20 md:py-28 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 max-w-6xl mx-auto reveal">
          {stats.map((s) => (
            <div
              key={s.l}
              className="rounded-3xl glass-strong p-6 sm:p-7 text-center gradient-border"
            >
              <Counter to={s.v} suffix={s.suffix} decimal={s.decimal} />
              <div className="text-xs sm:text-sm text-muted-foreground mt-3">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Depoimentos */}
        <div className="mt-20 max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-5">
            {depoimentos.map((d) => (
              <figure key={d.name} className="rounded-3xl glass p-7 relative reveal">
                <Quote className="size-8 text-primary/40 mb-4" />
                <blockquote className="text-foreground/90 leading-relaxed">
                  "{d.text}"
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 pt-5 border-t border-border/60">
                  <span className="size-11 rounded-full bg-gradient-primary flex items-center justify-center font-display font-bold text-primary-foreground shrink-0">
                    {d.initials}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{d.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{d.role}</div>
                    <div className="text-xs text-muted-foreground truncate">{d.location}</div>
                  </div>
                  <div className="ml-auto flex gap-0.5 text-primary shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="size-3.5 fill-primary" />
                    ))}
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
