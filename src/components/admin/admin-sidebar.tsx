"use client";

import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  SidebarSeparator,
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
  Tag,
  Hash,
  Bot,
  Settings,
  DollarSign,
  MessageSquare,
  Image,
  Grid3X3,
  Upload,
  Trash2,
  Sliders,
  Search,
  Palette,
  Terminal,
  BarChart3,
  User,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAdminProjects } from "@/hooks/use-admin-projects";

interface AdminSectionItem {
  id: string;
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

interface AdminSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: AdminSectionItem[];
  defaultExpanded?: boolean;
}

const ADMIN_NAVIGATION: AdminSection[] = [
  {
    id: 'overview',
    title: 'Overview',
    icon: LayoutDashboard,
    items: [
      { id: 'dashboard', title: 'Dashboard', href: '/admin', icon: Home }
    ]
  },
  {
    id: 'homepage',
    title: 'Homepage',
    icon: Globe,
    defaultExpanded: true,
    items: [
      { id: 'sections', title: 'Sections', href: '/admin/homepage', icon: Globe }
    ]
  },
  {
    id: 'ai-assistant',
    title: 'AI Assistant',
    icon: Bot,
    items: [
      { id: 'ai-settings', title: 'AI Settings', href: '/admin/ai', icon: Settings }
    ]
  },
  {
    id: 'media',
    title: 'Media Library',
    icon: Image,
    items: [
      { id: 'all-media', title: 'All Media', href: '/admin/media', icon: Grid3X3 },
      { id: 'upload', title: 'Upload', href: '/admin/media/upload', icon: Upload }
    ]
  }
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { projects, loading: projectsLoading } = useAdminProjects();
  const [projectsExpanded, setProjectsExpanded] = useState(false);

  const isItemActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  const isSectionActive = (section: AdminSection) => {
    return section.items.some(item => isItemActive(item.href));
  };

  const isProjectsActive = () => {
    return pathname.startsWith('/admin/projects');
  };

  const handleProjectClick = (projectId: string) => {
    router.push(`/admin/projects/editor/${projectId}`);
  };

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
        {/* Overview section */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <LayoutDashboard className="size-4" />
            Overview
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isItemActive('/admin')}
                  onClick={() => router.push('/admin')}
                >
                  <a href="/admin" className="flex items-center gap-2">
                    <Home className="size-4" />
                    <span>Dashboard</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Homepage section */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <Globe className="size-4" />
            Homepage
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isItemActive('/admin/homepage')}
                  onClick={() => router.push('/admin/homepage')}
                >
                  <a href="/admin/homepage" className="flex items-center gap-2">
                    <Globe className="size-4" />
                    <span>Homepage Config</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Projects section with special design - 3rd position */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <FolderOpen className="size-4" />
            Projects
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Project Dashboard - always visible */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isItemActive('/admin/projects') && !pathname.includes('/admin/projects/editor')}
                  onClick={() => router.push('/admin/projects')}
                >
                  <a href="/admin/projects" className="flex items-center gap-2">
                    <LayoutDashboard className="size-4" />
                    <span>Project Dashboard</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* New Project - always visible */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isItemActive('/admin/projects/editor') && !pathname.includes('/admin/projects/editor/')}
                >
                  <Link href="/admin/projects/editor" className="flex items-center gap-2">
                    <Plus className="size-4" />
                    <span>New Project</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Collapsible Projects List - only expands/collapses */}
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
                          className={`size-4 ${projects.length > 0 ? '' : 'ml-auto'} transition-transform ${
                            projectsExpanded ? 'rotate-90' : ''
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* AI Assistant section */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <Bot className="size-4" />
            AI Assistant
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isItemActive('/admin/ai') && !pathname.includes('/admin/ai/content-sources')}
                  onClick={() => router.push('/admin/ai')}
                >
                  <a href="/admin/ai" className="flex items-center gap-2">
                    <Settings className="size-4" />
                    <span>AI Settings</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isItemActive('/admin/ai/content-sources')}
                >
                  <Link href="/admin/ai/content-sources" className="flex items-center gap-2">
                    <FileText className="size-4" />
                    <span>Content Sources</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Media Library section */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <Image className="size-4" />
            Media Library
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isItemActive('/admin/media/upload')}
                  onClick={() => router.push('/admin/media/upload')}
                >
                  <a href="/admin/media/upload" className="flex items-center gap-2">
                    <Grid3X3 className="size-4" />
                    <span>Manage Media</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isItemActive('/admin/media/providers')}
                  onClick={() => router.push('/admin/media/providers')}
                >
                  <a href="/admin/media/providers" className="flex items-center gap-2">
                    <Settings className="size-4" />
                    <span>Media Storage Providers</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="p-2 text-xs text-sidebar-foreground/70">
          Portfolio Admin v1.0
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}