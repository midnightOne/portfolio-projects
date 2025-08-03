"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, FolderOpen, Image, BarChart, Settings } from "lucide-react";

interface AdminLayoutProps {
  children: React.ReactNode;
  currentTab?: string;
}

interface AdminTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

const ADMIN_TABS: AdminTab[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Settings,
    href: '/admin'
  },
  {
    id: 'ai-settings',
    label: 'AI Settings',
    icon: Brain,
    href: '/admin/ai'
  },
  // Future tabs - commented out for now but ready for implementation
  // {
  //   id: 'projects',
  //   label: 'Projects',
  //   icon: FolderOpen,
  //   href: '/admin/projects'
  // },
  // {
  //   id: 'media',
  //   label: 'Media',
  //   icon: Image,
  //   href: '/admin/media'
  // },
  // {
  //   id: 'analytics',
  //   label: 'Analytics',
  //   icon: BarChart,
  //   href: '/admin/analytics'
  // }
];

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, currentTab }) => {
  const router = useRouter();
  const pathname = usePathname();
  
  // Determine current tab from pathname if not explicitly provided
  const activeTab = currentTab || (() => {
    if (pathname === '/admin') return 'dashboard';
    if (pathname.startsWith('/admin/ai')) return 'ai-settings';
    if (pathname.startsWith('/admin/projects')) return 'projects';
    if (pathname.startsWith('/admin/media')) return 'media';
    if (pathname.startsWith('/admin/analytics')) return 'analytics';
    return 'dashboard';
  })();

  const handleTabChange = (value: string) => {
    const tab = ADMIN_TABS.find(t => t.id === value);
    if (tab && tab.href !== pathname) {
      router.push(tab.href);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Manage your portfolio projects and settings
        </p>
      </div>
      
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          {ADMIN_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-2"
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
        
        <TabsContent value={activeTab} className="mt-0">
          {children}
        </TabsContent>
      </Tabs>
    </div>
  );
};