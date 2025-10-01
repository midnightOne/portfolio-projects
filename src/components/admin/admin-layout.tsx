"use client";

import React from "react";
import { usePathname } from "next/navigation";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
  SidebarRail,
} from "@/components/ui/sidebar";
import { AdminSidebar } from "./admin-sidebar";
import { AdminPageHeader } from "./admin-page-header";

interface SaveControlsProps {
  saving: boolean;
  hasUnsavedChanges: boolean;
  lastSaveTime: Date | null;
  onSave: () => void;
  onBack: () => void;
  status: 'DRAFT' | 'PUBLISHED';
  onStatusChange: (status: 'DRAFT' | 'PUBLISHED') => void;
  visibility: 'PUBLIC' | 'PRIVATE';
  onVisibilityChange: (visibility: 'PUBLIC' | 'PRIVATE') => void;
  error?: string | null;
}

interface AdminLayoutProps {
  children: React.ReactNode;
  saveControls?: SaveControlsProps;
}

export function AdminLayout({ children, saveControls }: AdminLayoutProps) {
  const pathname = usePathname();

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <AdminSidebar />
        <SidebarInset className="flex flex-1 flex-col">
          <AdminPageHeader saveControls={saveControls} />
          <main className="flex-1 p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
      <SidebarRail />
    </SidebarProvider>
  );
}