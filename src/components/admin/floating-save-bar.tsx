'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Save, Loader2, Eye, EyeOff, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface FloatingSaveBarProps {
  visible: boolean;
  onToggleVisibility: () => void;
  saving: boolean;
  hasUnsavedChanges: boolean;
  lastSaveTime: Date | null;
  onSave: () => void;
  onBack: () => void;
  visibility: 'PUBLIC' | 'PRIVATE';
  onVisibilityChange: (visibility: 'PUBLIC' | 'PRIVATE') => void;
  error?: string | null;
}

export function FloatingSaveBar({
  visible,
  onToggleVisibility,
  saving,
  hasUnsavedChanges,
  lastSaveTime,
  onSave,
  onBack,
  visibility,
  onVisibilityChange,
  error
}: FloatingSaveBarProps) {
  const getSaveStatusText = () => {
    if (saving) return 'Saving...';
    if (!hasUnsavedChanges && lastSaveTime) {
      return `Saved ${formatDistanceToNow(lastSaveTime, { addSuffix: true })}`;
    }
    if (hasUnsavedChanges && lastSaveTime) {
      return `Last saved ${formatDistanceToNow(lastSaveTime, { addSuffix: true })}`;
    }
    if (hasUnsavedChanges) {
      return 'Unsaved changes';
    }
    return 'No changes';
  };

  const getSaveStatusColor = () => {
    if (saving) return 'text-blue-600';
    if (!hasUnsavedChanges) return 'text-green-600';
    return 'text-amber-600';
  };

  return (
    <Card className="shadow-sm border bg-white py-1">
      {visible ? (
        <div className="px-4 py-1.5">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Back button */}
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="flex items-center gap-2 h-8"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            {/* Center: Save status and controls */}
            <div className="flex items-center gap-4">
              {/* Save status */}
              <div className="text-center">
                <div className={`text-sm font-medium ${getSaveStatusColor()}`}>
                  {getSaveStatusText()}
                </div>
                {error && (
                  <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    {error}
                  </div>
                )}
              </div>

              {/* Visibility control */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  {visibility === 'PUBLIC' ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Visibility:</span>
                </div>
                <Select
                  value={visibility}
                  onValueChange={onVisibilityChange}
                  disabled={saving}
                >
                  <SelectTrigger className="w-24 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRIVATE">Private</SelectItem>
                    <SelectItem value="PUBLIC">Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Save button */}
              <Button
                onClick={onSave}
                disabled={saving || (!hasUnsavedChanges && lastSaveTime !== null)}
                size="sm"
                className="flex items-center gap-2 h-8"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
            </div>

            {/* Right: Collapse button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleVisibility}
              className="flex items-center gap-1 h-8 w-8 p-0"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="px-3 py-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleVisibility}
            className="flex items-center gap-2 h-7"
          >
            <ChevronDown className="h-4 w-4" />
            <span className="text-sm">
              {hasUnsavedChanges ? 'Unsaved changes' : 'Saved'}
            </span>
            {hasUnsavedChanges && (
              <div className="w-2 h-2 bg-amber-500 rounded-full" />
            )}
          </Button>
        </div>
      )}
    </Card>
  );
}