import { describe, it, expect } from "vitest";
import { buildBankAccountOption } from "@/hooks/useBankAccountOptions";

describe("Dropdown source-of-truth: buildBankAccountOption", () => {
  it("usa connector_name como rótulo principal para contas Pluggy", () => {
    const o = buildBankAccountOption(
      { id: "1", nome: "BTG Empresas", banco: null, tipo: "corrente", pluggy_account_id: "pa1", origem: "pluggy" },
      "BTGPactual Empresas"
    );
    expect(o.primaryLabel).toBe("BTGPactual Empresas");
    expect(o.secondaryLabel).toBe("BTG Empresas");
  });

  it("usa nome do cadastro quando não há connector_name (manual)", () => {
    const o = buildBankAccountOption(
      { id: "2", nome: "Conta Corrente PJ", banco: "Itaú", tipo: "corrente", origem: "manual" },
      null
    );
    expect(o.primaryLabel).toBe("Conta Corrente PJ");
    expect(o.secondaryLabel).toBe("Itaú");
  });

  it("não duplica secundário quando nome técnico == connector_name", () => {
    const o = buildBankAccountOption(
      { id: "3", nome: "Nubank Empresas", tipo: "corrente", pluggy_account_id: "pa3" },
      "Nubank Empresas"
    );
    expect(o.primaryLabel).toBe("Nubank Empresas");
    expect(o.secondaryLabel).toBeNull();
  });

  it("nunca abrevia/transforma o nome do cadastro", () => {
    const nomeReal = "Nu Pagamentos S.A. - Instituição de Pagamento";
    const o = buildBankAccountOption(
      { id: "4", nome: nomeReal, banco: null, tipo: "corrente", pluggy_account_id: "pa4" },
      "Nubank Empresas"
    );
    expect(o.primaryLabel).toBe("Nubank Empresas");
    expect(o.secondaryLabel).toBe(nomeReal);
    // nada de "Nubank" / "BTG" / "..." aplicado por shortName
    expect(o.secondaryLabel).not.toMatch(/…$/);
  });

  it("classifica cartão por tipo ou por presença de limite/fatura", () => {
    expect(buildBankAccountOption({ id: "a", nome: "x", tipo: "cartao_credito" }, null).isCard).toBe(true);
    expect(buildBankAccountOption({ id: "b", nome: "x", tipo: "corrente", limite_credito_total: 5000 }, null).isCard).toBe(true);
    expect(buildBankAccountOption({ id: "c", nome: "x", tipo: "corrente" }, null).isCard).toBe(false);
  });
});
