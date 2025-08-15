"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ExternalLink, 
  Github, 
  Globe, 
  Play, 
  Code, 
  FileText, 
  Video, 
  Image, 
  Smartphone,
  Monitor,
  Link as LinkIcon,
  ArrowUpRight,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ExternalLink as ExternalLinkType } from '@/lib/types/project';

interface ExternalLinksProps {
  links: ExternalLinkType[];
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  showDescription?: boolean;
  layout?: 'vertical' | 'horizontal' | 'grid';
  inline?: boolean;
}

interface SingleExternalLinkProps {
  link: ExternalLinkType;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  showDescription?: boolean;
  inline?: boolean;
}

// Link type to icon mapping
const getLinkIcon = (url: string, label: string, icon?: string) => {
  // Use custom icon if provided
  if (icon) {
    // Map common icon names to components
    const iconMap: Record<string, any> = {
      github: Github,
      globe: Globe,
      play: Play,
      code: Code,
      file: FileText,
      video: Video,
      image: Image,
      mobile: Smartphone,
      desktop: Monitor,
      link: LinkIcon,
    };
    return iconMap[icon.toLowerCase()] || ExternalLink;
  }

  // Auto-detect based on URL and label
  const urlLower = url.toLowerCase();
  const labelLower = label.toLowerCase();

  if (urlLower.includes('github.com') || labelLower.includes('github') || labelLower.includes('source')) {
    return Github;
  }
  if (urlLower.includes('youtube.com') || urlLower.includes('vimeo.com') || labelLower.includes('demo') || labelLower.includes('video')) {
    return Play;
  }
  if (labelLower.includes('live') || labelLower.includes('demo') || labelLower.includes('preview')) {
    return Globe;
  }
  if (labelLower.includes('code') || labelLower.includes('repository') || labelLower.includes('repo')) {
    return Code;
  }
  if (labelLower.includes('documentation') || labelLower.includes('docs') || labelLower.includes('readme')) {
    return FileText;
  }
  if (labelLower.includes('app store') || labelLower.includes('play store') || labelLower.includes('mobile')) {
    return Smartphone;
  }
  if (labelLower.includes('download') || labelLower.includes('desktop')) {
    return Monitor;
  }

  return ExternalLink;
};

// Get link type for styling
const getLinkType = (url: string, label: string): string => {
  const urlLower = url.toLowerCase();
  const labelLower = label.toLowerCase();

  if (urlLower.includes('github.com') || labelLower.includes('github')) return 'github';
  if (urlLower.includes('youtube.com') || urlLower.includes('vimeo.com')) return 'video';
  if (labelLower.includes('live') || labelLower.includes('demo')) return 'demo';
  if (labelLower.includes('documentation') || labelLower.includes('docs')) return 'docs';
  
  return 'default';
};

// Get link type badge color
const getLinkTypeBadgeColor = (type: string): string => {
  switch (type) {
    case 'github':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    case 'video':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'demo':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'docs':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    default:
      return 'bg-primary/10 text-primary dark:bg-primary/20';
  }
};

// Link status checking (optional feature)
const useLinkStatus = (url: string) => {
  const [status, setStatus] = useState<'unknown' | 'checking' | 'valid' | 'invalid'>('unknown');

  const checkLink = async () => {
    setStatus('checking');
    try {
      // Note: This would require a backend endpoint due to CORS
      // For now, we'll just assume links are valid
      // const response = await fetch(`/api/check-link?url=${encodeURIComponent(url)}`);
      // setStatus(response.ok ? 'valid' : 'invalid');
      setStatus('valid');
    } catch {
      setStatus('invalid');
    }
  };

  return { status, checkLink };
};

// Single external link component
export function SingleExternalLink({
  link,
  variant = 'outline',
  size = 'default',
  className,
  showDescription = false,
  inline = false
}: SingleExternalLinkProps) {
  const LinkIcon = getLinkIcon(link.url, link.label, link.icon || undefined);
  const linkType = getLinkType(link.url, link.label);
  const { status, checkLink } = useLinkStatus(link.url);

  const handleClick = () => {
    window.open(link.url, '_blank', 'noopener,noreferrer');
  };

  if (inline) {
    return (
      <Button
        variant="link"
        size="sm"
        className={cn("h-auto p-0 text-primary hover:text-primary/80", className)}
        onClick={handleClick}
      >
        <LinkIcon className="h-3 w-3 mr-1" />
        {link.label}
        <ArrowUpRight className="h-3 w-3 ml-1" />
      </Button>
    );
  }

  if (showDescription && link.description) {
    return (
      <Card className={cn("transition-transform hover:scale-[1.02] cursor-pointer", className)} onClick={handleClick}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-muted rounded-lg">
              <LinkIcon className="h-5 w-5" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-sm truncate">
                  {link.label}
                </h4>
                <Badge 
                  variant="secondary" 
                  className={cn("text-xs", getLinkTypeBadgeColor(linkType))}
                >
                  {linkType.toUpperCase()}
                </Badge>
                {status !== 'unknown' && (
                  <div className="flex items-center">
                    {status === 'checking' && <Clock className="h-3 w-3 text-muted-foreground" />}
                    {status === 'valid' && <CheckCircle className="h-3 w-3 text-green-500" />}
                    {status === 'invalid' && <XCircle className="h-3 w-3 text-red-500" />}
                  </div>
                )}
              </div>
              
              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                {link.description}
              </p>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground truncate">
                  {new URL(link.url).hostname}
                </span>
                <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={cn("transition-transform hover:scale-[1.02] justify-start", className)}
      onClick={handleClick}
    >
      <LinkIcon className="h-4 w-4 mr-2" />
      <span className="truncate">{link.label}</span>
      <ArrowUpRight className="h-4 w-4 ml-auto flex-shrink-0" />
    </Button>
  );
}

// Multiple external links component
export function ExternalLinks({
  links,
  variant = 'outline',
  size = 'default',
  className,
  showDescription = false,
  layout = 'vertical',
  inline = false
}: ExternalLinksProps) {
  // Don't render if no links
  if (!links || links.length === 0) return null;

  // Sort links by order if available
  const sortedLinks = [...links].sort((a, b) => (a.order || 0) - (b.order || 0));

  if (inline) {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        {sortedLinks.map((link, index) => (
          <motion.div
            key={link.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.2 }}
          >
            <SingleExternalLink
              link={link}
              variant={variant}
              size={size}
              showDescription={showDescription}
              inline={inline}
            />
          </motion.div>
        ))}
      </div>
    );
  }

  const containerClasses = {
    vertical: "space-y-2",
    horizontal: "flex flex-wrap gap-2",
    grid: "grid grid-cols-1 sm:grid-cols-2 gap-2"
  };

  return (
    <div className={cn(containerClasses[layout], className)}>
      {sortedLinks.map((link, index) => (
        <motion.div
          key={link.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1, duration: 0.2 }}
        >
          <SingleExternalLink
            link={link}
            variant={variant}
            size={size}
            showDescription={showDescription}
            className={layout === 'horizontal' ? 'flex-shrink-0' : 'w-full'}
          />
        </motion.div>
      ))}
    </div>
  );
}

// Export both components
export { SingleExternalLink as ExternalLink };
export default ExternalLinks;