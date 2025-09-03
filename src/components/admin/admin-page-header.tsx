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

interface BreadcrumbItem {
  title: string;
  href?: string;
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

export function AdminPageHeader() {
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
    </header>
  );
}