import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "@/components/NavLink";
import { DynamicIcon } from "@/components/DynamicIcon";
import { useMenus, type MenuItem } from "@/hooks/useMenus";
import { useAuth } from "@/hooks/useAuth";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, Zap, ShieldCheck } from "lucide-react";
import { EmpresaSelector } from "@/components/EmpresaSelector";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

function hasActiveDescendant(item: MenuItem, pathname: string): boolean {
  if (item.route === pathname) return true;
  return item.children?.some((child) => hasActiveDescendant(child, pathname)) ?? false;
}

function findFirstRoute(item: MenuItem): string | null {
  if (item.route) return item.route;
  for (const child of item.children ?? []) {
    if (!child.is_active || !child.is_visible) continue;
    const route = findFirstRoute(child);
    if (route) return route;
  }
  return null;
}

function MenuItemNode({
  item,
  collapsed,
  depth = 0,
  pathname,
  openMap,
  onToggle,
}: {
  item: MenuItem;
  collapsed: boolean;
  depth?: number;
  pathname: string;
  openMap: Record<string, boolean>;
  onToggle: (id: string, parentId: string | null) => void;
}) {
  if (!item.is_visible || !item.is_active) return null;

  const hasChildren = !!item.children?.length;
  const isOpen = openMap[item.id] ?? false;
  const isActive = item.route ? pathname === item.route : false;
  const isChildActive = hasActiveDescendant(item, pathname) && !isActive;

  if (hasChildren && !item.route) {
    if (collapsed) {
      return (
        <>
          {item.children!.map((child) => (
            <MenuItemNode
              key={child.id}
              item={child}
              collapsed={collapsed}
              depth={depth}
              pathname={pathname}
              openMap={openMap}
              onToggle={onToggle}
            />
          ))}
        </>
      );
    }

    return (
      <div className="py-0.5">
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <button
              onClick={() => onToggle(item.id, item.parent_id)}
              className="relative w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-all duration-200 text-muted-foreground/70 hover:text-foreground hover:bg-muted/40"
              style={{ paddingLeft: `${12 + depth * 12}px` }}
            >
              <DynamicIcon name={item.icon} className="w-[15px] h-[15px] flex-shrink-0" />
              <span className="flex-1 text-left">{item.name}</span>
              <ChevronRight
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  isOpen ? "rotate-90 text-foreground/60" : "text-muted-foreground/40"
                } ${isChildActive ? "text-primary/70" : ""}`}
              />
            </button>
          </SidebarMenuButton>
        </SidebarMenuItem>

        {isOpen && (
          <SidebarGroupContent>
            <SidebarMenu>
              {item.children!.map((child) => (
                <MenuItemNode
                  key={child.id}
                  item={child}
                  collapsed={collapsed}
                  depth={depth + 1}
                  pathname={pathname}
                  openMap={openMap}
                  onToggle={onToggle}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        )}
      </div>
    );
  }

  if (hasChildren && item.route) {
    return (
      <div>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <div className="flex items-center">
              <NavLink
                to={item.route}
                className={`relative flex-1 flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-all duration-200 ${
                  isActive
                    ? "text-primary font-medium bg-primary/[0.08]"
                    : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/40"
                }`}
                activeClassName=""
                style={{ paddingLeft: `${12 + depth * 12}px` }}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full bg-primary" />
                )}
                <DynamicIcon
                  name={item.icon}
                  className={`w-[15px] h-[15px] flex-shrink-0 ${isActive ? "text-primary" : ""}`}
                />
                {!collapsed && <span>{item.name}</span>}
              </NavLink>
              {!collapsed && (
                <button onClick={() => onToggle(item.id, item.parent_id)} className="p-1">
                  <ChevronRight
                    className={`w-3 h-3 transition-transform duration-200 ${
                      isOpen ? "rotate-90 text-foreground/60" : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              )}
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
        {isOpen && !collapsed && (
          <SidebarMenu>
            {item.children!.map((child) => (
              <MenuItemNode
                key={child.id}
                item={child}
                collapsed={collapsed}
                depth={depth + 1}
                pathname={pathname}
                openMap={openMap}
                onToggle={onToggle}
              />
            ))}
          </SidebarMenu>
        )}
      </div>
    );
  }

  if (!item.route) return null;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <NavLink
          to={item.route}
          className={`relative flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-all duration-200 ${
            isActive
              ? "text-primary font-medium bg-primary/[0.08]"
              : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/40"
          }`}
          activeClassName=""
          style={{ paddingLeft: `${12 + depth * 12}px` }}
        >
          {isActive && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full bg-primary" />
          )}
          <DynamicIcon
            name={item.icon}
            className={`w-[15px] h-[15px] flex-shrink-0 ${isActive ? "text-primary" : ""}`}
          />
          {!collapsed && <span>{item.name}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSuperAdmin } = useSuperAdmin();
  const { tree, flatMenus, isLoading } = useMenus();

  // Check if user has open finance connections
  const { data: hasOpenFinance } = useQuery({
    queryKey: ["pluggy_connections_exist", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("pluggy_connections")
        .select("id", { count: "exact", head: true })
        .eq("status", "connected");
      return (count ?? 0) > 0;
    },
  });

  // Filter tree: hide "extrato-bancario" if no open finance connections
  const filteredTree = useMemo(() => {
    if (hasOpenFinance) return tree;
    const filterItems = (items: MenuItem[]): MenuItem[] =>
      items
        .filter((item) => item.slug !== "extrato-bancario")
        .map((item) => ({
          ...item,
          children: item.children ? filterItems(item.children) : [],
        }));
    return filterItems(tree);
  }, [tree, hasOpenFinance]);

  const findActiveIds = (items: MenuItem[], path: string): string[] => {
    for (const item of items) {
      if (item.route === path) return [item.id];
      if (item.children?.length) {
        const found = findActiveIds(item.children, path);
        if (found.length) return [item.id, ...found];
      }
    }
    return [];
  };

  const activeIdsKey = findActiveIds(filteredTree, location.pathname).join("|");

  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const ids = findActiveIds(filteredTree, location.pathname);
    const nextOpenMap: Record<string, boolean> = {};
    ids.forEach((id) => {
      nextOpenMap[id] = true;
    });
    setOpenMap(nextOpenMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdsKey, location.pathname]);

  const handleToggle = (id: string, parentId: string | null) => {
    const isCurrentlyOpen = !!openMap[id];

    // Close siblings
    const siblingIds = flatMenus
      .filter((menu) => menu.parent_id === parentId)
      .map((menu) => menu.id);

    const next: Record<string, boolean> = { ...openMap };
    siblingIds.forEach((siblingId) => {
      next[siblingId] = false;
    });

    if (!isCurrentlyOpen) {
      next[id] = true;

      // Navigate to the first route in this category
      const menuItem = flatMenus.find((m) => m.id === id);
      if (menuItem) {
        const firstRoute = findFirstRoute({
          ...menuItem,
          children: tree
            .flatMap(function flatten(m): MenuItem[] {
              return m.id === id ? [m] : (m.children ?? []).flatMap(flatten);
            })
            .find((m) => m.id === id)?.children,
        } as MenuItem);
        if (firstRoute && firstRoute !== location.pathname) {
          navigate(firstRoute);
        }
      }
    }

    setOpenMap(next);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4 space-y-3">
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
            <Zap className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          {!collapsed && <span className="text-sm font-semibold tracking-tight text-foreground">NexusOS</span>}
        </div>
        <EmpresaSelector collapsed={collapsed} />
      </SidebarHeader>

      <SidebarContent className="px-2">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : (
          <SidebarGroup className="py-0.5">
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredTree.map((item) => (
                  <MenuItemNode
                    key={item.id}
                    item={item}
                    collapsed={collapsed}
                    pathname={location.pathname}
                    openMap={openMap}
                    onToggle={handleToggle}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Admin Menu - Super Admin only */}
        {isSuperAdmin && (
          <SidebarGroup className="py-0.5 mt-2 border-t border-border/30 pt-2">
            <SidebarGroupContent>
              <SidebarMenu>
                {!collapsed && (
                  <div className="px-3 py-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Admin</span>
                  </div>
                )}
                {[
                  { label: "Painel Admin", route: "/app/admin", icon: "BarChart3" },
                  { label: "Usuários", route: "/app/admin/users", icon: "Users" },
                  { label: "Planos", route: "/app/admin/plans", icon: "CreditCard" },
                  { label: "Logs", route: "/app/admin/logs", icon: "ScrollText" },
                ].map((item) => {
                  const isActive = location.pathname === item.route;
                  return (
                    <SidebarMenuItem key={item.route}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.route}
                          className={`relative flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-all duration-200 ${
                            isActive
                              ? "text-primary font-medium bg-primary/[0.08]"
                              : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/40"
                          }`}
                          activeClassName=""
                        >
                          {isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full bg-primary" />
                          )}
                          <DynamicIcon
                            name={item.icon}
                            className={`w-[15px] h-[15px] flex-shrink-0 ${isActive ? "text-primary" : ""}`}
                          />
                          {!collapsed && <span>{item.label}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
