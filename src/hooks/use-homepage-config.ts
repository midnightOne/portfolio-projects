"use client";

import { useState, useEffect } from 'react';
import type { HomepageConfig } from '@/components/homepage/section-renderer';

interface UseHomepageConfigResult {
  config: HomepageConfig | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useHomepageConfig(): UseHomepageConfigResult {
  const [config, setConfig] = useState<HomepageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try the admin endpoint first, fall back to public endpoint for testing
      let response = await fetch('/api/admin/homepage/config');
      
      // If admin endpoint fails (likely due to auth), try public endpoint
      if (!response.ok && response.status === 401) {
        response = await fetch('/api/homepage-config-public');
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch homepage configuration: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch homepage configuration');
      }
      
      setConfig(data.data.config);
    } catch (err) {
      console.error('Error fetching homepage config:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch homepage configuration');
      
      // Fallback to default configuration
      const defaultConfig: HomepageConfig = {
        sections: [
          {
            id: 'hero-main',
            type: 'hero',
            enabled: true,
            order: 1,
            config: {
              title: 'John Doe',
              subtitle: 'Full Stack Developer',
              description: 'Building digital experiences that make a difference.',
              theme: 'default',
              showScrollIndicator: true,
              ctaText: 'View My Work',
              ctaLink: '#projects'
            }
          },
          {
            id: 'about-main',
            type: 'about',
            enabled: true,
            order: 2,
            config: {
              content: 'I\'m a passionate developer with expertise in modern web technologies. I love creating solutions that are both functional and beautiful.',
              skills: ['React', 'TypeScript', 'Node.js', 'Python', 'PostgreSQL', 'Next.js'],
              showSkills: true,
              theme: 'default',
              layout: 'side-by-side'
            }
          },
          {
            id: 'projects-main',
            type: 'projects',
            enabled: true,
            order: 3,
            config: {
              variant: 'homepage',
              config: {
                maxItems: 6,
                layout: 'grid',
                columns: 3,
                showSearch: false,
                showFilters: false,
                showSorting: false,
                showViewToggle: false,
                theme: 'default',
                spacing: 'normal',
                openMode: 'modal',
                sortBy: 'date',
                title: 'Featured Projects',
                showViewCount: false
              }
            }
          },
          {
            id: 'contact-main',
            type: 'contact',
            enabled: true,
            order: 4,
            config: {
              title: 'Get In Touch',
              description: 'I\'m always interested in new opportunities and collaborations.',
              showContactForm: true,
              theme: 'default',
              socialLinks: []
            }
          }
        ],
        globalTheme: 'default',
        layout: 'standard'
      };
      
      setConfig(defaultConfig);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return {
    config,
    loading,
    error,
    refetch: fetchConfig
  };
}