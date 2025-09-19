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

  const fetchConfig = async (retryCount = 0) => {
    try {
      setLoading(true);
      setError(null);
      
      // Try the public endpoint first for better reliability
      let response = await fetch('/api/homepage-config-public', {
        cache: 'no-cache',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      
      // If public endpoint fails, try admin endpoint (for authenticated users)
      if (!response.ok) {
        console.warn('Public homepage config endpoint failed, trying admin endpoint');
        response = await fetch('/api/admin/homepage/config', {
          cache: 'no-cache',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          }
        });
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch homepage configuration: ${response.statusText}`);
      }
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format - expected JSON');
      }
      
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError);
        throw new Error('Failed to parse response as JSON');
      }
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch homepage configuration');
      }
      
      setConfig(data.data.config);
    } catch (err) {
      console.error('Error fetching homepage config:', err);
      
      // Retry once if this is the first attempt
      if (retryCount === 0) {
        console.log('Retrying homepage config fetch...');
        setTimeout(() => fetchConfig(1), 1000);
        return;
      }
      
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