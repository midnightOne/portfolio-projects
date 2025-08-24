"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AdminFormProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-full'
};

export function AdminForm({
  title,
  description,
  children,
  actions,
  maxWidth = 'lg',
  className
}: AdminFormProps) {
  return (
    <Card className={cn('admin-form', maxWidthClasses[maxWidth], className)}>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        {children}
      </CardContent>
      {actions && (
        <CardFooter className="flex justify-end gap-2">
          {actions}
        </CardFooter>
      )}
    </Card>
  );
}