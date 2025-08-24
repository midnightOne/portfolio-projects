"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface ScrollToTopProps {
  showAfter?: number; // Show button after scrolling this many pixels
  className?: string;
  variant?: 'default' | 'minimal' | 'floating';
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getPositionClasses(position: string): string {
  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'bottom-center': 'bottom-6 left-1/2 transform -translate-x-1/2'
  };

  return positionClasses[position as keyof typeof positionClasses] || positionClasses['bottom-right'];
}

function getVariantClasses(variant: string): string {
  const variantClasses = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg',
    minimal: 'bg-background text-foreground border hover:bg-accent shadow-md',
    floating: 'bg-background/80 backdrop-blur-sm text-foreground border hover:bg-accent shadow-xl'
  };

  return variantClasses[variant as keyof typeof variantClasses] || variantClasses.default;
}

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const buttonVariants = {
  hidden: {
    opacity: 0,
    scale: 0.8,
    y: 20
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    y: 20,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  },
  hover: {
    scale: 1.1,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.46, 0.45, 0.94]
    }
  },
  tap: {
    scale: 0.95,
    transition: {
      duration: 0.1
    }
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ScrollToTop({
  showAfter = 300,
  className,
  variant = 'default',
  position = 'bottom-right'
}: ScrollToTopProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);

  // Handle scroll visibility
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      setIsVisible(scrollTop > showAfter);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial state

    return () => window.removeEventListener('scroll', handleScroll);
  }, [showAfter]);

  // Smooth scroll to top
  const scrollToTop = () => {
    setIsScrolling(true);
    
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

    // Reset scrolling state after animation
    setTimeout(() => {
      setIsScrolling(false);
    }, 1000);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          variants={buttonVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          whileHover="hover"
          whileTap="tap"
          className={cn(
            'fixed z-50',
            getPositionClasses(position),
            className
          )}
        >
          <Button
            onClick={scrollToTop}
            disabled={isScrolling}
            className={cn(
              'h-12 w-12 rounded-full p-0 transition-all duration-200',
              getVariantClasses(variant)
            )}
            aria-label="Scroll to top"
          >
            <motion.div
              animate={isScrolling ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            >
              <ChevronUp className="h-5 w-5" />
            </motion.div>
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

export const ScrollToTopPresets = {
  default: {
    variant: 'default' as const,
    position: 'bottom-right' as const,
    showAfter: 300
  },
  
  minimal: {
    variant: 'minimal' as const,
    position: 'bottom-right' as const,
    showAfter: 500
  },
  
  floating: {
    variant: 'floating' as const,
    position: 'bottom-center' as const,
    showAfter: 200
  }
} as const;