import { useEffect, useState, useCallback, type ReactNode } from "react";
import { AlertTriangle, Building2, Loader2, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DocumentInput } from "@/components/inputs/DocumentInput";
import { useEmpresa } from "@/hooks/useEmpresa";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const VALIDATION_CACHE_KEY = "nexus_empresa_cnpj_validated";

interface ValidationState {
  status: "idle" | "checking" | "valid" | "invalid";
  message?: string;
  situacao?: string;
}

export function EmpresaCnpjGuard({ children }: { children: ReactNode }) {
  const { empresa, loading, refetch, isSuperAdminMode } = useEmpresa();
  const [state, setState] = useState<ValidationState>({ status: "idle" });
  const [newCnpj, setNewCnpj] = useState("");
  const [saving, setSaving] = useState(false);

  const validateCnpj = useCallback(async (cnpj: string) => {
    const clean = (cnpj || "").replace(/\D/g, "");
    if (clean.length !== 14) {
      setState({ status: "invalid", message: "O CNPJ cadastrado é inválido (deve conter 14 dígitos)." });
      return false;
    }
    setState({ status: "checking" });
    try {
      const { data, error } = await supabase.functions.invoke("consulta-cnpj", { body: { cnpj: clean } });
      if (error || (data as any)?.error) {
        const msg = (data as any)?.error || error?.message || "Não foi possível validar o CNPJ.";
        setState({ status: "invalid", message: msg, situacao: (data as any)?.situacao });
        return false;
      }
      setState({ status: "valid" });
      try { sessionStorage.setItem(`${VALIDATION_CACHE_KEY}_${clean}`, "1"); } catch {}
      return true;
    } catch (e: any) {
      setState({ status: "invalid", message: e?.message || "Erro de conexão ao validar CNPJ." });
      return false;
    }
  }, []);

  // Run validation whenever active empresa changes
  useEffect(() => {
    if (loading || !empresa?.cnpj) {
      setState({ status: "idle" });
      return;
    }

    setNewCnpj(empresa.cnpj);

    const clean = empresa.cnpj.replace(/\D/g, "");
    try {
      if (sessionStorage.getItem(`${VALIDATION_CACHE_KEY}_${clean}`) === "1") {
        setState({ status: "valid" });
        return;
      }
    } catch {}

    void validateCnpj(empresa.cnpj);
  }, [empresa?.id, empresa?.cnpj, loading, validateCnpj]);

  const handleSave = async () => {
    if (!empresa) return;
    const clean = newCnpj.replace(/\D/g, "");
    if (clean.length !== 14) {
      toast.error("Informe um CNPJ válido (14 dígitos).");
      return;
    }

    setSaving(true);
    const ok = await validateCnpj(clean);
    if (!ok) {
      setSaving(false);
      return;
    }

    const result = isSuperAdminMode
      ? await supabase.functions.invoke("admin-dashboard", {
          body: { action: "update_company", empresa_id: empresa.id, cnpj: clean },
        })
      : await supabase.from("empresas").update({ cnpj: clean }).eq("id", empresa.id);

    setSaving(false);

    const updateError = "error" in result ? result.error : null;
    const updateData = "data" in result ? result.data : null;

    if (updateError || (updateData as any)?.error) {
      toast.error(`Erro ao salvar: ${(updateData as any)?.error || updateError?.message || "Falha ao atualizar empresa."}`);
      setState({ status: "invalid", message: (updateData as any)?.error || updateError?.message || "Falha ao atualizar empresa." });
      return;
    }

    try { sessionStorage.setItem(`${VALIDATION_CACHE_KEY}_${clean}`, "1"); } catch {}
    toast.success("CNPJ atualizado e validado com sucesso!");
    await refetch();
    setState({ status: "valid" });
  };

  const isBlocking = state.status === "invalid" || state.status === "checking";

  return (
    <>
      {children}
      <Dialog open={isBlocking} onOpenChange={() => { /* non-dismissible */ }}>
        <DialogContent
          className="max-w-md border-destructive/40 [&>button.absolute]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 ring-1 ring-destructive/30">
              {state.status === "checking" ? (
                <Loader2 className="h-6 w-6 animate-spin text-destructive" />
              ) : (
                <ShieldAlert className="h-6 w-6 text-destructive" />
              )}
            </div>
            <DialogTitle className="text-center text-lg">
              {state.status === "checking" ? "Validando CNPJ..." : "Divergência no cadastro da empresa"}
            </DialogTitle>
            <DialogDescription className="text-center text-sm">
              {state.status === "checking"
                ? "Verificando a situação cadastral junto à Receita Federal."
                : "O acesso ao sistema está bloqueado até que o CNPJ esteja correto e ATIVO na Receita Federal."}
            </DialogDescription>
          </DialogHeader>

          {state.status === "invalid" && (
            <div className="space-y-4 py-2">
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                  <div className="space-y-1 text-xs">
                    <p className="font-medium text-destructive">Motivo da divergência</p>
                    <p className="text-muted-foreground">{state.message}</p>
                    {state.situacao && (
                      <p className="text-muted-foreground">
                        Situação atual: <span className="font-medium text-foreground">{state.situacao}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  Empresa: {empresa?.razao_social || "—"}
                </label>
                <DocumentInput
                  type="cnpj"
                  value={newCnpj}
                  onValueChange={setNewCnpj}
                  label="Corrigir CNPJ"
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={saving || newCnpj.replace(/\D/g, "").length !== 14}
                className="w-full"
              >
                {saving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Validando e salvando...</>
                ) : (
                  "Validar e salvar CNPJ"
                )}
              </Button>

              <p className="text-center text-[10px] text-muted-foreground">
                A validação é feita em tempo real junto à Receita Federal.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
