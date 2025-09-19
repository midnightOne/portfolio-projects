"use client";

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, X, Home, FolderOpen, User, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SimpleThemeToggle } from '@/components/ui/simple-theme-toggle';
import { cn } from '@/lib/utils';
import { CONTAINERS, FLEX, SPACING } from '@/lib/constants/layout';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  external?: boolean;
  description?: string;
}

export interface MainNavigationProps {
  items?: NavigationItem[];
  showLogo?: boolean;
  logoText?: string;
  logoHref?: string;
  className?: string;
  variant?: 'default' | 'minimal' | 'floating';
  position?: 'static' | 'sticky' | 'fixed';
}

// ============================================================================
// DEFAULT NAVIGATION ITEMS
// ============================================================================

const DEFAULT_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: 'home',
    label: 'Home',
    href: '/',
    icon: Home,
    description: 'Back to homepage'
  },
  {
    id: 'about',
    label: 'About',
    href: '#about',
    icon: User,
    description: 'Learn more about me'
  },
  {
    id: 'projects',
    label: 'Projects',
    href: '/projects',
    icon: FolderOpen,
    description: 'View all projects'
  },
  {
    id: 'contact',
    label: 'Contact',
    href: '#contact',
    icon: Mail,
    description: 'Get in touch'
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isActiveLink(href: string, pathname: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }
  
  if (href.startsWith('#')) {
    // For hash links, consider active if we're on the homepage
    return pathname === '/';
  }
  
  return pathname.startsWith(href);
}

function handleNavigation(href: string, router: any) {
  if (href.startsWith('#')) {
    // Smooth scroll to section
    const sectionId = href.substring(1);
    
    // If we're not on the homepage, navigate there first
    if (window.location.pathname !== '/') {
      router.push(`/${href}`);
      return;
    }
    
    // Find the section and scroll to it
    const element = document.querySelector(`[data-section-id="${sectionId}"]`) ||
                   document.querySelector(`#${sectionId}`) ||
                   document.querySelector(`[id*="${sectionId}"]`);
    
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  } else if (href.startsWith('http')) {
    // External link
    window.open(href, '_blank', 'noopener,noreferrer');
  } else {
    // Internal navigation
    router.push(href);
  }
}

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const mobileMenuVariants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: -20
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.2,
      staggerChildren: 0.05
    }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -20,
    transition: { duration: 0.15 }
  }
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface LogoProps {
  text: string;
  href: string;
  onClick: () => void;
}

function Logo({ text, href, onClick }: LogoProps) {
  return (
    <button
      onClick={onClick}
      className="text-xl font-bold text-foreground hover:text-primary transition-colors"
    >
      {text}
    </button>
  );
}

interface DesktopNavigationProps {
  items: NavigationItem[];
  pathname: string;
  onItemClick: (href: string) => void;
}

