import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { validateCPF, validateCNPJ } from "@/components/inputs/DocumentInput";
import { toast } from "sonner";

interface CnpjData {
  razao_social: string;
  nome_fantasia: string;
  telefone: string;
  email: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

export function useDocumentValidation() {
  const [validatingCnpj, setValidatingCnpj] = useState(false);
  const [cnpjError, setCnpjError] = useState("");
  const [cpfError, setCpfError] = useState("");

  const validateCpfField = useCallback((rawCpf: string): boolean => {
    const digits = rawCpf.replace(/\D/g, "");
    if (!digits) {
      setCpfError("");
      return true; // empty is ok (optional)
    }
    if (digits.length !== 11) {
      setCpfError("CPF incompleto");
      return false;
    }
    if (!validateCPF(digits)) {
      setCpfError("CPF inválido");
      return false;
    }
    setCpfError("");
    return true;
  }, []);

  const validateCnpjField = useCallback(async (rawCnpj: string): Promise<{ valid: boolean; data?: CnpjData }> => {
    const digits = rawCnpj.replace(/\D/g, "");
    if (!digits) {
      setCnpjError("");
      return { valid: true };
    }
    if (digits.length !== 14) {
      setCnpjError("CNPJ incompleto");
      return { valid: false };
    }
    if (!validateCNPJ(digits)) {
      setCnpjError("CNPJ inválido");
      return { valid: false };
    }

    setValidatingCnpj(true);
    setCnpjError("");
    try {
      const { data, error } = await supabase.functions.invoke("consulta-cnpj", {
        body: { cnpj: digits },
      });

      if (error) {
        // Try to parse the error body
        const errBody = typeof error === "object" && error.message ? error.message : String(error);
        setCnpjError(errBody);
        return { valid: false };
      }

      if (data?.error) {
        setCnpjError(data.error);
        toast.error(data.error);
        return { valid: false };
      }

      setCnpjError("");
      return { valid: true, data: data as CnpjData };
    } catch (e: any) {
      setCnpjError("Erro ao validar CNPJ");
      return { valid: false };
    } finally {
      setValidatingCnpj(false);
    }
  }, []);

  const clearErrors = useCallback(() => {
    setCpfError("");
    setCnpjError("");
  }, []);

  return {
    validatingCnpj,
    cnpjError,
    cpfError,
    validateCpfField,
    validateCnpjField,
    clearErrors,
    setCnpjError,
    setCpfError,
  };
}
