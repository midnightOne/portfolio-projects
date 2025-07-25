"use client";

import React from 'react';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import { ProjectCard } from './project-card';
import { ProjectGridSkeleton } from './project-grid-skeleton';
import type { ProjectWithRelations } from '@/lib/types/project';

interface ProjectGridProps {
  projects: ProjectWithRelations[];
  loading: boolean;
  onProjectClick: (projectId: string) => void;
  showViewCount?: boolean;
  className?: string;
}

export function ProjectGrid({ 
  projects, 
  loading, 
  onProjectClick, 
  showViewCount = true,
  className 
}: ProjectGridProps) {
  const shouldReduceMotion = useReducedMotion();

  // Animation variants
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants: Variants = {
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

  return (
    <motion.div 
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 ${className || ''}`}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      layout
    >
      <AnimatePresence mode="popLayout">
        {projects.map((project, index) => (
          <motion.div
            key={project.id}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            layout
            custom={index}
            layoutId={project.id}
          >
            <ProjectCard
              project={project}
              onClick={() => onProjectClick(project.id)}
              showViewCount={showViewCount}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}