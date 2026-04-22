import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Building2 } from "lucide-react";
import { OwnersTab } from "@/components/admin/OwnersTab";
import { AllUsersTab } from "@/components/admin/AllUsersTab";
import { CreateSuperAdminDialog } from "@/components/admin/CreateSuperAdminDialog";
import type { AdminUser, NivelPermissao } from "@/components/admin/AdminUserTypes";

export default function AdminUsers() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-all-users"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-dashboard", {
        body: { action: "list_all_users" },
      });
      if (error) throw error;
      return data as { users: AdminUser[]; niveis: NivelPermissao[] };
    },
  });

  const users = data?.users ?? [];
  const niveis = data?.niveis ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <Tabs defaultValue="owners" className="w-full">
        <div className="flex items-center justify-between mb-4 gap-3">
          <TabsList>
            <TabsTrigger value="owners" className="gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Donos
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Todos os Usuários
            </TabsTrigger>
          </TabsList>
          <CreateSuperAdminDialog />
        </div>

        <TabsContent value="owners">
          <OwnersTab users={users} niveis={niveis} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="all">
          <AllUsersTab users={users} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
