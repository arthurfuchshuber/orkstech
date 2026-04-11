import { MaskedInput } from "./MaskedInput";
import { FileText } from "lucide-react";

interface DocumentInputProps {
  type: "cpf" | "cnpj";
  value: string;
  onValueChange: (raw: string, formatted: string) => void;
  error?: string;
  label?: string;
  placeholder?: string;
  onBlur?: () => void;
}

const masks = {
  cpf: "000.000.000-00",
  cnpj: "00.000.000/0000-00",
};

const placeholders = {
  cpf: "000.000.000-00",
  cnpj: "00.000.000/0000-00",
};

export function validateCPF(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(cpf[10]);
}

export function validateCNPJ(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(cnpj[i]) * weights1[i];
  let rest = sum % 11;
  if (rest < 2) rest = 0; else rest = 11 - rest;
  if (rest !== parseInt(cnpj[12])) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(cnpj[i]) * weights2[i];
  rest = sum % 11;
  if (rest < 2) rest = 0; else rest = 11 - rest;
  return rest === parseInt(cnpj[13]);
}

export function DocumentInput({ type, value, onValueChange, error, label, placeholder, onBlur }: DocumentInputProps) {
  return (
    <MaskedInput
      mask={masks[type]}
      value={value}
      onValueChange={onValueChange}
      label={label || (type === "cpf" ? "CPF" : "CNPJ")}
      placeholder={placeholder || placeholders[type]}
      error={error}
      icon={<FileText className="w-4 h-4" />}
      onBlur={onBlur}
    />
  );
}
