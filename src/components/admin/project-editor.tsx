"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { X, Plus, Upload, Save, ArrowLeft } from "lucide-react";

interface ProjectData {
  title: string;
  description: string;
  briefOverview: string;
  tags: string[];
  status: 'DRAFT' | 'PUBLISHED';
  visibility: 'PUBLIC' | 'PRIVATE';
  workDate: string;
}

interface ProjectEditorProps {
  projectId?: string;
  initialData?: ProjectData;
}

export function ProjectEditor({ projectId, initialData }: ProjectEditorProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<ProjectData>(
    initialData || {
      title: '',
      description: '',
      briefOverview: '',
      tags: [],
      status: 'DRAFT',
      visibility: 'PRIVATE',
      workDate: new Date().toISOString().split('T')[0]
    }
  );
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!projectId;

  const handleInputChange = (field: keyof ProjectData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const validateForm = () => {
    if (!formData.title.trim()) {
      setError('Project title is required');
      return false;
    }
    if (!formData.description.trim()) {
      setError('Project description is required');
      return false;
    }
    setError('');
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      const url = isEditing ? `/api/admin/projects/${projectId}` : '/api/admin/projects';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save project');
      }

      const result = await response.json();
      
      // Redirect to project edit page or back to dashboard
      if (isEditing) {
        router.push('/admin');
      } else {
        router.push(`/admin/projects/${result.project.id}/edit`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/admin');
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <Button 
          variant="outline" 
          onClick={handleCancel}
          className="flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Button>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Save size={16} />
            {loading ? 'Saving...' : isEditing ? 'Update Project' : 'Create Project'}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
              <CardDescription>
                Basic details about your project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Title *
                </label>
                <Input
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter project title"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brief Overview
                </label>
                <Input
                  value={formData.briefOverview}
                  onChange={(e) => handleInputChange('briefOverview', e.target.value)}
                  placeholder="Short description for project cards"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This appears on project cards. Leave empty to auto-generate from description.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Detailed project description"
                  rows={6}
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Work Date
                </label>
                <Input
                  type="date"
                  value={formData.workDate}
                  onChange={(e) => handleInputChange('workDate', e.target.value)}
                  disabled={loading}
                />
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
              <CardDescription>
                Add tags to categorize your project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                                 <Input
                   value={newTag}
                   onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewTag(e.target.value)}
                   onKeyPress={handleKeyPress}
                  placeholder="Add a tag"
                  disabled={loading}
                />
                <Button 
                  onClick={handleAddTag}
                  disabled={loading || !newTag.trim()}
                  className="flex items-center gap-2"
                >
                  <Plus size={16} />
                  Add
                </Button>
              </div>

              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <Badge 
                      key={tag} 
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        disabled={loading}
                        className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                      >
                        <X size={12} />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Publication Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Publication</CardTitle>
              <CardDescription>
                Control how this project is displayed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <Select
                  value={formData.status}
                  onValueChange={(value: 'DRAFT' | 'PUBLISHED') => 
                    handleInputChange('status', value)
                  }
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="PUBLISHED">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visibility
                </label>
                <Select
                  value={formData.visibility}
                  onValueChange={(value: 'PUBLIC' | 'PRIVATE') => 
                    handleInputChange('visibility', value)
                  }
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRIVATE">Private</SelectItem>
                    <SelectItem value="PUBLIC">Public</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Private projects are only visible to you
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Media Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Media</CardTitle>
              <CardDescription>
                Upload images and videos for this project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full flex items-center gap-2"
                onClick={() => {
                  // We'll implement this after saving the project
                  if (isEditing) {
                    router.push(`/admin/projects/${projectId}/media`);
                  } else {
                    setError('Please save the project first before uploading media');
                  }
                }}
                disabled={loading}
              >
                <Upload size={16} />
                {isEditing ? 'Manage Media' : 'Save First to Upload Media'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 