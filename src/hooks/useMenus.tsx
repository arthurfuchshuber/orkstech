import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCallback } from "react";

export interface MenuItem {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  icon: string;
  route: string | null;
  parent_id: string | null;
  order_index: number;
  module: string;
  is_visible: boolean;
  is_active: boolean;
  children?: MenuItem[];
}

function buildTree(items: MenuItem[], parentId: string | null = null): MenuItem[] {
  return items
    .filter((i) => i.parent_id === parentId)
    .sort((a, b) => a.order_index - b.order_index)
    .map((i) => ({ ...i, children: buildTree(items, i.id) }));
}

export function useMenus() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: flatMenus = [], isLoading } = useQuery({
    queryKey: ["menus", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Try to fetch menus
      let { data, error } = await supabase
        .from("menus")
        .select("*")
        .order("order_index");

      if (error) throw error;

      // If no menus exist, seed them
      if (!data || data.length === 0) {
        await supabase.rpc("seed_default_menus", { p_user_id: user!.id });
        const res = await supabase.from("menus").select("*").order("order_index");
        if (res.error) throw res.error;
        data = res.data;
      }

      return (data ?? []) as MenuItem[];
    },
  });

  const tree = buildTree(flatMenus);

  const updateMenu = useMutation({
    mutationFn: async (updates: Partial<MenuItem> & { id: string }) => {
      const { id, children, ...rest } = updates as any;
      const { error } = await supabase.from("menus").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menus"] }),
  });

  const createMenu = useMutation({
    mutationFn: async (menu: Omit<MenuItem, "id" | "children">) => {
      const { error } = await supabase.from("menus").insert(menu);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menus"] }),
  });

  const deleteMenu = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menus").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menus"] }),
  });

  const reorder = useMutation({
    mutationFn: async (updates: { id: string; order_index: number; parent_id: string | null }[]) => {
      for (const u of updates) {
        await supabase.from("menus").update({ order_index: u.order_index, parent_id: u.parent_id }).eq("id", u.id);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menus"] }),
  });

  return { flatMenus, tree, isLoading, updateMenu, createMenu, deleteMenu, reorder };
}