function DesktopNavigation({ items, pathname, onItemClick }: DesktopNavigationProps) {
  return (
    <nav className="hidden md:flex items-center space-x-8">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = isActiveLink(item.href, pathname);
        
        return (
          <button
            key={item.id}
            onClick={() => onItemClick(item.href)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200',
              'hover:bg-accent hover:text-accent-foreground',
              isActive && 'bg-accent text-accent-foreground'
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

interface MobileNavigationProps {
  items: NavigationItem[];
  pathname: string;
  isOpen: boolean;
  onItemClick: (href: string) => void;
  onClose: () => void;
}

function MobileNavigation({ items, pathname, isOpen, onItemClick, onClose }: MobileNavigationProps) {
  const handleItemClick = (href: string) => {
    onItemClick(href);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
            onClick={onClose}
          />
          
          {/* Mobile Menu */}
          <motion.div
            variants={mobileMenuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed top-16 left-4 right-4 bg-background border rounded-lg shadow-lg z-50 md:hidden"
          >
            <nav className="p-4">
              <div className="space-y-2">
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = isActiveLink(item.href, pathname);
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item.href)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-md text-left transition-all duration-200',
                        'hover:bg-accent hover:text-accent-foreground',
                        isActive && 'bg-accent text-accent-foreground'
                      )}
                    >
                      {Icon && <Icon className="h-5 w-5" />}
                      <div>
                        <div className="font-medium">{item.label}</div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
                
                {/* Theme Toggle in Mobile Menu */}
                <div className="px-4 py-3 border-t border-border mt-2 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Theme</span>
                    <SimpleThemeToggle size="sm" />
                  </div>
                </div>
              </div>
            </nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function MainNavigation({
  items = DEFAULT_NAVIGATION_ITEMS,
  showLogo = true,
  logoText = 'Portfolio',
  logoHref = '/',
  className,
  variant = 'default',
  position = 'sticky'
}: MainNavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle scroll effect for floating variant
  useEffect(() => {
    if (!mounted || (variant !== 'floating' && position !== 'sticky')) return;
    
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [variant, position, mounted]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Handle navigation clicks
  const handleNavigationClick = (href: string) => {
    handleNavigation(href, router);
  };

  const handleLogoClick = () => {
    handleNavigation(logoHref, router);
  };

  // Get position classes
  const getPositionClasses = () => {
    const baseClasses = 'top-0 left-0 right-0 z-30';
    
    switch (position) {
      case 'fixed':
        return `fixed ${baseClasses}`;
      case 'sticky':
        return `sticky ${baseClasses}`;
      default:
        return 'relative';
    }
  };

  // Get variant classes
  const getVariantClasses = () => {
    const baseClasses = 'border-b transition-all duration-300';
    
    switch (variant) {
      case 'floating':
        return cn(
          baseClasses,
          scrolled 
            ? 'bg-background/95 backdrop-blur-md shadow-md' 
            : 'bg-transparent border-transparent'
        );
      case 'minimal':
        return cn(baseClasses, 'bg-background/80 backdrop-blur-sm');
      default:
        return cn(
          baseClasses,
          scrolled && position !== 'static'
            ? 'bg-background/95 backdrop-blur-md shadow-sm'
            : 'bg-background'
        );
    }
  };

  return (
    <header
      className={cn(
        getPositionClasses(),
        getVariantClasses(),
        className
      )}
      suppressHydrationWarning
    >
      <div className={CONTAINERS.default}>
        <div className={cn(FLEX.between, 'h-16')}>
          {/* Logo */}
          {showLogo && (
            <Logo
              text={logoText}
              href={logoHref}
              onClick={handleLogoClick}
            />
          )}

          {/* Desktop Navigation */}
          <div className="flex items-center gap-4">
            <DesktopNavigation
              items={items}
              pathname={pathname}
              onItemClick={handleNavigationClick}
            />
            
            {/* Theme Toggle - Desktop */}
            <div className="hidden md:block">
              <SimpleThemeToggle size="md" />
            </div>
          </div>

          {/* Mobile Controls */}
          <div className="flex items-center gap-2 md:hidden">
            {/* Theme Toggle - Mobile */}
            <div>
              <SimpleThemeToggle size="sm" />
            </div>
            
            {/* Mobile Menu Button */}
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <MobileNavigation
        items={items}
        pathname={pathname}
        isOpen={mobileMenuOpen}
        onItemClick={handleNavigationClick}
        onClose={() => setMobileMenuOpen(false)}
      />
    </header>
  );
}

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

export const NavigationPresets = {
  default: {
    items: DEFAULT_NAVIGATION_ITEMS,
    showLogo: true,
    variant: 'default' as const,
    position: 'sticky' as const
  },
  
  minimal: {
    items: DEFAULT_NAVIGATION_ITEMS.filter(item => ['home', 'projects'].includes(item.id)),
    showLogo: true,
    variant: 'minimal' as const,
    position: 'sticky' as const
  },
  
  floating: {
    items: DEFAULT_NAVIGATION_ITEMS,
    showLogo: true,
    variant: 'floating' as const,
    position: 'fixed' as const
  }
} as const;