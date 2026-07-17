'use client';

/**
 * Semantic Bulk Operations Component
 * 
 * Provides UI for bulk maintenance operations:
 * - Cleanup orphaned chunks
 * - Export/import semantic indexes
 * - Bulk regeneration with batch mode
 * - Bulk importance updates
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Trash2, 
  Download, 
  Upload, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Zap
} from 'lucide-react';

interface OrphanedChunk {
  id: string;
  chunkId: string;
  tier: number;
  title: string | null;
  tokenCount: number;
  createdAt: Date;
}

interface CleanupPreview {
  orphanedChunks: OrphanedChunk[];
  totalCount: number;
  estimatedSpaceFreed: string;
}

interface RegenerationEstimate {
  projectCount: number;
  totalChunks: number;
  estimatedTokens: number;
  estimatedCost: number;
  batchModeCost?: number;
  savings?: number;
  estimatedDuration: string;
  batchModeDuration?: string;
}

type BulkOperationTab = 'cleanup' | 'export' | 'import' | 'regenerate';

function isBulkOperationTab(value: string | null): value is BulkOperationTab {
  return value === 'cleanup' || value === 'export' || value === 'import' || value === 'regenerate';
}

export function SemanticBulkOperations() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<BulkOperationTab>(
    isBulkOperationTab(requestedTab) ? requestedTab : 'cleanup'
  );
  const [cleanupPreview, setCleanupPreview] = useState<CleanupPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [regenerationEstimate, setRegenerationEstimate] = useState<RegenerationEstimate | null>(null);
  const [useBatchMode, setUseBatchMode] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  useEffect(() => {
    if (isBulkOperationTab(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  // Cleanup Operations
  const loadCleanupPreview = async () => {
    setIsLoadingPreview(true);
    try {
      const response = await fetch('/api/admin/semantic/bulk/cleanup');
      const data = await response.json();
      setCleanupPreview(data);
    } catch (error) {
      console.error('Failed to load cleanup preview:', error);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const executeCleanup = async () => {
    if (!confirm(`Delete ${cleanupPreview?.totalCount} orphaned chunks?`)) return;

    setIsExecuting(true);
    try {
      const response = await fetch('/api/admin/semantic/bulk/cleanup', {
        method: 'POST'
      });
      const result = await response.json();
      alert(`Cleanup complete! Removed ${result.chunksRemoved} chunks, freed ${result.spaceFreed}`);
      setCleanupPreview(null);
    } catch (error) {
      console.error('Cleanup failed:', error);
      alert('Cleanup failed');
    } finally {
      setIsExecuting(false);
    }
  };

  // Export Operations
  const executeExport = async () => {
    setIsExecuting(true);
    try {
      const response = await fetch('/api/admin/semantic/bulk/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectIds: undefined }) // Export all
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `semantic-indexes-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed');
    } finally {
      setIsExecuting(false);
    }
  };

  // Import Operations
  const executeImport = async (validateOnly: boolean = false) => {
    if (!selectedFile) {
      alert('Please select a file to import');
      return;
    }

    setIsExecuting(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('overwriteExisting', 'false');
      formData.append('validateOnly', validateOnly.toString());

      const response = await fetch('/api/admin/semantic/bulk/import', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      setImportResult(result);

      if (!validateOnly) {
        alert(`Import complete! ${result.projectsImported} projects, ${result.chunksImported} chunks`);
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed');
    } finally {
      setIsExecuting(false);
    }
  };

  // Regeneration Operations
  const loadRegenerationEstimate = async () => {
    setIsLoadingPreview(true);
    try {
      const response = await fetch('/api/admin/semantic/bulk/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'estimate',
          useBatchMode,
          regenerateEmbeddings: true
        })
      });
      const data = await response.json();
      setRegenerationEstimate(data);
    } catch (error) {
      console.error('Failed to load estimate:', error);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const executeRegeneration = async () => {
    if (!regenerationEstimate) return;

    const cost = useBatchMode ? regenerationEstimate.batchModeCost : regenerationEstimate.estimatedCost;
    if (!confirm(`Execute bulk regeneration? Cost: $${cost?.toFixed(4)}`)) return;

    setIsExecuting(true);
    try {
      const response = await fetch('/api/admin/semantic/bulk/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          useBatchMode,
          regenerateEmbeddings: true
        })
      });
      const result = await response.json();

      if (useBatchMode && result.jobId) {
        alert(`Batch job submitted! Job ID: ${result.jobId}\nCheck status in 24 hours.`);
      } else {
        alert(`Regeneration complete! Processed ${result.chunksProcessed} chunks`);
      }
    } catch (error) {
      console.error('Regeneration failed:', error);
      alert('Regeneration failed');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('cleanup')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'cleanup'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Trash2 className="inline w-4 h-4 mr-2" />
          Cleanup
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'export'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Download className="inline w-4 h-4 mr-2" />
          Export
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'import'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Upload className="inline w-4 h-4 mr-2" />
          Import
        </button>
        <button
          onClick={() => setActiveTab('regenerate')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'regenerate'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <RefreshCw className="inline w-4 h-4 mr-2" />
          Regenerate
        </button>
      </div>

      {/* Cleanup Tab */}
      {activeTab === 'cleanup' && (
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Cleanup Orphaned Chunks</h3>
              <p className="text-sm text-muted-foreground">
                Remove chunks that no longer belong to any project
              </p>
            </div>

            {!cleanupPreview ? (
              <Button
                onClick={loadCleanupPreview}
                disabled={isLoadingPreview}
              >
                {isLoadingPreview ? 'Loading...' : 'Preview Cleanup'}
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{cleanupPreview.totalCount}</div>
                    <div className="text-sm text-muted-foreground">Orphaned Chunks</div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{cleanupPreview.estimatedSpaceFreed}</div>
                    <div className="text-sm text-muted-foreground">Space to Free</div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">
                      {cleanupPreview.orphanedChunks.filter(c => c.tier === 1).length}
                    </div>
                    <div className="text-sm text-muted-foreground">Tier 1 Chunks</div>
                  </div>
                </div>

                {cleanupPreview.orphanedChunks.length > 0 && (
                  <div className="max-h-64 overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="p-2 text-left">Chunk ID</th>
                          <th className="p-2 text-left">Tier</th>
                          <th className="p-2 text-left">Title</th>
                          <th className="p-2 text-right">Tokens</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cleanupPreview.orphanedChunks.slice(0, 50).map(chunk => (
                          <tr key={chunk.id} className="border-t">
                            <td className="p-2 font-mono text-xs">{chunk.chunkId.slice(0, 8)}</td>
                            <td className="p-2">
                              <Badge variant="outline">T{chunk.tier}</Badge>
                            </td>
                            <td className="p-2 truncate max-w-xs">{chunk.title || 'Untitled'}</td>
                            <td className="p-2 text-right">{chunk.tokenCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={executeCleanup}
                    disabled={isExecuting || cleanupPreview.totalCount === 0}
                    variant="destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isExecuting ? 'Cleaning...' : 'Execute Cleanup'}
                  </Button>
                  <Button
                    onClick={() => setCleanupPreview(null)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Export Semantic Indexes</h3>
              <p className="text-sm text-muted-foreground">
                Download all semantic indexes as a ZIP file for backup or migration
              </p>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 dark:text-blue-100">Export includes:</p>
                  <ul className="mt-1 space-y-1 text-blue-800 dark:text-blue-200">
                    <li>• All chunks with content and metadata</li>
                    <li>• Embeddings (if generated)</li>
                    <li>• Importance scores and manual edits</li>
                    <li>• Hierarchical relationships</li>
                  </ul>
                </div>
              </div>
            </div>

            <Button
              onClick={executeExport}
              disabled={isExecuting}
            >
              <Download className="w-4 h-4 mr-2" />
              {isExecuting ? 'Exporting...' : 'Export All Indexes'}
            </Button>
          </div>
        </Card>
      )}

      {/* Import Tab */}
      {activeTab === 'import' && (
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Import Semantic Indexes</h3>
              <p className="text-sm text-muted-foreground">
                Restore semantic indexes from a backup ZIP file
              </p>
            </div>

            <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div className="text-sm text-yellow-900 dark:text-yellow-100">
                  <p className="font-medium">Warning:</p>
                  <p className="mt-1">
                    Importing will skip existing projects by default. Use validation first to check for conflicts.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <input
                type="file"
                accept=".zip"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-muted-foreground
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90"
              />
            </div>

            {importResult && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium">Import Result</span>
                </div>
                <div className="text-sm space-y-1">
                  <p>Projects imported: {importResult.projectsImported}</p>
                  <p>Chunks imported: {importResult.chunksImported}</p>
                  <p>Conflicts: {importResult.conflicts?.length || 0}</p>
                  <p>Duration: {importResult.duration}ms</p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() => executeImport(true)}
                disabled={!selectedFile || isExecuting}
                variant="outline"
              >
                Validate Only
              </Button>
              <Button
                onClick={() => executeImport(false)}
                disabled={!selectedFile || isExecuting}
              >
                <Upload className="w-4 h-4 mr-2" />
                {isExecuting ? 'Importing...' : 'Import'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Regenerate Tab */}
      {activeTab === 'regenerate' && (
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Bulk Regeneration</h3>
              <p className="text-sm text-muted-foreground">
                Regenerate embeddings for all projects with cost optimization
              </p>
            </div>

            <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
              <input
                type="checkbox"
                id="batchMode"
                checked={useBatchMode}
                onChange={(e) => setUseBatchMode(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="batchMode" className="text-sm font-medium cursor-pointer">
                Use Batch Mode (50% cost savings, 24h processing)
              </label>
            </div>

            {!regenerationEstimate ? (
              <Button
                onClick={loadRegenerationEstimate}
                disabled={isLoadingPreview}
              >
                {isLoadingPreview ? 'Calculating...' : 'Calculate Estimate'}
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{regenerationEstimate.projectCount}</div>
                    <div className="text-sm text-muted-foreground">Projects</div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{regenerationEstimate.totalChunks}</div>
                    <div className="text-sm text-muted-foreground">Chunks</div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">
                      {regenerationEstimate.estimatedTokens.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">Tokens</div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">
                      ${(useBatchMode ? regenerationEstimate.batchModeCost : regenerationEstimate.estimatedCost)?.toFixed(4)}
                    </div>
                    <div className="text-sm text-muted-foreground">Cost</div>
                  </div>
                </div>

                {useBatchMode && regenerationEstimate.savings && (
                  <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <div>
                        <p className="font-medium text-green-900 dark:text-green-100">
                          Batch Mode Savings: ${regenerationEstimate.savings.toFixed(4)}
                        </p>
                        <p className="text-sm text-green-800 dark:text-green-200">
                          Processing time: {regenerationEstimate.batchModeDuration}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!useBatchMode && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <div>
                        <p className="font-medium text-blue-900 dark:text-blue-100">
                          Immediate Processing
                        </p>
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          Estimated time: {regenerationEstimate.estimatedDuration}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={executeRegeneration}
                    disabled={isExecuting}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {isExecuting ? 'Processing...' : 'Execute Regeneration'}
                  </Button>
                  <Button
                    onClick={() => setRegenerationEstimate(null)}
                    variant="outline"
                  >
                    Recalculate
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
