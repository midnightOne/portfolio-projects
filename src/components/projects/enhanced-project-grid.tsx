/**
 * Enhanced Project Grid - UI System
 * 
 * Enhanced ProjectGrid with AI control hooks and advanced animation capabilities.
 * Maintains backward compatibility while adding AI navigation and highlighting.
 */

"use client";

import React from 'react';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import { ProjectCard } from './project-card';
import { ProjectGridSkeleton } from './project-grid-skeleton';
import { EnhancedCard } from '@/components/ui/enhanced-card';
import type { ProjectWithRelations } from '@/lib/types/project';
import type { AIControlProps, NavigationCommand, HighlightOptions } from '@/lib/ui/types';

interface EnhancedProjectGridProps extends AIControlProps {
  projects: ProjectWithRelations[];
  loading: boolean;
  onProjectClick: (projectSlug: string) => void;
  showViewCount?: boolean;
  className?: string;
  searchQuery?: string;
  aiId?: string;
  animated?: boolean;
  animationType?: 'fade' | 'slide' | 'scale' | 'ipad-grid';
  selectedProjectId?: string; // For iPad-style animations
}

export function EnhancedProjectGrid({ 
  projects, 
  loading, 
  onProjectClick, 
  showViewCount = true,
  className,
  searchQuery = '',
  aiControlEnabled = false,
  aiId = 'project-grid',
  onAINavigate,
  onAIHighlight,
  animated = true,
  animationType = 'fade',
  selectedProjectId
}: EnhancedProjectGridProps) {
  const shouldReduceMotion = useReducedMotion();
  const [highlightedProjects, setHighlightedProjects] = React.useState<Set<string>>(new Set());

  // Handle AI navigation commands
  const handleAICommand = React.useCallback((command: NavigationCommand) => {
    if (onAINavigate) {
      onAINavigate(command);
    }
  }, [onAINavigate]);

  // Handle AI highlighting
  const handleAIHighlight = React.useCallback((projectId: string, options: HighlightOptions) => {
    setHighlightedProjects(prev => new Set(prev).add(projectId));
    
    if (onAIHighlight) {
      onAIHighlight(projectId, options);
    }

    // Auto-remove highlight if timed
    if (options.duration === 'timed' && options.timing) {
      setTimeout(() => {
        setHighlightedProjects(prev => {
          const newSet = new Set(prev);
          newSet.delete(projectId);
          return newSet;
        });
      }, options.timing);
    }
  }, [onAIHighlight]);

  // Enhanced project click handler
  const handleProjectClick = React.useCallback((projectSlug: string, projectId: string) => {
    onProjectClick(projectSlug);

    // Notify AI system of project selection
    if (aiControlEnabled && onAINavigate) {
      const command: NavigationCommand = {
        action: 'navigate',
        target: `project-${projectId}`,
        metadata: {
          source: 'user',
          timestamp: Date.now(),
          sessionId: 'current',
        },
      };
      handleAICommand(command);
    }
  }, [onProjectClick, aiControlEnabled, onAINavigate, handleAICommand]);

  // Animation variants based on type
  const getContainerVariants = (): Variants => {
    const baseVariants: Variants = {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: shouldReduceMotion ? 0 : 0.1,
          delayChildren: 0.2
        }
      }
    };

    if (animationType === 'ipad-grid' && selectedProjectId) {
      return {
        ...baseVariants,
        selecting: {
          opacity: 1,
          transition: {
            staggerChildren: 0.05,
            delayChildren: 0.1
          }
        }
      };
    }

    return baseVariants;
  };

  const getItemVariants = (projectId: string): Variants => {
    const baseVariants: Variants = {
      hidden: { 
        opacity: 0, 
        y: 30,
        scale: 0.9
      },
      visible: { 
        opacity: 1, 
        y: 0,
        scale: 1,
        transition: {
          duration: shouldReduceMotion ? 0.1 : 0.5,
          ease: [0.21, 1.11, 0.81, 0.99]
        }
      },
      exit: {
        opacity: 0,
        scale: 0.9,
        transition: {
          duration: 0.3
        }
      }
    };

    // iPad-style grid animation
    if (animationType === 'ipad-grid' && selectedProjectId) {
      if (projectId === selectedProjectId) {
        return {
          ...baseVariants,
          selected: {
            scale: 1.2,
            zIndex: 100,
            transition: {
              duration: 0.7,
              ease: [0.4, 0, 0.2, 1]
            }
          }
        };
      } else {
        // Other items animate away
        const direction = Math.random() > 0.5 ? 1 : -1;
        return {
          ...baseVariants,
          selecting: {
            x: direction * 200,
            opacity: 0,
            scale: 0.8,
            transition: {
              duration: 0.7,
              ease: [0.4, 0, 0.2, 1]
            }
          }
        };
      }
    }

    // AI highlighting variants
    if (highlightedProjects.has(projectId)) {
      return {
        ...baseVariants,
        highlighted: {
          scale: 1.05,
          boxShadow: "0 0 0 2px var(--primary)",
          transition: {
            duration: 0.3,
            ease: "easeOut"
          }
        }
      };
    }

    return baseVariants;
  };

  const emptyStateVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut"
      }
    }
  };

  if (loading) {
    return <ProjectGridSkeleton />;
  }

  if (projects.length === 0) {
    return (
      <motion.div 
        className="flex flex-col items-center justify-center py-16 text-center"
        variants={emptyStateVariants}
        initial="hidden"
        animate="visible"
        data-ai-id={`${aiId}-empty-state`}
      >
        <motion.div 
          className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 200, 
            damping: 15,
            delay: 0.2 
          }}
        >
          <svg
            className="w-8 h-8 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </motion.div>
        <motion.h3 
          className="text-lg font-semibold mb-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          No projects found
        </motion.h3>
        <motion.p 
          className="text-muted-foreground max-w-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Try adjusting your search terms or filters to find what you're looking for.
        </motion.p>
      </motion.div>
    );
  }

  // Add AI-specific attributes
  const aiAttributes = aiControlEnabled ? {
    'data-ai-controllable': 'true',
    'data-ai-id': aiId,
    'data-ai-type': 'project-grid',
  } : {};

  return (
    <motion.div 
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 ${className || ''}`}
      variants={getContainerVariants()}
      initial="hidden"
      animate={selectedProjectId && animationType === 'ipad-grid' ? "selecting" : "visible"}
      layout
      {...aiAttributes}
    >
      <AnimatePresence mode="popLayout">
        {projects.map((project, index) => {
          const isHighlighted = highlightedProjects.has(project.id);
          const isSelected = selectedProjectId === project.id;
          
          return (
            <motion.div
              key={project.id}
              variants={getItemVariants(project.id)}
              initial="hidden"
              animate={
                isSelected && animationType === 'ipad-grid' ? "selected" :
                isHighlighted ? "highlighted" :
                selectedProjectId && animationType === 'ipad-grid' ? "selecting" :
                "visible"
              }
              exit="exit"
              layout
              custom={index}
              layoutId={project.id}
              data-ai-id={`${aiId}-project-${project.id}`}
              data-ai-project-id={project.id}
              data-ai-project-slug={project.slug}
            >
              {/* Enhanced Project Card with AI capabilities */}
              <EnhancedCard
                className="h-full cursor-pointer transition-all duration-200 hover:shadow-lg"
                onClick={() => handleProjectClick(project.slug, project.id)}
                aiControlEnabled={aiControlEnabled}
                aiId={`${aiId}-card-${project.id}`}
                onAINavigate={onAINavigate}
                onAIHighlight={(options) => handleAIHighlight(project.id, options)}
                highlightable={true}
                animated={animated}
              >
                <ProjectCard
                  project={project}
                  onClick={() => handleProjectClick(project.slug, project.id)}
                  showViewCount={showViewCount}
                  searchQuery={searchQuery}
                />
              </EnhancedCard>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}

// Enhanced Project Grid with AI-specific features
export function AIProjectGrid(props: EnhancedProjectGridProps) {
  return (
    <EnhancedProjectGrid
      {...props}
      aiControlEnabled={true}
      animated={true}
      animationType="ipad-grid"
    />
  );
}

export type { EnhancedProjectGridProps };