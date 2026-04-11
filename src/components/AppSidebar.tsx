import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { DynamicIcon } from "@/components/DynamicIcon";
import { useMenus, type MenuItem } from "@/hooks/useMenus";
import { ChevronRight, Zap } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

function MenuItemNode({
  item,
  collapsed,
  depth = 0,
  pathname,
  openMap,
  toggle,
}: {
  item: MenuItem;
  collapsed: boolean;
  depth?: number;
  pathname: string;
  openMap: Record<string, boolean>;
  toggle: (id: string) => void;
}) {
  if (!item.is_visible || !item.is_active) return null;

  const hasChildren = item.children && item.children.length > 0;
  const isOpen = openMap[item.id] ?? false;
  const isActive = item.route ? pathname === item.route : false;
  const isChildActive = item.children?.some(
    (c) => c.route === pathname || c.children?.some((cc) => cc.route === pathname)
  );

  // Group header (has children, no route)
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
              toggle={toggle}
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
              onClick={() => toggle(item.id)}
              className={`relative w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-all duration-200 text-muted-foreground/70 hover:text-foreground hover:bg-muted/40`}
              style={{ paddingLeft: `${12 + depth * 12}px` }}
            >
              <DynamicIcon
                name={item.icon}
                className="w-[15px] h-[15px] flex-shrink-0"
              />
              <span className="flex-1 text-left">{item.name}</span>
              <ChevronRight
                className={`w-3.5 h-3.5 text-muted-foreground/40 transition-transform duration-200 ${
                  isOpen ? "rotate-90" : ""
                }`}
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
                  toggle={toggle}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        )}
      </div>
    );
  }

  // Submenu with children AND route — show as expandable link
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
                <button onClick={() => toggle(item.id)} className="p-1">
                  <ChevronRight
                    className={`w-3 h-3 text-muted-foreground/30 transition-transform duration-200 ${
                      isOpen ? "rotate-90" : ""
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
                toggle={toggle}
              />
            ))}
          </SidebarMenu>
        )}
      </div>
    );
  }

  // Leaf item
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
  const { tree, isLoading } = useMenus();

  // Auto-open sections that contain the active route
  const findActiveIds = (items: MenuItem[], path: string): string[] => {
    for (const item of items) {
      if (item.route === path) return [item.id];
      if (item.children) {
        const found = findActiveIds(item.children, path);
        if (found.length) return [item.id, ...found];
      }
    }
    return [];
  };

  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  // Recalculate open state whenever route changes — only open ancestors of active route
  useEffect(() => {
    const ids = findActiveIds(tree, location.pathname);
    const map: Record<string, boolean> = {};
    ids.forEach((id) => (map[id] = true));
    setOpenMap(map);
  }, [location.pathname, tree]);

  const toggle = (id: string) => {
    setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
            <Zap className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold tracking-tight text-foreground">NexusOS</span>
          )}
        </div>
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
                {tree.map((item) => (
                  <MenuItemNode
                    key={item.id}
                    item={item}
                    collapsed={collapsed}
                    pathname={location.pathname}
                    openMap={openMap}
                    toggle={toggle}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
