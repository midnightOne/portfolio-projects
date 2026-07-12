"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  LayoutDashboard,
  Home,
  Globe,
  FolderOpen,
  FileText,
  Plus,
  Hash,
  Bot,
  Settings,
  DollarSign,
  Image,
  Grid3X3,
  Trash2,
  Terminal,
  BarChart3,
  User,
  ChevronRight,
  Loader2,
  Database,
  SlidersHorizontal,
  Shield,
  Bug,
  Mic,
  MessagesSquare,
  AudioLines,
  Activity,
  BookOpen,
  Workflow,
  Inbox,
  Droplets,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAdminProjects } from "@/hooks/use-admin-projects";

interface AdminNavItem {
  id: string;
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Match the pathname exactly instead of by prefix (for hub pages whose children live elsewhere in the nav). */
  exact?: boolean;
  /** Named count badge (H3: 'newLeads' — unreviewed ConversationLead rows, Req 15.2). */
  badge?: 'newLeads';
}

interface AdminNavGroup {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: AdminNavItem[];
  defaultExpanded?: boolean;
  /** Renders the dynamic per-project list after this group's items. */
  withProjectsList?: boolean;
}

/**
 * Navigation is grouped by admin task, not by URL prefix:
 * - Site Content / Media — what visitors see
 * - AI Assistant — how the assistant behaves (models, context, voice)
 * - Knowledge Base — what the assistant knows (semantic index)
 * - Access & Safety — who may use it and spend guardrails
 * - Insights — what actually happened (conversations, analytics, perf)
 * - Developer Tools — debug/testing surfaces
 */
const ADMIN_NAVIGATION: AdminNavGroup[] = [
  {
    id: "overview",
    title: "Overview",
    icon: LayoutDashboard,
    defaultExpanded: true,
    items: [
      { id: "dashboard", title: "Dashboard", href: "/admin", icon: Home, exact: true },
    ],
  },
  {
    id: "content",
    title: "Site Content",
    icon: FolderOpen,
    defaultExpanded: true,
    withProjectsList: true,
    items: [
      { id: "homepage", title: "Homepage", href: "/admin/homepage", icon: Globe },
      { id: "project-dashboard", title: "Project Dashboard", href: "/admin/projects", icon: LayoutDashboard, exact: true },
      { id: "new-project", title: "New Project", href: "/admin/projects/editor", icon: Plus, exact: true },
    ],
  },
  {
    id: "media",
    title: "Media",
    icon: Image,
    defaultExpanded: true,
    items: [
      { id: "media-library", title: "Media Library", href: "/admin/media/upload", icon: Grid3X3 },
      { id: "media-providers", title: "Storage Providers", href: "/admin/media/providers", icon: Database },
    ],
  },
  {
    id: "ai-assistant",
    title: "AI Assistant",
    icon: Bot,
    items: [
      { id: "ai-settings", title: "AI Settings", href: "/admin/ai", icon: Settings, exact: true },
      { id: "context-config", title: "Context Config", href: "/admin/ai/context-config", icon: SlidersHorizontal },
      { id: "content-sources", title: "Content Sources", href: "/admin/ai/content-sources", icon: FileText },
      { id: "voice-config", title: "Voice Config", href: "/admin/ai/voice-config", icon: Mic },
      { id: "voice-clips", title: "Voice Clips", href: "/admin/ai/voice-clips", icon: AudioLines },
      { id: "conversation-graphs", title: "Conversation Graphs", href: "/admin/ai/conversation-graphs", icon: Workflow },
    ],
  },
  {
    id: "knowledge-base",
    title: "Knowledge Base",
    icon: BookOpen,
    items: [
      { id: "semantic-dashboard", title: "Semantic Dashboard", href: "/admin/semantic", icon: LayoutDashboard, exact: true },
      { id: "semantic-config", title: "Chunking Configuration", href: "/admin/semantic/config", icon: SlidersHorizontal },
      { id: "semantic-budget", title: "Budget Manager", href: "/admin/semantic/budget", icon: DollarSign },
      { id: "semantic-bulk", title: "Bulk Operations", href: "/admin/semantic/bulk-operations", icon: Trash2 },
    ],
  },
  {
    id: "access-safety",
    title: "Access & Safety",
    icon: Shield,
    items: [
      { id: "access-spend", title: "Access & Spend", href: "/admin/ai/rate-limiting", icon: DollarSign },
      { id: "reflinks", title: "Reflinks", href: "/admin/ai/reflinks", icon: Hash },
      { id: "security", title: "Security", href: "/admin/ai/security", icon: Shield },
      { id: "abuse-detection", title: "Abuse Detection", href: "/admin/ai/abuse-detection", icon: Bot },
      { id: "safety-tripwire", title: "Safety Tripwire", href: "/admin/ai/safety", icon: Shield },
    ],
  },
  {
    id: "insights",
    title: "Insights & Monitoring",
    icon: BarChart3,
    items: [
      { id: "conversations", title: "Conversations", href: "/admin/ai/conversations", icon: MessagesSquare },
      { id: "leads", title: "Leads", href: "/admin/ai/leads", icon: Inbox, badge: "newLeads" },
      { id: "job-analysis", title: "Job Analyses", href: "/admin/ai/job-analysis", icon: BarChart3 },
      { id: "performance", title: "Performance", href: "/admin/performance", icon: Activity },
    ],
  },
  {
    id: "developer-tools",
    title: "Developer Tools",
    icon: Terminal,
    items: [
      { id: "ai-debug", title: "AI Debug & Test", href: "/admin/ai/debug", icon: Bug },
      { id: "tool-testing", title: "Tool Testing", href: "/admin/ai/tool-testing", icon: Terminal },
      { id: "voice-debug", title: "Voice Debug", href: "/admin/ai/voice-debug", icon: Mic },
      { id: "pill-visuals", title: "Pill Visuals", href: "/admin/ai/pill-visuals", icon: Droplets },
    ],
  },
];

