"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WaveBackground } from '@/components/ui/wave-background/wave-background';
import { cn } from '@/lib/utils';
import { CONTAINERS, SPACING, FLEX } from '@/lib/constants/layout';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface HeroSectionProps {
  title: string;
  subtitle: string;
  description?: string;
  backgroundImage?: string;
  ctaText?: string;
  ctaLink?: string;
  theme?: 'default' | 'dark' | 'minimal' | 'colorful';
  showScrollIndicator?: boolean;
  enableWaveBackground?: boolean;
  className?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getThemeClasses(theme: string = 'default'): string {
  const themeClasses = {
    default: 'bg-gradient-to-br from-background to-muted text-foreground',
    dark: 'bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100',
    minimal: 'bg-white text-gray-900',
    colorful: 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 text-gray-900'
  };

  return themeClasses[theme as keyof typeof themeClasses] || themeClasses.default;
}

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94] as const
    }
  }
};

const scrollIndicatorVariants = {
  animate: {
    y: [0, 10, 0],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: [0.42, 0, 0.58, 1] as const
    }
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function HeroSection({
  title,
  subtitle,
  description,
  backgroundImage,
  ctaText,
  ctaLink,
  theme = 'default',
  showScrollIndicator = true,
  enableWaveBackground = true,
  className
}: HeroSectionProps) {
  const handleCtaClick = () => {
    if (ctaLink) {
      if (ctaLink.startsWith('#')) {
        // Smooth scroll to section
        const element = document.querySelector(ctaLink);
        element?.scrollIntoView({ behavior: 'smooth' });
      } else {
        // Navigate to page
        window.location.href = ctaLink;
      }
    }
  };

  const handleScrollIndicatorClick = () => {
    // Scroll to next section
    const heroElement = document.querySelector('[data-hero-section]');
    const nextElement = heroElement?.nextElementSibling;
    if (nextElement) {
      nextElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section
      data-hero-section
      className={cn(
        'relative min-h-screen flex items-center justify-center overflow-hidden',
        // Only apply theme classes if no wave background or background image
        !enableWaveBackground && !backgroundImage && getThemeClasses(theme),
        className
      )}
      style={
        backgroundImage
          ? {
              backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url(${backgroundImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundAttachment: 'fixed'
            }
          : undefined
      }
    >
      {/* Wave Background */}
      {enableWaveBackground && !backgroundImage && (
        <WaveBackground 
          className="absolute inset-0 -z-10"
          onError={(error) => console.warn('Wave background error:', error)}
        />
      )}

      {/* Fallback Background Pattern Overlay */}
      {!enableWaveBackground && !backgroundImage && (
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[length:20px_20px]" />
        </div>
      )}

      {/* Main Content */}
      <div className={cn(CONTAINERS.default, 'relative z-10 text-center')}>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-4xl mx-auto"
        >
          {/* Subtitle */}
          <motion.p
            variants={itemVariants}
            className="text-lg md:text-xl font-medium text-muted-foreground mb-4"
          >
            {subtitle}
          </motion.p>

          {/* Main Title */}
          <motion.h1
            variants={itemVariants}
            className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight"
          >
            {title}
          </motion.h1>

          {/* Description */}
          {description && (
            <motion.p
              variants={itemVariants}
              className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed"
            >
              {description}
            </motion.p>
          )}

          {/* Call to Action */}
          {ctaText && (
            <motion.div variants={itemVariants} className="mb-12">
              <Button
                size="lg"
                onClick={handleCtaClick}
                className="text-lg px-8 py-4 h-auto gap-3 group"
              >
                {ctaText}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      {showScrollIndicator && (
        <motion.button
          variants={scrollIndicatorVariants}
          animate="animate"
          onClick={handleScrollIndicatorClick}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
          aria-label="Scroll to next section"
        >
          <div className={cn(FLEX.colCenter, 'gap-2')}>
            <span className="text-sm font-medium">Scroll Down</span>
            <ChevronDown className="h-6 w-6 transition-transform group-hover:translate-y-1" />
          </div>
        </motion.button>
      )}
    </section>
  );
}

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

export const HeroSectionPresets = {
  default: {
    theme: 'default' as const,
    showScrollIndicator: true,
    ctaText: 'View My Work',
    ctaLink: '#projects'
  },
  
  minimal: {
    theme: 'minimal' as const,
    showScrollIndicator: false,
    ctaText: 'Explore Projects',
    ctaLink: '/projects'
  },
  
  colorful: {
    theme: 'colorful' as const,
    showScrollIndicator: true,
    ctaText: 'Get Started',
    ctaLink: '#about'
  }
} as const;