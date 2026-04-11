import { DollarSign, TrendingUp, TrendingDown, CreditCard, ArrowUpRight } from "lucide-react";
import { StatCard } from "@/components/StatCard";

const transactions = [
  { id: "#TXN-001", descricao: "Pagamento - Cliente Alpha", valor: "R$ 15.200,00", tipo: "entrada", data: "10/04/2026", status: "Concluído" },
  { id: "#TXN-002", descricao: "Aluguel Escritório", valor: "R$ 4.500,00", tipo: "saida", data: "10/04/2026", status: "Concluído" },
  { id: "#TXN-003", descricao: "Serviço de Marketing", valor: "R$ 8.900,00", tipo: "entrada", data: "09/04/2026", status: "Pendente" },
  { id: "#TXN-004", descricao: "Licença Software", valor: "R$ 1.200,00", tipo: "saida", data: "09/04/2026", status: "Concluído" },
  { id: "#TXN-005", descricao: "Consultoria - Beta Corp", valor: "R$ 22.000,00", tipo: "entrada", data: "08/04/2026", status: "Concluído" },
];

export default function Financas() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Finanças</h1>
        <p className="text-muted-foreground text-sm">Gestão financeira completa</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} title="Saldo Atual" value="R$ 124.800" change="+R$ 18.200 este mês" changeType="positive" />
        <StatCard icon={TrendingUp} title="Receitas (mês)" value="R$ 68.400" change="+12.5%" changeType="positive" />
        <StatCard icon={TrendingDown} title="Despesas (mês)" value="R$ 35.200" change="-3.1%" changeType="positive" />
        <StatCard icon={CreditCard} title="A Receber" value="R$ 45.600" change="12 faturas" changeType="neutral" />
      </div>

      <div className="rounded-xl glass overflow-hidden">
        <div className="p-5 border-b border-border/30">
          <h3 className="text-sm font-semibold text-foreground">Transações Recentes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left text-xs font-medium text-muted-foreground p-4">ID</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">Descrição</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">Valor</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">Data</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                  <td className="p-4 text-sm font-mono text-muted-foreground">{tx.id}</td>
                  <td className="p-4 text-sm text-foreground">{tx.descricao}</td>
                  <td className={`p-4 text-sm font-medium ${tx.tipo === "entrada" ? "text-success" : "text-destructive"}`}>
                    {tx.tipo === "entrada" ? "+" : "-"}{tx.valor}
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{tx.data}</td>
                  <td className="p-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      tx.status === "Concluído" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                    }`}>
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