function isItemActive(pathname: string, item: AdminNavItem): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

function groupHasActiveItem(pathname: string, group: AdminNavGroup): boolean {
  if (group.items.some((item) => isItemActive(pathname, item))) return true;
  return Boolean(group.withProjectsList && pathname.startsWith("/admin/projects/editor/"));
}

export function AdminSidebar() {
  const pathname = usePathname();
  const { projects, loading: projectsLoading } = useAdminProjects();
  const [projectsExpanded, setProjectsExpanded] = useState(false);
  // H3 (Req 15.2): unreviewed-leads badge — one lightweight count per admin
  // navigation (portfolio scale; stays current as triage happens on the page).
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Badge is optional chrome — any failure (offline, mocked fetch in
        // tests) silently leaves it hidden.
        const res = await fetch('/api/admin/ai/leads?countOnly=true');
        if (!res?.ok) return;
        const json = await res.json();
        if (!cancelled && json?.success) setNewLeadsCount(json.data?.newCount ?? 0);
      } catch {
        /* hidden badge */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);
  const badgeCounts: Record<string, number> = { newLeads: newLeadsCount };
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      ADMIN_NAVIGATION.map((group) => [
        group.id,
        Boolean(group.defaultExpanded) || groupHasActiveItem(pathname, group),
      ])
    )
  );

  // Keep the group owning the current route open across client-side navigation
  // (never auto-close groups the user opened themselves).
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const group of ADMIN_NAVIGATION) {
        if (!next[group.id] && groupHasActiveItem(pathname, group)) {
          next[group.id] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pathname]);

  const renderProjectsList = () => (
    <SidebarMenuItem>
      <Collapsible open={projectsExpanded} onOpenChange={setProjectsExpanded}>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className="w-full">
            <div className="flex items-center gap-2 w-full">
              <FileText className="size-4" />
              <span>All Projects</span>
              {!projectsLoading && projects.length > 0 && (
                <Badge variant="secondary" className="ml-auto mr-1 text-xs">
                  {projects.length}
                </Badge>
              )}
              <ChevronRight
                className={`size-4 ${projects.length > 0 ? "" : "ml-auto"} transition-transform ${
                  projectsExpanded ? "rotate-90" : ""
                }`}
              />
            </div>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {projectsLoading ? (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton className="flex items-center gap-2">
                  <Loader2 className="size-3 animate-spin" />
                  <span className="text-xs">Loading projects...</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ) : projects.length === 0 ? (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton className="text-xs text-muted-foreground">
                  No projects yet
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ) : (
              projects.map((project) => (
                <SidebarMenuSubItem key={project.id}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={pathname === `/admin/projects/editor/${project.id}`}
                  >
                    <Link
                      href={`/admin/projects/editor/${project.id}`}
                      className="flex items-center gap-2"
                      title={project.title}
                    >
                      <FileText className="size-3" />
                      <span className="truncate text-xs">{project.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))
            )}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <User className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">Admin Panel</span>
            <span className="truncate text-xs text-sidebar-foreground/70">Portfolio Management</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {ADMIN_NAVIGATION.map((group) => (
          <Collapsible
            key={group.id}
            open={openGroups[group.id]}
            onOpenChange={(open) =>
              setOpenGroups((prev) => ({ ...prev, [group.id]: open }))
            }
          >
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="group/collapsible flex w-full items-center gap-2">
                  <group.icon className="size-4" />
                  {group.title}
                  <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton asChild isActive={isItemActive(pathname, item)}>
                          <Link href={item.href} className="flex items-center gap-2">
                            <item.icon className="size-4" />
                            <span>{item.title}</span>
                            {item.badge && (badgeCounts[item.badge] ?? 0) > 0 && (
                              <Badge variant="secondary" className="ml-auto text-xs" data-testid={`nav-badge-${item.id}`}>
                                {badgeCounts[item.badge]}
                              </Badge>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                    {group.withProjectsList && renderProjectsList()}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center justify-between p-2">
          <div className="text-xs text-sidebar-foreground/70">
            Portfolio Admin v1.0
          </div>
          <ThemeToggle variant="button" size="sm" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
