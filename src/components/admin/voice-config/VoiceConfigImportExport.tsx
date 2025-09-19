'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Download,
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { ButtonLoadingState } from '@/components/ui/loading-indicator';

interface VoiceConfigRecord {
  id: string;
  provider: 'openai' | 'elevenlabs';
  name: string;
  isDefault: boolean;
  configJson: string;
  createdAt: string;
  updatedAt: string;
}

interface VoiceConfigImportExportProps {
  configurations: VoiceConfigRecord[];
  onImportComplete: () => void;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  warnings: string[];
}

export function VoiceConfigImportExport({
  configurations,
  onImportComplete
}: VoiceConfigImportExportProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const handleExportAll = () => {
    try {
      const exportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        configurations: configurations.map(config => ({
          provider: config.provider,
          name: config.name,
          isDefault: config.isDefault,
          config: JSON.parse(config.configJson)
        }))
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voice-ai-configurations-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Export successful', `Exported ${configurations.length} configurations`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      toast.error('Export failed', errorMessage);
    }
  };

  const handleExportProvider = (provider: 'openai' | 'elevenlabs') => {
    try {
      const providerConfigs = configurations.filter(c => c.provider === provider);
      
      if (providerConfigs.length === 0) {
        toast.error('No configurations', `No ${provider} configurations to export`);
        return;
      }

      const exportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        provider,
        configurations: providerConfigs.map(config => ({
          provider: config.provider,
          name: config.name,
          isDefault: config.isDefault,
          config: JSON.parse(config.configJson)
        }))
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${provider}-configurations-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Export successful', `Exported ${providerConfigs.length} ${provider} configurations`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      toast.error('Export failed', errorMessage);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset file input
    event.target.value = '';

    if (!file.name.endsWith('.json')) {
      toast.error('Invalid file type', 'Please select a JSON file');
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      // Validate import data structure
      if (!importData.configurations || !Array.isArray(importData.configurations)) {
        throw new Error('Invalid file format: missing configurations array');
      }

      // Import configurations
      const response = await fetch('/api/admin/ai/voice-config/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Import failed');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Import failed');
      }

      setImportResult(result.data);
      setShowImportDialog(true);

      if (result.data.imported > 0) {
        onImportComplete();
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Import failed';
      toast.error('Import failed', errorMessage);
    } finally {
      setImporting(false);
    }
  };

  const closeImportDialog = () => {
    setShowImportDialog(false);
    setImportResult(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Import/Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleImportClick} disabled={importing}>
            <Upload className="h-4 w-4 mr-2" />
            {importing ? 'Importing...' : 'Import Configurations'}
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={handleExportAll} disabled={configurations.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export All ({configurations.length})
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => handleExportProvider('openai')} 
            disabled={configurations.filter(c => c.provider === 'openai').length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export OpenAI ({configurations.filter(c => c.provider === 'openai').length})
          </DropdownMenuItem>
          
          <DropdownMenuItem 
            onClick={() => handleExportProvider('elevenlabs')} 
            disabled={configurations.filter(c => c.provider === 'elevenlabs').length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export ElevenLabs ({configurations.filter(c => c.provider === 'elevenlabs').length})
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Import Result Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {importResult?.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              Import Results
            </DialogTitle>
            <DialogDescription>
              Configuration import has completed with the following results:
            </DialogDescription>
          </DialogHeader>

          {importResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {importResult.imported}
                  </div>
                  <div className="text-sm text-muted-foreground">Imported</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {importResult.skipped}
                  </div>
                  <div className="text-sm text-muted-foreground">Skipped</div>
                </div>
              </div>

              {/* Warnings */}
              {importResult.warnings.length > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-1">Warnings:</div>
                    <ul className="list-disc list-inside space-y-1">
                      {importResult.warnings.map((warning, index) => (
                        <li key={index} className="text-sm">{warning}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Errors */}
              {importResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-1">Errors:</div>
                    <ul className="list-disc list-inside space-y-1">
                      {importResult.errors.map((error, index) => (
                        <li key={index} className="text-sm">{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Success message */}
              {importResult.imported > 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Successfully imported {importResult.imported} configuration{importResult.imported !== 1 ? 's' : ''}.
                    {importResult.skipped > 0 && ` ${importResult.skipped} configuration${importResult.skipped !== 1 ? 's were' : ' was'} skipped (already exists).`}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={closeImportDialog}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}