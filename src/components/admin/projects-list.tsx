"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Search,
  ArrowLeft,
  Filter,
  Calendar,
  BarChart3
} from "lucide-react";

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
  tags: { id: string; name: string; }[];
}

interface ProjectsListResponse {
  projects: ProjectSummary[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export function AdminProjectsList() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<string>('all');
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
    hasMore: false
  });

  useEffect(() => {
    fetchProjects();
  }, [searchQuery, statusFilter, visibilityFilter, pagination.offset]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
      });

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (visibilityFilter !== 'all') {
        params.append('visibility', visibilityFilter);
      }

      const response = await fetch(`/api/admin/projects?${params}`);
      
      if (response.ok) {
        const data: ProjectsListResponse = await response.json();
        setProjects(data.projects);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Refresh the projects list
        fetchProjects();
      } else {
        alert('Failed to delete project');
      }
    } catch (error) {
      console.error('Delete project error:', error);
      alert('An error occurred while deleting the project');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    return status === 'PUBLISHED' ? 'default' : 'secondary';
  };

  // Filter projects based on search query (client-side for real-time feedback)
  const filteredProjects = projects.filter(project =>
    project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.tags.some(tag => tag.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <Button 
          variant="outline" 
          onClick={() => router.push('/admin')}
          className="flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Button>
        <Button 
          onClick={() => router.push('/admin/projects/new')}
          className="flex items-center gap-2"
        >
          <Plus size={16} />
          Create New Project
        </Button>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter size={20} />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Projects
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title or tags..."
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Visibility
              </label>
              <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Visibility</SelectItem>
                  <SelectItem value="PUBLIC">Public</SelectItem>
                  <SelectItem value="PRIVATE">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={fetchProjects}
                disabled={loading}
                className="w-full"
              >
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Projects List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>All Projects</CardTitle>
              <CardDescription>
                {loading ? 'Loading...' : `${pagination.total} total projects`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <BarChart3 size={16} />
              {filteredProjects.reduce((sum, p) => sum + p.viewCount, 0)} total views
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-gray-500">Loading projects...</p>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">
                {searchQuery ? 'No projects match your search' : 'No projects found'}
              </p>
              <Button onClick={() => router.push('/admin/projects/new')}>
                Create Your First Project
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProjects.map((project) => (
                <div 
                  key={project.id} 
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-lg">{project.title}</h3>
                      <Badge variant={getStatusColor(project.status)}>
                        {project.status}
                      </Badge>
                      {project.visibility === 'PRIVATE' && (
                        <Badge variant="outline">Private</Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                      <span className="flex items-center gap-1">
                        <Eye size={14} />
                        {project.viewCount} views
                      </span>
                      <span>{project.mediaCount} media files</span>
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        Updated {formatDate(project.updatedAt)}
                      </span>
                    </div>

                    {project.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {project.tags.map((tag) => (
                          <Badge key={tag.id} variant="outline" className="text-xs">
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                                         <Button 
                       size="sm" 
                       variant="outline"
                       onClick={() => router.push(`/projects?project=${project.slug}`)}
                       title="View project"
                     >
                       <Eye size={14} />
                     </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => router.push(`/admin/projects/${project.id}/edit`)}
                      title="Edit project"
                    >
                      <Edit size={14} />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleDeleteProject(project.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Delete project"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.hasMore && (
            <div className="flex justify-center mt-6">
              <Button 
                variant="outline"
                onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                disabled={loading}
              >
                Load More Projects
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 