"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface BreadcrumbItem {
  title: string;
  href?: string;
}

interface SaveControlsProps {
  saving: boolean;
  hasUnsavedChanges: boolean;
  lastSaveTime: Date | null;
  onSave: () => void;
  onBack: () => void;
  visibility: 'PUBLIC' | 'PRIVATE';
  onVisibilityChange: (visibility: 'PUBLIC' | 'PRIVATE') => void;
  error?: string | null;
}

interface AdminPageHeaderProps {
  saveControls?: SaveControlsProps;
}

function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  // Always start with Admin
  breadcrumbs.push({ title: 'Admin', href: '/admin' });

  if (segments.length > 1) {
    // Map path segments to readable names
    const segmentMap: Record<string, string> = {
      'homepage': 'Homepage',
      'projects': 'Projects',
      'ai': 'AI Assistant',
      'media': 'Media Library',
      'settings': 'Settings',
      'editor': 'Editor',
      'new': 'New Project',
      'upload': 'Upload',
      'unused': 'Unused Media',
      'general': 'General',
      'seo': 'SEO & Meta',
      'theme': 'Theme & UI',
      'advanced': 'Advanced',
      'usage': 'Usage & Costs',
      'prompts': 'Custom Prompts',
      'categories': 'Categories',
      'tags': 'Tags',
      'analytics': 'Analytics'
    };

    for (let i = 1; i < segments.length; i++) {
      const segment = segments[i];
      const title = segmentMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
      const href = i === segments.length - 1 ? undefined : '/' + segments.slice(0, i + 1).join('/');
      
      breadcrumbs.push({ title, href });
    }
  }

  return breadcrumbs;
}

function SaveControls({
  saving,
  hasUnsavedChanges,
  lastSaveTime,
  onSave,
  onBack,
  visibility,
  onVisibilityChange,
  error
}: SaveControlsProps) {
  const getSaveStatusText = () => {
    if (saving) return 'Saving...';
    if (!hasUnsavedChanges && lastSaveTime) {
      return `Saved ${formatDistanceToNow(lastSaveTime, { addSuffix: true })}`;
    }
    if (hasUnsavedChanges && lastSaveTime) {
      return `Last saved ${formatDistanceToNow(lastSaveTime, { addSuffix: true })}`;
    }
    if (hasUnsavedChanges) {
      return 'Unsaved changes';
    }
    return 'No changes';
  };

  const getSaveStatusColor = () => {
    if (saving) return 'text-blue-600';
    if (!hasUnsavedChanges) return 'text-green-600';
    return 'text-amber-600';
  };

  return (
    <div className="flex items-center gap-3">
      {/* Back button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onBack}
        className="flex items-center gap-2 h-8"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Save status */}
      <div className="text-center">
        <div className={`text-sm font-medium ${getSaveStatusColor()}`}>
          {getSaveStatusText()}
        </div>
        {error && (
          <div className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3 w-3" />
            {error}
          </div>
        )}
      </div>

      {/* Visibility control */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-sm text-gray-600">
          {visibility === 'PUBLIC' ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Visibility:</span>
        </div>
        <Select
          value={visibility}
          onValueChange={onVisibilityChange}
          disabled={saving}
        >
          <SelectTrigger className="w-24 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PRIVATE">Private</SelectItem>
            <SelectItem value="PUBLIC">Public</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Save button */}
      <Button
        onClick={onSave}
        disabled={saving || (!hasUnsavedChanges && lastSaveTime !== null)}
        size="sm"
        className="flex items-center gap-2 h-8"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            Save
          </>
        )}
      </Button>
    </div>
  );
}

export function AdminPageHeader({ saveControls }: AdminPageHeaderProps) {
  const pathname = usePathname();
  const breadcrumbs = generateBreadcrumbs(pathname || '/admin');

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((item, index) => (
            <React.Fragment key={index}>
              <BreadcrumbItem>
                {item.href ? (
                  <BreadcrumbLink href={item.href}>
                    {item.title}
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{item.title}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      
      {/* Save controls on the right side */}
      {saveControls && (
        <>
          <div className="flex-1" /> {/* Spacer to push save controls to the right */}
          <SaveControls {...saveControls} />
        </>
      )}
    </header>
  );
}