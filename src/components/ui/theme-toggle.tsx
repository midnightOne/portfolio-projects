'use client';

import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// import { useTheme } from '@/lib/ui/theme';
// Fallback theme hook for when enhanced theme system is not available
function useTheme() {
  const [theme, setThemeState] = React.useState<'light' | 'dark'>('light');
  const [systemTheme, setSystemTheme] = React.useState<'light' | 'dark'>('light');
  const [isAnimating, setIsAnimating] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const storedTheme = localStorage.getItem('portfolio-theme') as 'light' | 'dark' | null;
    const currentSystemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    
    setSystemTheme(currentSystemTheme);
    // Use stored theme if exists, otherwise use system preference
    const initialTheme = storedTheme || currentSystemTheme;
    setThemeState(initialTheme);
    
    // Apply theme
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(initialTheme);
    
    setMounted(true);
    
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      const newSystemTheme = e.matches ? 'dark' : 'light';
      setSystemTheme(newSystemTheme);
      
      // Only auto-update theme if no stored preference exists
      if (!localStorage.getItem('portfolio-theme')) {
        setThemeState(newSystemTheme);
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(newSystemTheme);
      }
    };
    
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, []);

  const setTheme = React.useCallback((newTheme: 'light' | 'dark') => {
    if (newTheme === theme || isAnimating) return;
    
    setIsAnimating(true);
    setThemeState(newTheme);
    localStorage.setItem('portfolio-theme', newTheme);
    
    // Apply theme
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(newTheme);
    
    setTimeout(() => setIsAnimating(false), 300);
  }, [theme, isAnimating]);

  const toggleTheme = React.useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }, [theme, setTheme]);

  return {
    theme,
    setTheme,
    toggleTheme,
    systemTheme,
    resolvedTheme: theme,
    isAnimating
  };
}
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface ThemeToggleProps {
  variant?: 'button' | 'dropdown' | 'icon-only';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
  align?: 'start' | 'center' | 'end';
}

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const iconVariants = {
  initial: { scale: 0, rotate: -180, opacity: 0 },
  animate: { 
    scale: 1, 
    rotate: 0, 
    opacity: 1,
    transition: { 
      type: 'spring' as const,
      stiffness: 200,
      damping: 15
    }
  },
  exit: { 
    scale: 0, 
    rotate: 180, 
    opacity: 0,
    transition: { duration: 0.15 }
  }
};

const buttonVariants = {
  hover: { scale: 1.05 },
  tap: { scale: 0.95 }
};

// ============================================================================
// THEME ICON COMPONENT
// ============================================================================

interface ThemeIconProps {
  theme: 'light' | 'dark';
  size?: number;
  className?: string;
}

