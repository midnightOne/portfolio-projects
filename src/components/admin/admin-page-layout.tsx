"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface AdminPageLayoutProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  breadcrumbs?: BreadcrumbItem[];
}

export function AdminPageLayout({
  title,
  description,
  actions,
  children,
  className = "",
  breadcrumbs
}: AdminPageLayoutProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center space-x-1 text-sm text-muted-foreground">
          {breadcrumbs.map((item, index) => (
            <React.Fragment key={item.href}>
              {index === breadcrumbs.length - 1 ? (
                <span className="font-medium text-foreground">{item.label}</span>
              ) : (
                <>
                  <Link 
                    href={item.href} 
                    className="hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </Link>
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-2">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
}