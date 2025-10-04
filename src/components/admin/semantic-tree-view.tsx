"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Layers,
  Hash,
  Database,
  CheckCircle,
  Clock,
  AlertCircle,
  Edit,
  Search,
  Loader2,
  ChevronsRight,
  ChevronsDown,
  Filter,
  X
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { SemanticChunkEditor } from "./semantic-chunk-editor";

interface TreeNode {
  chunkId: string;
  tier: number;
  title: string;
  contentPreview: string;
  tokenCount: number;
  importance: number;
  hasEmbedding: boolean;
  embeddingModel: string | null;
  embeddingGeneratedAt: Date | null;
  manuallyEdited: boolean;
  generationMode: string;
  modifiedBy: string;
  lastModified: Date;
  sectionGroup: string | null;
  parentChunkId: string | null;
  metadata: any;
  children: TreeNode[];
}

interface SemanticTreeViewProps {
  projectId: string;
}

export function SemanticTreeView({ projectId }: SemanticTreeViewProps) {
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedChunks, setSelectedChunks] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTier, setFilterTier] = useState<number | null>(null);
  const [filterEmbedding, setFilterEmbedding] = useState<'all' | 'has' | 'missing'>('all');
  const [editingChunkId, setEditingChunkId] = useState<string | null>(null);

  useEffect(() => {
    fetchTreeData();
  }, [projectId]);

  const fetchTreeData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/semantic/projects/${projectId}/tree`);
      if (!response.ok) throw new Error('Failed to fetch tree data');

      const data = await response.json();
      setTreeData(data);

      // Auto-expand T0 and T1 nodes
      const autoExpand = new Set<string>();
      if (data.tier === 0) autoExpand.add(data.chunkId);
      data.children?.forEach((child: TreeNode) => {
        if (child.tier === 1) autoExpand.add(child.chunkId);
      });
      setExpandedNodes(autoExpand);
    } catch (error) {
      console.error('Error fetching tree data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (chunkId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(chunkId)) {
        next.delete(chunkId);
      } else {
        next.add(chunkId);
      }
      return next;
    });
  };

  const toggleChunkSelection = (chunkId: string) => {
    setSelectedChunks(prev => {
      const next = new Set(prev);
      if (next.has(chunkId)) {
        next.delete(chunkId);
      } else {
        next.add(chunkId);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (node: TreeNode) => {
      allIds.add(node.chunkId);
      node.children.forEach(collectIds);
    };
    if (treeData) collectIds(treeData);
    setExpandedNodes(allIds);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const getTierIcon = (tier: number) => {
    switch (tier) {
      case 0: return <Database className="h-4 w-4 text-purple-600" />;
      case 1: return <FileText className="h-4 w-4 text-blue-600" />;
      case 2: return <Layers className="h-4 w-4 text-green-600" />;
      case 3: return <Hash className="h-4 w-4 text-orange-600" />;
      default: return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTierColor = (tier: number) => {
    switch (tier) {
      case 0: return 'bg-purple-100 text-purple-800 border-purple-300';
      case 1: return 'bg-blue-100 text-blue-800 border-blue-300';
      case 2: return 'bg-green-100 text-green-800 border-green-300';
      case 3: return 'bg-orange-100 text-orange-800 border-orange-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getEmbeddingStatusBadge = (node: TreeNode) => {
    if (!node.hasEmbedding) {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
          <AlertCircle className="h-3 w-3 mr-1" />
          No Embedding
        </Badge>
      );
    }

    // Check if outdated (more than 7 days old)
    if (node.embeddingGeneratedAt) {
      const daysSince = (Date.now() - new Date(node.embeddingGeneratedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > 7) {
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
            <Clock className="h-3 w-3 mr-1" />
            Outdated
          </Badge>
        );
      }
    }

    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
        <CheckCircle className="h-3 w-3 mr-1" />
        {node.embeddingModel || 'Embedded'}
      </Badge>
    );
  };

  const matchesFilter = (node: TreeNode): boolean => {
    // Tier filter
    if (filterTier !== null && node.tier !== filterTier) return false;

    // Embedding filter
    if (filterEmbedding === 'has' && !node.hasEmbedding) return false;
    if (filterEmbedding === 'missing' && node.hasEmbedding) return false;

    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        node.title.toLowerCase().includes(query) ||
        node.contentPreview.toLowerCase().includes(query) ||
        node.chunkId.toLowerCase().includes(query)
      );
    }

    return true;
  };

  const hasMatchingDescendant = (node: TreeNode): boolean => {
    if (matchesFilter(node)) return true;
    return node.children.some(hasMatchingDescendant);
  };

  const renderNode = (node: TreeNode, depth: number = 0): React.ReactElement | null => {
    const isExpanded = expandedNodes.has(node.chunkId);
    const isSelected = selectedChunks.has(node.chunkId);
    const hasChildren = node.children.length > 0;
    const matches = matchesFilter(node);
    const hasMatchingChild = hasMatchingDescendant(node);

    // Hide if doesn't match and has no matching descendants
    if (!matches && !hasMatchingChild) return null;

    return (
      <div key={node.chunkId} className="select-none">
        <div
          className={`
            flex items-start gap-2 p-3 rounded-lg border transition-colors relative
            ${isSelected ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'}
            ${matches ? 'opacity-100' : 'opacity-60'}
            ${editingChunkId === node.chunkId ? 'ring-2 ring-blue-500 z-10' : ''}
            hover:bg-gray-50 cursor-pointer
          `}
          style={{ marginLeft: `${depth * 24}px` }}
          onClick={() => setEditingChunkId(node.chunkId)}
        >
          {/* Expand/Collapse Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              hasChildren && toggleNode(node.chunkId);
            }}
            className={`flex-shrink-0 p-1 rounded hover:bg-gray-200 transition-colors ${
              !hasChildren ? 'invisible' : ''
            }`}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-600" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-600" />
            )}
          </button>

          {/* Selection Checkbox */}
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggleChunkSelection(node.chunkId)}
              className="mt-1"
            />
          </div>

          {/* Tier Icon */}
          <div className="flex-shrink-0 mt-1">
            {getTierIcon(node.tier)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className={`${getTierColor(node.tier)} border`}>
                T{node.tier}
              </Badge>
              <span className="font-medium text-sm truncate">{node.title}</span>
              {node.manuallyEdited && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                  <Edit className="h-3 w-3 mr-1" />
                  Edited
                </Badge>
              )}
              {getEmbeddingStatusBadge(node)}
            </div>

            <p className="text-xs text-gray-600 line-clamp-2 mb-2">
              {node.contentPreview}
            </p>

            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>{node.tokenCount} tokens</span>
              <span>Importance: {node.importance.toFixed(2)}</span>
              <span>Modified {formatDistanceToNow(new Date(node.lastModified), { addSuffix: true })}</span>
              {hasChildren && (
                <span className="text-blue-600 font-medium">
                  {node.children.length} {node.children.length === 1 ? 'child' : 'children'}
                </span>
              )}
            </div>
          </div>

        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div className="mt-2 space-y-1">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (!treeData) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load semantic tree. Please try refreshing the page.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex gap-4">
      {/* Tree Panel - Left Side */}
      <Card className={`transition-all duration-300 flex flex-col ${editingChunkId ? 'w-1/2' : 'w-full'}`}>
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Semantic Content Tree
              </CardTitle>
              <CardDescription>
                Hierarchical view of semantic chunks (T0 → T1 → T2 → T3)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={expandAll}
                className="flex items-center gap-1"
              >
                <ChevronsDown className="h-4 w-4" />
                Expand All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={collapseAll}
                className="flex items-center gap-1"
              >
                <ChevronsRight className="h-4 w-4" />
                Collapse All
              </Button>
            </div>
          </div>
        </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Filters and Search */}
        <div className="flex gap-2 mb-4 flex-shrink-0">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search chunks by title or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={filterTier === null ? 'all' : filterTier}
            onChange={(e) => setFilterTier(e.target.value === 'all' ? null : parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All Tiers</option>
            <option value="0">T0 Only</option>
            <option value="1">T1 Only</option>
            <option value="2">T2 Only</option>
            <option value="3">T3 Only</option>
          </select>
          <select
            value={filterEmbedding}
            onChange={(e) => setFilterEmbedding(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All Embeddings</option>
            <option value="has">Has Embedding</option>
            <option value="missing">Missing Embedding</option>
          </select>
        </div>

        {/* Selection Actions */}
        {selectedChunks.size > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between flex-shrink-0">
            <span className="text-sm font-medium text-blue-900">
              {selectedChunks.size} chunk{selectedChunks.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Bulk Edit
              </Button>
              <Button variant="outline" size="sm">
                Regenerate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedChunks(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          </div>
        )}

        {/* Tree - Scrollable */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-2">
          {renderNode(treeData)}
        </div>

        {/* Stats */}
        <div className="mt-4 pt-4 border-t border-gray-200 flex-shrink-0">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {treeData.tier === 0 ? 1 : 0}
              </div>
              <div className="text-xs text-gray-600">T0 Metadata</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {treeData.children.filter(c => c.tier === 1).length}
              </div>
              <div className="text-xs text-gray-600">T1 Summaries</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {(() => {
                  let count = 0;
                  const countT2 = (node: TreeNode) => {
                    if (node.tier === 2) count++;
                    node.children.forEach(countT2);
                  };
                  countT2(treeData);
                  return count;
                })()}
              </div>
              <div className="text-xs text-gray-600">T2 Headings</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {(() => {
                  let count = 0;
                  const countT3 = (node: TreeNode) => {
                    if (node.tier === 3) count++;
                    node.children.forEach(countT3);
                  };
                  countT3(treeData);
                  return count;
                })()}
              </div>
              <div className="text-xs text-gray-600">T3 Chunks</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

      {/* Editor Panel - Right Side */}
      {editingChunkId && (
        <Card className="w-1/2 flex flex-col">
          <CardHeader className="flex-shrink-0 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Edit Chunk
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingChunkId(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-6">
            <SemanticChunkEditor
              chunkId={editingChunkId}
              projectId={projectId}
              onClose={() => setEditingChunkId(null)}
              onSave={async (updatedChunk) => {
                // Save current expanded state
                const currentExpanded = new Set(expandedNodes);
                
                // Keep editor open, just refresh tree data
                try {
                  const response = await fetch(`/api/admin/semantic/projects/${projectId}/tree`);
                  if (response.ok) {
                    const data = await response.json();
                    setTreeData(data);
                    // Restore expanded state
                    setExpandedNodes(currentExpanded);
                  }
                } catch (error) {
                  console.error('Error refreshing tree:', error);
                }
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