function ThemeIcon({ theme, size = 16, className }: ThemeIconProps) {
  const iconClass = size === 14 ? 'h-3.5 w-3.5' : size === 16 ? 'h-4 w-4' : 'h-4.5 w-4.5';
  
  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      <AnimatePresence mode="wait">
        {theme === 'light' ? (
          <motion.div
            key="sun"
            variants={iconVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Sun className={iconClass} />
          </motion.div>
        ) : (
          <motion.div
            key="moon"
            variants={iconVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Moon className={iconClass} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// SIMPLE TOGGLE BUTTON
// ============================================================================

interface SimpleToggleProps {
  theme: 'light' | 'dark';
  onToggle: () => void;
  isAnimating: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

function SimpleToggle({ 
  theme, 
  onToggle, 
  isAnimating, 
  size = 'md', 
  showLabel = false,
  className 
}: SimpleToggleProps) {
  const sizeClasses = {
    sm: 'h-8 px-2',
    md: 'h-9 px-3',
    lg: 'h-10 px-4'
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18
  };

  return (
    <motion.div
      variants={buttonVariants}
      whileHover="hover"
      whileTap="tap"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        disabled={isAnimating}
        className={cn(
          'relative overflow-hidden transition-all duration-200',
          sizeClasses[size],
          isAnimating && 'opacity-50 cursor-not-allowed',
          className
        )}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      >
        <div className="flex items-center gap-2">
          <ThemeIcon 
            theme={theme} 
            size={iconSizes[size]}
          />
          {showLabel && (
            <span className="text-sm font-medium">
              {theme === 'light' ? 'Light' : 'Dark'}
            </span>
          )}
        </div>
        
        {/* Loading indicator */}
        {isAnimating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center bg-background/50"
          >
            <div className="h-3 w-3 animate-spin rounded-full border border-primary border-t-transparent" />
          </motion.div>
        )}
      </Button>
    </motion.div>
  );
}

// ============================================================================
// DROPDOWN TOGGLE
// ============================================================================

interface DropdownToggleProps {
  theme: 'light' | 'dark';
  systemTheme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  isAnimating: boolean;
  size?: 'sm' | 'md' | 'lg';
  align?: 'start' | 'center' | 'end';
  className?: string;
}

function DropdownToggle({ 
  theme, 
  systemTheme,
  onThemeChange, 
  isAnimating, 
  size = 'md',
  align = 'end',
  className 
}: DropdownToggleProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-9 w-9',
    lg: 'h-10 w-10'
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.div
          variants={buttonVariants}
          whileHover="hover"
          whileTap="tap"
        >
          <Button
            variant="ghost"
            size="sm"
            disabled={isAnimating}
            className={cn(
              'relative overflow-hidden transition-all duration-200',
              sizeClasses[size],
              isAnimating && 'opacity-50 cursor-not-allowed',
              className
            )}
            aria-label="Toggle theme"
          >
            <ThemeIcon 
              theme={theme} 
              size={iconSizes[size]}
            />
            
            {/* Loading indicator */}
            {isAnimating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 flex items-center justify-center bg-background/50"
              >
                <div className="h-3 w-3 animate-spin rounded-full border border-primary border-t-transparent" />
              </motion.div>
            )}
          </Button>
        </motion.div>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align={align} className="w-48">
        <DropdownMenuItem
          onClick={() => onThemeChange('light')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Sun className="h-4 w-4" />
          <span>Light</span>
          {theme === 'light' && (
            <div className="ml-auto h-2 w-2 rounded-full bg-primary" />
          )}
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={() => onThemeChange('dark')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Moon className="h-4 w-4" />
          <span>Dark</span>
          {theme === 'dark' && (
            <div className="ml-auto h-2 w-2 rounded-full bg-primary" />
          )}
        </DropdownMenuItem>
        
        <DropdownMenuItem className="flex items-center gap-2 text-muted-foreground">
          <Monitor className="h-4 w-4" />
          <span>System: {systemTheme}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ThemeToggle({
  variant = 'button',
  size = 'md',
  className,
  showLabel = false,
  align = 'end'
}: ThemeToggleProps) {
  const { theme, setTheme, toggleTheme, systemTheme, isAnimating } = useTheme();

  if (variant === 'dropdown') {
    return (
      <DropdownToggle
        theme={theme}
        systemTheme={systemTheme}
        onThemeChange={setTheme}
        isAnimating={isAnimating}
        size={size}
        align={align}
        className={className}
      />
    );
  }

  return (
    <SimpleToggle
      theme={theme}
      onToggle={toggleTheme}
      isAnimating={isAnimating}
      size={size}
      showLabel={showLabel && variant !== 'icon-only'}
      className={className}
    />
  );
}

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

export const ThemeTogglePresets = {
  // Simple icon button
  icon: {
    variant: 'button' as const,
    size: 'md' as const,
    showLabel: false
  },
  
  // Button with label
  labeled: {
    variant: 'button' as const,
    size: 'md' as const,
    showLabel: true
  },
  
  // Dropdown with options
  dropdown: {
    variant: 'dropdown' as const,
    size: 'md' as const,
    align: 'end' as const
  },
  
  // Small icon for compact spaces
  compact: {
    variant: 'button' as const,
    size: 'sm' as const,
    showLabel: false
  }
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function getThemeToggleProps(preset: keyof typeof ThemeTogglePresets) {
  return ThemeTogglePresets[preset];
}