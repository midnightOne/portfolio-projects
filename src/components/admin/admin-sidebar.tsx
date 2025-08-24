"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
      { id: 'dashboard', title: 'Dashboard', href: '/admin', icon: Home },
      { id: 'analytics', title: 'Analytics', href: '/admin/analytics', icon: BarChart3 }
    ]
  },
  {
    id: 'homepage',
    title: 'Homepage',
    icon: Globe,
    defaultExpanded: true,
    items: [
      { id: 'sections', title: 'Sections', href: '/admin/homepage', icon: Globe },
      { id: 'global-settings', title: 'Global Settings', href: '/admin/homepage/settings', icon: Settings }
    ]
  },
  {
    id: 'projects',
    title: 'Projects',
    icon: FolderOpen,
    items: [
      { id: 'all-projects', title: 'All Projects', href: '/admin/projects', icon: FileText },
      { id: 'new-project', title: 'New Project', href: '/admin/projects/editor', icon: Plus },
      { id: 'categories', title: 'Categories', href: '/admin/projects/categories', icon: Tag },
      { id: 'tags', title: 'Tags', href: '/admin/projects/tags', icon: Hash }
    ]
  },
  {
    id: 'ai-assistant',
    title: 'AI Assistant',
    icon: Bot,
    items: [
      { id: 'ai-settings', title: 'AI Settings', href: '/admin/ai', icon: Settings },
      { id: 'ai-usage', title: 'Usage & Costs', href: '/admin/ai/usage', icon: DollarSign },
      { id: 'ai-prompts', title: 'Custom Prompts', href: '/admin/ai/prompts', icon: MessageSquare }
    ]
  },
  {
    id: 'media',
    title: 'Media Library',
    icon: Image,
    items: [
      { id: 'all-media', title: 'All Media', href: '/admin/media', icon: Grid3X3 },
      { id: 'upload', title: 'Upload', href: '/admin/media/upload', icon: Upload },
      { id: 'unused', title: 'Unused Media', href: '/admin/media/unused', icon: Trash2, badge: 'cleanup' }
    ]
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: Settings,
    items: [
      { id: 'general', title: 'General', href: '/admin/settings/general', icon: Sliders },
      { id: 'seo', title: 'SEO & Meta', href: '/admin/settings/seo', icon: Search },
      { id: 'theme', title: 'Theme & UI', href: '/admin/settings/theme', icon: Palette },
      { id: 'advanced', title: 'Advanced', href: '/admin/settings/advanced', icon: Terminal }
    ]
  }
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const isItemActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  const isSectionActive = (section: AdminSection) => {
    return section.items.some(item => isItemActive(item.href));
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
        {ADMIN_NAVIGATION.map((section) => (
          <SidebarGroup key={section.id}>
            <SidebarGroupLabel className="flex items-center gap-2">
              <section.icon className="size-4" />
              {section.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isItemActive(item.href)}
                      onClick={() => router.push(item.href)}
                    >
                      <a href={item.href} className="flex items-center gap-2">
                        {item.icon && <item.icon className="size-4" />}
                        <span>{item.title}</span>
                        {item.badge && (
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="p-2 text-xs text-sidebar-foreground/70">
          Portfolio Admin v1.0
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}