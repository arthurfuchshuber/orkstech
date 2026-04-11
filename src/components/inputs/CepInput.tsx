import { MaskedInput } from "./MaskedInput";
import { MapPin } from "lucide-react";

interface CepInputProps {
  value: string;
  onValueChange: (raw: string, formatted: string) => void;
  onAddressFound?: (address: { logradouro: string; bairro: string; cidade: string; estado: string }) => void;
  label?: string;
  error?: string;
}

export async function fetchAddressByCep(cep: string) {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return {
      logradouro: data.logradouro || "",
      bairro: data.bairro || "",
      cidade: data.localidade || "",
      estado: data.uf || "",
    };
  } catch {
    return null;
  }
}

export function CepInput({ value, onValueChange, onAddressFound, label = "CEP", error }: CepInputProps) {
  const handleChange = async (raw: string, formatted: string) => {
    onValueChange(raw, formatted);
    if (raw.length === 8 && onAddressFound) {
      const address = await fetchAddressByCep(raw);
      if (address) onAddressFound(address);
    }
  };

  return (
    <MaskedInput
      mask="00000-000"
      value={value}
      onValueChange={handleChange}
      label={label}
      placeholder="00000-000"
      error={error}
      icon={<MapPin className="w-4 h-4" />}
    />
  );
}
