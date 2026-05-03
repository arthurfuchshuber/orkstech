import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Zap, Mail, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { translateError } from "@/lib/translate-error";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Informe seu email"); return; }
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) { toast.error(translateError(error)); } else { setSent(true); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto">
            <Zap className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Recuperar senha</h1>
          <p className="text-sm text-muted-foreground">
            {sent ? "Verifique seu email para redefinir a senha" : "Informe seu email para receber o link de recuperação"}
          </p>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com"
                  className="flex h-10 w-full rounded-lg border border-input bg-background pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              </div>
            </div>
            <Button type="submit" className="w-full rounded-lg" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Enviar link de recuperação
            </Button>
          </form>
        ) : (
          <div className="text-center p-6 rounded-lg border border-primary/20 bg-primary/5">
            <p className="text-sm text-foreground">Email enviado para <strong>{email}</strong></p>
          </div>
        )}

        <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar para o login
        </Link>
      </div>
    </div>
  );
}
