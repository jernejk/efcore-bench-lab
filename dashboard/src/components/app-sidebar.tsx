"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Database,
  BarChart3,
  Settings,
  Home,
  Layers,
  ScrollText,
  Zap,
  RefreshCw,
  Ban,
  ListX,
  GitCompare,
  Bot,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const scenarioItems = [
  {
    title: "N+1 Problem",
    url: "/scenarios/nplusone",
    icon: Layers,
    description: "Multiple queries vs single query",
  },
  {
    title: "Pagination",
    url: "/scenarios/pagination",
    icon: ScrollText,
    description: "Offset vs keyset pagination",
  },
  {
    title: "Tracking",
    url: "/scenarios/tracking",
    icon: RefreshCw,
    description: "AsNoTracking and projections",
  },
  {
    title: "Bulk Updates",
    url: "/scenarios/updates",
    icon: Zap,
    description: "ExecuteUpdate vs traditional",
  },
  {
    title: "Cancellation",
    url: "/scenarios/cancellation",
    icon: Ban,
    description: "Cancellation tokens",
  },
  {
    title: "ToList Trap",
    url: "/scenarios/tolist",
    icon: ListX,
    description: "IQueryable vs IEnumerable",
  },
];

const toolItems = [
  {
    title: "Compare",
    url: "/compare",
    icon: GitCompare,
  },
  {
    title: "Benchmarks",
    url: "/benchmarks",
    icon: BarChart3,
  },
  {
    title: "AI Analysis",
    url: "/ai",
    icon: Bot,
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Database className="h-6 w-6 text-primary" />
          <span className="text-lg">EF Core Perf Lab</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/"}>
                  <Link href="/">
                    <Home />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Scenarios</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {scenarioItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.description}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {toolItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/settings"}>
              <Link href="/settings">
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

