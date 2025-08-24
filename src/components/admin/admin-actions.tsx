"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminAction {
  label: string;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
}

interface AdminActionsProps {
  primary?: AdminAction;
  secondary?: AdminAction[];
  destructive?: AdminAction;
  alignment?: 'left' | 'right' | 'between' | 'center';
  className?: string;
}

const alignmentClasses = {
  left: 'justify-start',
  right: 'justify-end',
  between: 'justify-between',
  center: 'justify-center'
};

export function AdminActions({
  primary,
  secondary,
  destructive,
  alignment = 'right',
  className
}: AdminActionsProps) {
  return (
    <div className={cn(
      'admin-actions flex items-center gap-2',
      alignmentClasses[alignment],
      className
    )}>
      {destructive && (
        <Button
          variant="destructive"
          onClick={destructive.onClick}
          disabled={destructive.disabled || destructive.loading}
          className="mr-auto"
        >
          {destructive.loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            destructive.icon && <destructive.icon className="w-4 h-4 mr-2" />
          )}
          {destructive.label}
        </Button>
      )}
      
      <div className="flex items-center gap-2">
        {secondary?.map((action, index) => (
          <Button
            key={index}
            variant={action.variant || 'outline'}
            onClick={action.onClick}
            disabled={action.disabled || action.loading}
          >
            {action.loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              action.icon && <action.icon className="w-4 h-4 mr-2" />
            )}
            {action.label}
          </Button>
        ))}
        
        {primary && (
          <Button
            onClick={primary.onClick}
            disabled={primary.disabled || primary.loading}
            variant={primary.variant || 'default'}
          >
            {primary.loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              primary.icon && <primary.icon className="w-4 h-4 mr-2" />
            )}
            {primary.label}
          </Button>
        )}
      </div>
    </div>
  );
}