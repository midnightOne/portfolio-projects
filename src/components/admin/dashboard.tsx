"use client";

import { useState, useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Upload, BarChart3, Edit, Trash2, Eye, Brain } from "lucide-react";

interface DashboardStats {
  totalProjects: number;
  publishedProjects: number;
  draftProjects: number;
  totalMediaFiles: number;
  totalViews: number;
}

interface ProjectSummary {
  id: string;
  title: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED';
  visibility: 'PUBLIC' | 'PRIVATE';
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  mediaCount: number;
}

export function AdminDashboard() {
  const { data: session } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    publishedProjects: 0,
    draftProjects: 0,
    totalMediaFiles: 0,
    totalViews: 0
  });
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch dashboard stats
      const statsResponse = await fetch('/api/admin/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Fetch recent projects
      const projectsResponse = await fetch('/api/admin/projects?limit=10');
      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json();
        setProjects(projectsData.projects || []);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: "/admin/login" });
  };

  const handleCreateProject = () => {
    router.push('/admin/projects/new');
  };

  const handleUploadMedia = () => {
    router.push('/admin/media/upload');
  };

  const handleEditProject = (projectId: string) => {
    router.push(`/admin/projects/${projectId}/edit`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with user info and sign out */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-muted-foreground">
            Welcome, {session?.user?.name}
          </span>
        </div>
        <Button onClick={handleSignOut} variant="outline">
          Sign Out
        </Button>
      </div>
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Projects</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{loading ? '-' : stats.totalProjects}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Published</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  {loading ? '-' : stats.publishedProjects}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Drafts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-yellow-600">
                  {loading ? '-' : stats.draftProjects}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Media Files</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-600">
                  {loading ? '-' : stats.totalMediaFiles}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Views</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-purple-600">
                  {loading ? '-' : stats.totalViews}
                </p>
              </CardContent>
            </Card>
      </div>

      {/* Quick Actions */}
      <div>
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Common administrative tasks
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-4">
                <Button onClick={handleCreateProject} className="flex items-center gap-2">
                  <Plus size={16} />
                  Create New Project
                </Button>
                <Button onClick={handleUploadMedia} variant="outline" className="flex items-center gap-2">
                  <Upload size={16} />
                  Upload Media
                </Button>
                <Button variant="outline" className="flex items-center gap-2">
                  <BarChart3 size={16} />
                  View Analytics
                </Button>
                <Button 
                  onClick={() => router.push('/admin/performance')} 
                  variant="outline" 
                  className="flex items-center gap-2"
                >
                  <BarChart3 size={16} />
                  Performance Dashboard
                </Button>
                <Button 
                  onClick={() => router.push('/admin/ai')} 
                  variant="outline" 
                  className="flex items-center gap-2"
                >
                  <Brain size={16} />
                  AI Settings
                </Button>
              </CardContent>
            </Card>
      </div>

      {/* Recent Projects */}
      <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Recent Projects</CardTitle>
                  <CardDescription>
                    Latest projects in your portfolio
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={() => router.push('/admin/projects')}>
                  View All Projects
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-gray-500">Loading projects...</p>
              ) : projects.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No projects yet</p>
                  <Button onClick={handleCreateProject}>
                    Create Your First Project
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {projects.map((project) => (
                    <div 
                      key={project.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium">{project.title}</h3>
                          <Badge 
                            variant={project.status === 'PUBLISHED' ? 'default' : 'secondary'}
                          >
                            {project.status}
                          </Badge>
                          {project.visibility === 'PRIVATE' && (
                            <Badge variant="outline">Private</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Eye size={14} />
                            {project.viewCount} views
                          </span>
                          <span>{project.mediaCount} media files</span>
                          <span>Updated {formatDate(project.updatedAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleEditProject(project.id)}
                        >
                          <Edit size={14} />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => router.push(`/projects?project=${project.slug}`)}
                        >
                          <Eye size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
    </div>
  );
}