import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "@/components/NavLink";
import { DynamicIcon } from "@/components/DynamicIcon";
import { useMenus, type MenuItem } from "@/hooks/useMenus";
import { useAuth } from "@/hooks/useAuth";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useEmpresa } from "@/hooks/useEmpresa";
import { usePermissions, getMenuPermissionKey } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight } from "lucide-react";
import { EmpresaSelector } from "@/components/EmpresaSelector";
import { OrksWordmark } from "@/components/OrksWordmark";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import orksLogoMark from "@/assets/orks-logo-mark.png";
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

// Map of routes that redirect to other routes (from App.tsx Navigate elements)
const ROUTE_REDIRECTS: Record<string, string> = {
  "/app/dashboard": "/app/financas/dashboard",
  "/app/financas/plano-de-contas": "/app/financas/cadastros",
  "/app/financas/centros-de-custo": "/app/financas/cadastros",
  "/app/financas/formas-de-pagamento": "/app/financas/cadastros",
  "/app/financas/contas-bancarias": "/app/financas/cadastros",
  "/app/financas/extrato": "/app/extrato-bancario",
  "/app/automacoes/workflows": "/app/automacoes/config",
  "/app/config/permissoes": "/app/config/conta",
  "/app/rh": "/app/rh/colaboradores",
};

function resolveRoute(route: string | null): string | null {
  if (!route) return null;
  return ROUTE_REDIRECTS[route] ?? route;
}

