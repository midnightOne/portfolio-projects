"use client";

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CONTAINERS, SPACING, GRID, FLEX } from '@/lib/constants/layout';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface AboutSectionProps {
  content: string;
  skills?: string[];
  showSkills?: boolean;
  profileImage?: string;
  theme?: 'default' | 'dark' | 'minimal' | 'colorful';
  layout?: 'side-by-side' | 'stacked' | 'image-first';
  className?: string;
}

export interface Skill {
  name: string;
  category?: string;
  level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  color?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getThemeClasses(theme: string = 'default'): string {
  const themeClasses = {
    default: 'bg-background text-foreground',
    dark: 'bg-slate-900 text-slate-100',
    minimal: 'bg-gray-50 text-gray-900',
    colorful: 'bg-gradient-to-br from-purple-50 to-blue-50 text-gray-900'
  };

  return themeClasses[theme as keyof typeof themeClasses] || themeClasses.default;
}

function parseSkills(skills: string[]): Skill[] {
  return skills.map(skill => {
    // Support for "skill:category" format
    if (skill.includes(':')) {
      const [name, category] = skill.split(':');
      return { name: name.trim(), category: category.trim() };
    }
    return { name: skill };
  });
}

function groupSkillsByCategory(skills: Skill[]): Record<string, Skill[]> {
  return skills.reduce((groups, skill) => {
    const category = skill.category || 'General';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(skill);
    return groups;
  }, {} as Record<string, Skill[]>);
}

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94] as const
    }
  }
};

const skillVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94] as const
    }
  }
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ProfileImageProps {
  src: string;
  alt: string;
  className?: string;
}

function ProfileImage({ src, alt, className }: ProfileImageProps) {
  return (
    <motion.div
      variants={itemVariants}
      className={cn('relative', className)}
    >
      <div className="relative w-64 h-64 mx-auto rounded-full overflow-hidden shadow-xl">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 256px, 256px"
          priority
        />
        {/* Decorative ring */}
        <div className="absolute inset-0 rounded-full ring-4 ring-primary/20 ring-offset-4 ring-offset-background" />
      </div>
    </motion.div>
  );
}

interface ContentProps {
  content: string;
  className?: string;
}

function Content({ content, className }: ContentProps) {
  return (
    <motion.div
      variants={itemVariants}
      className={cn('prose prose-lg max-w-none', className)}
    >
      {/* Split content by paragraphs and render with proper spacing */}
      {content.split('\n\n').map((paragraph, index) => (
        <p key={index} className="mb-4 leading-relaxed text-muted-foreground">
          {paragraph}
        </p>
      ))}
    </motion.div>
  );
}

interface SkillsDisplayProps {
  skills: string[];
  className?: string;
}

function SkillsDisplay({ skills, className }: SkillsDisplayProps) {
  const parsedSkills = parseSkills(skills);
  const groupedSkills = groupSkillsByCategory(parsedSkills);
  const categories = Object.keys(groupedSkills);

  if (categories.length === 1 && categories[0] === 'General') {
    // Simple skills list without categories
    return (
      <motion.div
        variants={itemVariants}
        className={cn('space-y-4', className)}
      >
        <h3 className="text-xl font-semibold mb-4">Skills & Technologies</h3>
        <div className="flex flex-wrap gap-2">
          {parsedSkills.map((skill, index) => (
            <motion.div
              key={skill.name}
              variants={skillVariants}
              custom={index}
            >
              <Badge
                variant="secondary"
                className="px-3 py-1 text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-colors cursor-default"
              >
                {skill.name}
              </Badge>
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  }

  // Categorized skills display
  return (
    <motion.div
      variants={itemVariants}
      className={cn('space-y-6', className)}
    >
      <h3 className="text-xl font-semibold mb-4">Skills & Technologies</h3>
      <div className="grid gap-6 md:grid-cols-2">
        {categories.map((category) => (
          <Card key={category} className="p-4">
            <CardContent className="p-0">
              <h4 className="font-medium mb-3 text-primary">{category}</h4>
              <div className="flex flex-wrap gap-2">
                {groupedSkills[category].map((skill, index) => (
                  <motion.div
                    key={skill.name}
                    variants={skillVariants}
                    custom={index}
                  >
                    <Badge
                      variant="outline"
                      className="text-xs hover:bg-primary hover:text-primary-foreground transition-colors cursor-default"
                      style={skill.color ? { borderColor: skill.color, color: skill.color } : undefined}
                    >
                      {skill.name}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AboutSection({
  content,
  skills = [],
  showSkills = true,
  profileImage,
  theme = 'default',
  layout = 'side-by-side',
  className
}: AboutSectionProps) {
  const hasSkills = showSkills && skills.length > 0;

  const renderContent = () => {
    switch (layout) {
      case 'image-first':
        return (
          <div className="space-y-12">
            {profileImage && (
              <ProfileImage src={profileImage} alt="Profile" />
            )}
            <div className="max-w-3xl mx-auto">
              <Content content={content} />
              {hasSkills && (
                <div className="mt-8">
                  <SkillsDisplay skills={skills} />
                </div>
              )}
            </div>
          </div>
        );

      case 'stacked':
        return (
          <div className="max-w-4xl mx-auto space-y-12">
            <div className={cn(GRID.twoCol, 'gap-12 items-center')}>
              {profileImage && (
                <ProfileImage src={profileImage} alt="Profile" />
              )}
              <Content content={content} />
            </div>
            {hasSkills && <SkillsDisplay skills={skills} />}
          </div>
        );

      case 'side-by-side':
      default:
        return (
          <div className="max-w-6xl mx-auto">
            <div className={cn(GRID.twoCol, 'gap-12 items-start')}>
              {/* Left Column: Image and Skills */}
              <div className="space-y-8">
                {profileImage && (
                  <ProfileImage src={profileImage} alt="Profile" />
                )}
                {hasSkills && <SkillsDisplay skills={skills} />}
              </div>

              {/* Right Column: Content */}
              <div className="space-y-6">
                <Content content={content} />
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <section
      className={cn(
        'relative',
        SPACING.section.xl,
        getThemeClasses(theme),
        className
      )}
    >
      <div className={CONTAINERS.default}>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* Section Header */}
          <motion.div
            variants={itemVariants}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">About Me</h2>
            <div className="w-24 h-1 bg-primary mx-auto rounded-full" />
          </motion.div>

          {/* Main Content */}
          {renderContent()}
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

export const AboutSectionPresets = {
  default: {
    theme: 'default' as const,
    layout: 'side-by-side' as const,
    showSkills: true
  },
  
  minimal: {
    theme: 'minimal' as const,
    layout: 'stacked' as const,
    showSkills: false
  },
  
  skillsFocused: {
    theme: 'default' as const,
    layout: 'image-first' as const,
    showSkills: true
  }
} as const;