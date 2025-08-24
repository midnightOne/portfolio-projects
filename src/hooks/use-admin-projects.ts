"use client";

import { useState, useEffect } from 'react';

interface ProjectSummary {
  id: string;
  title: string;
  slug: string;
}

interface UseAdminProjectsReturn {
  projects: ProjectSummary[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAdminProjects(): UseAdminProjectsReturn {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/admin/projects/summary');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to fetch projects');
      }
      
      setProjects(data.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch projects';
      setError(errorMessage);
      console.error('Error fetching admin projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return {
    projects,
    loading,
    error,
    refetch: fetchProjects
  };
}