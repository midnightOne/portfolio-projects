/**
 * Help Text Component
 * 
 * Provides contextual help, documentation links, and guidance
 */

'use client';

import React, { useState } from 'react';
import { HelpCircle, ExternalLink, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { Button } from './button';
import { Card, CardContent } from './card';
import { cn } from '@/lib/utils';

interface HelpTextProps {
  children: React.ReactNode;
  variant?: 'inline' | 'tooltip' | 'expandable' | 'card';
  className?: string;
}

export const HelpText: React.FC<HelpTextProps> = ({ 
  children, 
  variant = 'inline',
  className = '' 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (variant === 'inline') {
    return (
      <div className={cn('text-xs text-muted-foreground', className)}>
        {children}
      </div>
    );
  }

  if (variant === 'tooltip') {
    return (
      <div className={cn('group relative inline-block', className)}>
        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
          {children}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
    );
  }

  if (variant === 'expandable') {
    return (
      <div className={className}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-auto p-1 text-muted-foreground hover:text-foreground"
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 mr-1" />
          ) : (
            <ChevronRight className="h-3 w-3 mr-1" />
          )}
          <span className="text-xs">Help</span>
        </Button>
        
        {isExpanded && (
          <div className="mt-2 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
            {children}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <Card className={cn('border-blue-200 bg-blue-50/50', className)}>
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              {children}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};

interface DocumentationLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export const DocumentationLink: React.FC<DocumentationLinkProps> = ({
  href,
  children,
  className = ''
}) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 underline text-xs',
        className
      )}
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
};

interface HelpSectionProps {
  title: string;
  children: React.ReactNode;
  links?: Array<{
    label: string;
    href: string;
  }>;
  className?: string;
}

export const HelpSection: React.FC<HelpSectionProps> = ({
  title,
  children,
  links = [],
  className = ''
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="font-medium text-sm text-foreground">{title}</div>
      <div className="text-xs text-muted-foreground space-y-1">
        {children}
      </div>
      
      {links.length > 0 && (
        <div className="space-y-1">
          {links.map((link, index) => (
            <div key={index}>
              <DocumentationLink href={link.href}>
                {link.label}
              </DocumentationLink>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HelpText;