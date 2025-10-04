'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Save,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  Bot,
  Shield,
  Link as LinkIcon,
  Hash,
  Calendar,
  User
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { AIPromptInterface, AIPromptResult, TextSelection } from './ai-prompt-interface';
import { TextSelectionManager, TextareaAdapter } from './text-selection-manager';
import { useToast } from '@/components/ui/toast';

interface ChunkData {
  id: string;
  entityId: string;
  projectIndexId: string;
  chunkId: string;
  tier: number;
  title: string | null;
  content: string;
  tokenCount: number;
  parentChunkId: string | null;
  rootChunkId: string;
  sectionGroup: string | null;
  importance: number;
  importanceSource: 'ai' | 'manual';
  generationMode: 'system' | 'ai' | 'manual' | 'hybrid';
  lastModified: Date;
  modifiedBy: 'system' | 'ai' | 'user';
  manuallyEdited: boolean;
  embeddingModel: string | null;
  embeddingGeneratedAt: Date | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
  
  // Relationships
  parent: ChunkData | null;
  children: ChunkData[];
  siblings: ChunkData[];
}

interface SemanticChunkEditorProps {
  chunkId: string;
  projectId: string;
  onClose: () => void;
  onSave?: (chunk: ChunkData) => void;
}

export function SemanticChunkEditor({
  chunkId,
  projectId,
  onClose,
  onSave
}: SemanticChunkEditorProps) {
  const toast = useToast();
  const [chunk, setChunk] = useState<ChunkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [importance, setImportance] = useState(0.5);
  const [manuallyEdited, setManuallyEdited] = useState(false);
  
  // AI assistance state
  const [selectedText, setSelectedText] = useState<TextSelection | undefined>();
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  
  // Refs for text selection
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchChunkDetails();
  }, [chunkId]);

  useEffect(() => {
    if (chunk) {
      const changed =
        title !== (chunk.title || '') ||
        content !== chunk.content ||
        importance !== chunk.importance ||
        manuallyEdited !== chunk.manuallyEdited;
      
      setHasChanges(changed);
    }
  }, [title, content, importance, manuallyEdited, chunk]);

  const fetchChunkDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/admin/semantic/chunks/${chunkId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch chunk: ${response.status}`);
      }
      
      const data = await response.json();
      setChunk(data);
      
      // Initialize form state
      setTitle(data.title || '');
      setContent(data.content);
      setImportance(data.importance);
      setManuallyEdited(data.manuallyEdited);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chunk');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!chunk) return;
    
    try {
      setSaving(true);
      setError(null);
      
      const response = await fetch(`/api/admin/semantic/chunks/${chunkId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || null,
          content,
          importance,
          manuallyEdited
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save chunk: ${response.status}`);
      }
      
      const updatedChunk = await response.json();
      setChunk(updatedChunk);
      setHasChanges(false);
      
      // Show success notification
      toast.success("Changes saved", "Chunk has been updated successfully");
      
      if (onSave) {
        onSave(updatedChunk);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save chunk');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleTextSelection = (selection: TextSelection | null) => {
    setSelectedText(selection || undefined);
  };

  const handleApplyAIChanges = (result: AIPromptResult) => {
    if (!result.changes) return;
    
    // Apply full content replacement
    if (result.changes.fullContent) {
      setContent(result.changes.fullContent);
    }
    
    // Apply partial text replacement
    if (result.changes.partialUpdate) {
      const { start, end, newText } = result.changes.partialUpdate;
      const before = content.substring(0, start);
      const after = content.substring(end);
      setContent(before + newText + after);
    }
    
    // Apply title suggestion
    if (result.changes.suggestedTitle) {
      setTitle(result.changes.suggestedTitle);
    }
  };

  const getContentAdapter = () => {
    if (contentRef.current) {
      return new TextareaAdapter(contentRef.current, setContent);
    }
    return null;
  };

  const getTierBadgeColor = (tier: number) => {
    switch (tier) {
      case 0: return 'bg-purple-100 text-purple-800 border-purple-300';
      case 1: return 'bg-blue-100 text-blue-800 border-blue-300';
      case 2: return 'bg-green-100 text-green-800 border-green-300';
      case 3: return 'bg-orange-100 text-orange-800 border-orange-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getTierLabel = (tier: number) => {
    switch (tier) {
      case 0: return 'T0: Project Metadata';
      case 1: return 'T1: Project Summary';
      case 2: return 'T2: Section Summary';
      case 3: return 'T3: Content Chunk';
      default: return `T${tier}`;
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
            <p className="text-sm text-gray-600">Loading chunk details...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !chunk) {
    return (
      <Card className="w-full">
        <CardContent className="py-12">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="flex justify-center mt-4">
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!chunk) return null;

  return (
    <div className="space-y-4">
      {/* Header Info and Actions */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={getTierBadgeColor(chunk.tier)}>
              {getTierLabel(chunk.tier)}
            </Badge>
            <Badge variant="outline">
              <Hash className="h-3 w-3 mr-1" />
              {chunk.tokenCount} tokens
            </Badge>
            {chunk.manuallyEdited && (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                <Shield className="h-3 w-3 mr-1" />
                Manually Edited
              </Badge>
            )}
            {chunk.embeddingModel && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                <CheckCircle className="h-3 w-3 mr-1" />
                Has Embedding
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-1" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Content Editor - 2/3 width */}
        <div className="lg:col-span-2 space-y-4">
          {/* Title Field (if applicable) */}
          {chunk.tier !== 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter chunk title..."
                className="text-lg"
              />
            </div>
          )}

          {/* Content Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Content</label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAIAssistant(!showAIAssistant)}
              >
                <Bot className="h-4 w-4 mr-1" />
                {showAIAssistant ? 'Hide' : 'Show'} AI Assistant
              </Button>
            </div>
            <div>
              {getContentAdapter() ? (
                <TextSelectionManager
                  adapter={getContentAdapter()!}
                  onSelectionChange={handleTextSelection}
                >
                  <Textarea
                    ref={contentRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Enter chunk content..."
                    rows={15}
                    className="font-mono text-sm"
                  />
                </TextSelectionManager>
              ) : (
                <Textarea
                  ref={contentRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter chunk content..."
                  rows={15}
                  className="font-mono text-sm"
                />
              )}
              <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                <span>{content.length} characters</span>
                <span>~{Math.ceil(content.length / 4)} tokens</span>
              </div>
            </div>
          </div>

          {/* AI Assistant */}
          {showAIAssistant && (
            <AIPromptInterface
              selectedText={selectedText}
              projectContext={{
                title: chunk.title || '',
                description: '',
                existingTags: [],
                fullContent: content
              }}
              onApplyChanges={handleApplyAIChanges}
              onContentChange={setContent}
            />
          )}
        </div>

        {/* Sidebar - 1/3 width */}
        <div className="space-y-6">
          {/* Importance Score */}
          <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
            <h3 className="text-sm font-semibold">Importance Score</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Score</Label>
                  <span className="text-sm font-medium">{importance.toFixed(2)}</span>
                </div>
                <Slider
                  value={[importance]}
                  onValueChange={([value]) => setImportance(value)}
                  min={0}
                  max={1}
                  step={0.01}
                  className="w-full"
                />
                <p className="text-xs text-gray-500">
                  Higher scores appear more prominently in semantic search results
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="importance-source" className="text-sm">
                  Source: {chunk.importanceSource === 'ai' ? 'AI Generated' : 'Manual'}
                </Label>
                {importance !== chunk.importance && (
                  <Badge variant="outline" className="text-xs">
                    Modified
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Preservation Toggle */}
          <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Regeneration Protection
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="manually-edited" className="text-sm">
                  Preserve during regeneration
                </Label>
                <Switch
                  id="manually-edited"
                  checked={manuallyEdited}
                  onCheckedChange={setManuallyEdited}
                />
              </div>
              <p className="text-xs text-gray-500">
                When enabled, this chunk will not be automatically regenerated when content changes are detected
              </p>
            </div>
          </div>

          {/* Metadata */}
          <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
            <h3 className="text-sm font-semibold">Metadata</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <User className="h-4 w-4" />
                <span className="text-xs">Modified by: {chunk.modifiedBy}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="h-4 w-4" />
                <span className="text-xs">
                  Last modified: {formatDistanceToNow(new Date(chunk.lastModified), { addSuffix: true })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Bot className="h-4 w-4" />
                <span className="text-xs">Generation: {chunk.generationMode}</span>
              </div>
              {chunk.embeddingModel && (
                <div className="flex items-center gap-2 text-gray-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-xs">
                    Embedding: {chunk.embeddingModel}
                    {chunk.embeddingGeneratedAt && (
                      <> ({formatDistanceToNow(new Date(chunk.embeddingGeneratedAt), { addSuffix: true })})</>
                    )}
                  </span>
                </div>
              )}
              {chunk.sectionGroup && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Hash className="h-4 w-4" />
                  <span className="text-xs">Section: {chunk.sectionGroup}</span>
                </div>
              )}
            </div>
          </div>

          {/* Relationships */}
          <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              Relationships
            </h3>
            <div className="space-y-3 text-sm">
              {chunk.parent && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Parent</p>
                  <Badge variant="outline" className="text-xs">
                    T{chunk.parent.tier}: {chunk.parent.title || 'Untitled'}
                  </Badge>
                </div>
              )}
              
              {chunk.children.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">
                    Children ({chunk.children.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {chunk.children.slice(0, 3).map((child) => (
                      <Badge key={child.id} variant="outline" className="text-xs">
                        T{child.tier}
                      </Badge>
                    ))}
                    {chunk.children.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{chunk.children.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              
              {chunk.siblings.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">
                    Siblings ({chunk.siblings.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {chunk.siblings.slice(0, 3).map((sibling) => (
                      <Badge key={sibling.id} variant="outline" className="text-xs">
                        T{sibling.tier}
                      </Badge>
                    ))}
                    {chunk.siblings.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{chunk.siblings.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
