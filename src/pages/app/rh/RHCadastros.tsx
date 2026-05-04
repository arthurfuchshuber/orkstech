import { Settings2 } from "lucide-react";
import { SimpleRegistrySection } from "@/components/rh/SimpleRegistrySection";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";

export default function RHCadastros() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;

  const { data: ccs = [] } = useQuery({
    queryKey: ["centros_custo", targetUserId],
    enabled: !!targetUserId,
    queryFn: async () => {
      const { data } = await supabase.from("centros_custo").select("id,nome").eq("user_id", targetUserId!);
      return data ?? [];
    },
  });
  const { data: deps = [] } = useQuery({
    queryKey: ["rh_departamentos", targetUserId],
    enabled: !!targetUserId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("rh_departamentos").select("id,nome").eq("user_id", targetUserId!);
      return data ?? [];
    },
  });

  const ccMap = new Map(ccs.map((c: any) => [c.id, c.nome]));
  const depMap = new Map(deps.map((d: any) => [d.id, d.nome]));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Cadastros RH</h1>
        <p className="text-sm text-muted-foreground">
          Bancos de dados que alimentam todos os dropdowns do módulo Recursos Humanos. Crie, edite e desative entradas — todas as telas refletem automaticamente.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        <SimpleRegistrySection
          table="rh_departamentos" queryKey="rh_departamentos"
          title="Departamentos" subtitle="Estrutura organizacional vinculada a centro de custo"
          icon="Building2"
          extraFields={[{ key: "centro_custo_id", label: "Centro de Custo (id opcional)", placeholder: "uuid do centro de custo" }]}
          secondaryFromRow={(r) => r.centro_custo_id ? `CC: ${ccMap.get(r.centro_custo_id) ?? "—"}` : undefined}
        />

        <SimpleRegistrySection
          table="rh_cargos" queryKey="rh_cargos"
          title="Cargos" subtitle="Funções com faixa salarial e CBO"
          icon="Briefcase"
          extraFields={[
            { key: "departamento_id", label: "Departamento (id opcional)" },
            { key: "cbo", label: "CBO" },
            { key: "faixa_salarial_min", label: "Faixa salarial mínima", type: "number" },
            { key: "faixa_salarial_max", label: "Faixa salarial máxima", type: "number" },
          ]}
          secondaryFromRow={(r) => r.departamento_id ? `Depto: ${depMap.get(r.departamento_id) ?? "—"}` : undefined}
        />

        <SimpleRegistrySection
          table="rh_tipos_vinculo" queryKey="rh_tipos_vinculo"
          title="Tipos de Vínculo" subtitle="CLT, PJ, Estagiário, Sócio…"
          icon="FileSignature"
          extraFields={[{ key: "descricao", label: "Descrição" }]}
        />

        <SimpleRegistrySection
          table="rh_tipos_beneficio" queryKey="rh_tipos_beneficio"
          title="Tipos de Benefício" subtitle="VR, VA, Plano de Saúde…"
          icon="Gift"
          extraFields={[
            { key: "valor_padrao", label: "Valor padrão (R$)", type: "number" },
            { key: "desconto_padrao", label: "Desconto padrão (R$)", type: "number" },
          ]}
          secondaryFromRow={(r) => `Padrão: R$ ${Number(r.valor_padrao || 0).toFixed(2)}`}
        />

        <SimpleRegistrySection
          table="rh_tipos_ausencia" queryKey="rh_tipos_ausencia"
          title="Tipos de Ausência" subtitle="Férias, atestados, licenças…"
          icon="CalendarOff"
          extraFields={[{ key: "cor", label: "Cor (hex)", type: "color" }]}
        />

        <SimpleRegistrySection
          table="rh_categorias_equipamento" queryKey="rh_categorias_equipamento"
          title="Categorias de Equipamento" subtitle="Notebook, Monitor, Celular…"
          icon="Package"
        />

        <SimpleRegistrySection
          table="rh_ferramentas" queryKey="rh_ferramentas"
          title="Ferramentas / Sistemas" subtitle="Catálogo de acessos e custos mensais"
          icon="Wrench"
          extraFields={[
            { key: "url", label: "URL" },
            { key: "custo_mensal", label: "Custo mensal (R$)", type: "number" },
          ]}
          secondaryFromRow={(r) => r.custo_mensal ? `R$ ${Number(r.custo_mensal).toFixed(2)}/mês` : undefined}
        />
      </div>
    </div>
  );
}