function hasActiveDescendant(item: MenuItem, pathname: string): boolean {
  if (resolveRoute(item.route) === pathname) return true;
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

/* ---------- EXPANDED ---------- */
function MenuItemNode({
  item,
  depth = 0,
  pathname,
  openMap,
  onToggle,
}: {
  item: MenuItem;
  depth?: number;
  pathname: string;
  openMap: Record<string, boolean>;
  onToggle: (id: string, parentId: string | null) => void;
}) {
  if (!item.is_visible || !item.is_active) return null;

  const hasChildren = !!item.children?.length;
  const isOpen = openMap[item.id] ?? false;
  const resolvedRoute = resolveRoute(item.route);
  const isActive = resolvedRoute ? pathname === resolvedRoute : false;
  const isChildActive = hasActiveDescendant(item, pathname) && !isActive;

  if (hasChildren && !item.route) {
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
                <span>{item.name}</span>
              </NavLink>
              <button onClick={() => onToggle(item.id, item.parent_id)} className="p-1">
                <ChevronRight
                  className={`w-3 h-3 transition-transform duration-200 ${
                    isOpen ? "rotate-90 text-foreground/60" : "text-muted-foreground/30"
                  }`}
                />
              </button>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
        {isOpen && (
          <SidebarMenu>
            {item.children!.map((child) => (
              <MenuItemNode
                key={child.id}
                item={child}
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
          <span>{item.name}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/* ---------- COLLAPSED: only root icon + popover with children on hover ---------- */
function CollapsedItem({ item, pathname }: { item: MenuItem; pathname: string }) {
  const navigate = useNavigate();
  if (!item.is_visible || !item.is_active) return null;

  const hasChildren = !!item.children?.length;
  const resolvedRoute = resolveRoute(item.route);
  const isActive = resolvedRoute ? pathname === resolvedRoute : false;
  const isChildActive = hasActiveDescendant(item, pathname);

  const handleClick = () => {
    if (item.route) {
      navigate(item.route);
    } else {
      const first = findFirstRoute(item);
      if (first) navigate(first);
    }
  };

  const trigger = (
    <button
      onClick={handleClick}
      className={`relative w-10 h-10 mx-auto flex items-center justify-center rounded-lg transition-all duration-200 ${
        isActive || isChildActive
          ? "text-primary bg-primary/[0.10]"
          : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/40"
      }`}
      title={item.name}
    >
      {(isActive || isChildActive) && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-full bg-primary" />
      )}
      <DynamicIcon name={item.icon} className="w-[18px] h-[18px]" />
    </button>
  );

  if (!hasChildren) {
    return <div className="px-1 py-0.5">{trigger}</div>;
  }

  return (
    <div className="px-1 py-0.5">
      <HoverCard openDelay={80} closeDelay={120}>
        <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
        <HoverCardContent
          side="right"
          align="start"
          sideOffset={8}
          className="w-60 p-2 bg-popover/95 backdrop-blur-xl border-border/40"
        >
          <div className="px-2 pb-2 mb-1 border-b border-border/40">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {item.name}
            </p>
          </div>
          <div className="space-y-0.5">
            {item.children!.map((child) => (
              <CollapsedChildLink key={child.id} item={child} pathname={pathname} depth={0} />
            ))}
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

function CollapsedChildLink({
  item,
  pathname,
  depth,
}: {
  item: MenuItem;
  pathname: string;
  depth: number;
}) {
  if (!item.is_visible || !item.is_active) return null;
  const hasChildren = !!item.children?.length;
  const resolvedRoute = resolveRoute(item.route);
  const isActive = resolvedRoute ? pathname === resolvedRoute : false;

  if (hasChildren && !item.route) {
    return (
      <div>
        <div
          className="flex items-center gap-2 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80"
          style={{ paddingLeft: `${8 + depth * 10}px` }}
        >
          <DynamicIcon name={item.icon} className="w-3.5 h-3.5" />
          {item.name}
        </div>
        <div className="space-y-0.5">
          {item.children!.map((child) => (
            <CollapsedChildLink key={child.id} item={child} pathname={pathname} depth={depth + 1} />
          ))}
        </div>
      </div>
    );
  }

  if (!item.route) return null;

  return (
    <NavLink
      to={item.route}
      className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition-colors ${
        isActive
          ? "text-primary bg-primary/[0.10] font-medium"
          : "text-foreground/80 hover:text-foreground hover:bg-muted/50"
      }`}
      activeClassName=""
      style={{ paddingLeft: `${8 + depth * 10}px` }}
    >
      <DynamicIcon name={item.icon} className="w-[14px] h-[14px] flex-shrink-0" />
      <span className="truncate">{item.name}</span>
    </NavLink>
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
  const { empresa } = useEmpresa();
  const { canView } = usePermissions();

  // Super Admin without empresa: auto-navigate to admin panel
  useEffect(() => {
    if (isSuperAdmin && !empresa && !location.pathname.startsWith("/app/admin")) {
      navigate("/app/admin", { replace: true });
    }
  }, [isSuperAdmin, empresa, location.pathname, navigate]);

  // Check if user/company has open finance connections
  const targetUserId = empresa?.user_id;
  const { data: hasOpenFinance } = useQuery({
    queryKey: ["pluggy_connections_exist", targetUserId ?? user?.id],
    enabled: !!(targetUserId ?? user?.id),
    queryFn: async () => {
      const uid = targetUserId ?? user!.id;
      const { count } = await supabase
        .from("pluggy_connections")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid);
      return (count ?? 0) > 0;
    },
  });

  const filteredTree = useMemo(() => {
    const hasAnyFinanceConfigPermission =
      canView("finance:plano-contas") ||
      canView("finance:centros-custo") ||
      canView("finance:contas-bancarias") ||
      canView("finance:open-finance") ||
      canView("finance:formas-pagamento");

    const filterItems = (items: MenuItem[]): MenuItem[] =>
      items
        .filter((item) => {
          if (item.slug === "extrato-bancario" && !hasOpenFinance) return false;
          if (item.slug === "cadastros-financeiros" && !hasAnyFinanceConfigPermission) return false;
          const permissionKey = getMenuPermissionKey(item.slug);
          if (permissionKey) return canView(permissionKey);
          return true;
        })
        .map((item) => ({
          ...item,
          children: item.children ? filterItems(item.children) : [],
        }))
        .filter((item) => item.route || (item.children && item.children.length > 0));
    return filterItems(tree);
  }, [tree, hasOpenFinance, canView]);

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
    setOpenMap(() => {
      const next: Record<string, boolean> = {};
      ids.forEach((id) => {
        next[id] = true;
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdsKey, location.pathname]);

  const findInTree = (items: MenuItem[], targetId: string): MenuItem | null => {
    for (const item of items) {
      if (item.id === targetId) return item;
      if (item.children?.length) {
        const found = findInTree(item.children, targetId);
        if (found) return found;
      }
    }
    return null;
  };

  const handleToggle = (id: string, parentId: string | null) => {
    const isCurrentlyOpen = !!openMap[id];

    const siblingIds = flatMenus
      .filter((menu) => menu.parent_id === parentId)
      .map((menu) => menu.id);

    const next: Record<string, boolean> = { ...openMap };
    siblingIds.forEach((siblingId) => {
      next[siblingId] = false;
    });

    if (!isCurrentlyOpen) {
      next[id] = true;

      const menuItem = findInTree(filteredTree, id);
      if (menuItem) {
        const firstRoute = findFirstRoute(menuItem);
        if (firstRoute && firstRoute !== location.pathname) {
          const pathIds = findActiveIds(filteredTree, firstRoute);
          pathIds.forEach((pid) => {
            next[pid] = true;
          });
          navigate(firstRoute);
        }
      }
    }

    setOpenMap(next);
  };

  const showRegularMenus = !!empresa;
  const isAdminActive = location.pathname.startsWith("/app/admin");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className={collapsed ? "px-0 py-3 space-y-2" : "px-3 py-4 space-y-3"}>
        <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2.5 px-1"}`}>
          {collapsed ? (
            <div
              className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center font-black text-primary leading-none"
              style={{ fontFamily: "'Orbitron', 'Inter', sans-serif", fontSize: "15px" }}
              title="Orks · Gestão 360º"
            >
              O
            </div>
          ) : (
            <div className="flex items-center gap-3 min-w-0">
              <OrksWordmark size="text-xl" />
              <span className="text-[10px] text-muted-foreground tracking-[0.25em] uppercase border-l border-border/40 pl-3">
                Gestão 360º
              </span>
            </div>
          )}
        </div>
        <EmpresaSelector collapsed={collapsed} />
      </SidebarHeader>

      <SidebarContent className={collapsed ? "px-0" : "px-2"}>
        {/* Regular menus - only when an empresa is selected */}
        {showRegularMenus && (
          <>
            {isLoading ? (
              <div className={`space-y-2 ${collapsed ? "px-1.5" : "p-3"}`}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className={collapsed ? "h-9 w-9 mx-auto rounded-lg" : "h-6 w-full"} />
                ))}
              </div>
            ) : (
              <SidebarGroup className="py-0.5">
                <SidebarGroupContent>
                  {collapsed ? (
                    <div className="space-y-0.5">
                      {filteredTree.map((item) => (
                        <CollapsedItem key={item.id} item={item} pathname={location.pathname} />
                      ))}
                    </div>
                  ) : (
                    <SidebarMenu>
                      {filteredTree.map((item) => (
                        <MenuItemNode
                          key={item.id}
                          item={item}
                          pathname={location.pathname}
                          openMap={openMap}
                          onToggle={handleToggle}
                        />
                      ))}
                    </SidebarMenu>
                  )}
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </>
        )}

        {/* Admin Menu - Super Admin only */}
        {isSuperAdmin && (
          <SidebarGroup className={`py-0.5 ${showRegularMenus ? "mt-2 border-t border-border/30 pt-2" : ""}`}>
            <SidebarGroupContent>
              {collapsed ? (
                <div className="px-1 py-0.5">
                  <button
                    onClick={() => navigate("/app/admin")}
                    className={`relative w-10 h-10 mx-auto flex items-center justify-center rounded-lg transition-all duration-200 ${
                      isAdminActive
                        ? "text-primary bg-primary/[0.10]"
                        : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/40"
                    }`}
                    title="Administrador"
                  >
                    {isAdminActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-full bg-primary" />
                    )}
                    <DynamicIcon name="ShieldCheck" className="w-[18px] h-[18px]" />
                  </button>
                </div>
              ) : (
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/app/admin"
                        className={`relative flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-all duration-200 ${
                          isAdminActive
                            ? "text-primary font-medium bg-primary/[0.08]"
                            : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/40"
                        }`}
                        activeClassName=""
                      >
                        {isAdminActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full bg-primary" />
                        )}
                        <DynamicIcon
                          name="ShieldCheck"
                          className={`w-[15px] h-[15px] flex-shrink-0 ${isAdminActive ? "text-primary" : ""}`}
                        />
                        <span>Administrador</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

    </Sidebar>
  );
}
