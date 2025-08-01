'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface InlineEditableProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  error?: string;
  className?: string;
  onTextSelection?: (element: HTMLTextAreaElement | HTMLInputElement) => void;
}

export function InlineEditable({
  value,
  onChange,
  placeholder = '',
  multiline = false,
  rows = 3,
  maxLength,
  error,
  className = '',
  onTextSelection
}: InlineEditableProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleClick = () => {
    if (!isEditing) {
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setLocalValue(value); // Reset to original value
      setIsEditing(false);
    } else if (e.key === 'Enter' && !multiline) {
      handleBlur();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (!maxLength || newValue.length <= maxLength) {
      setLocalValue(newValue);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (onTextSelection && isEditing) {
      const element = e.target as HTMLInputElement | HTMLTextAreaElement;
      onTextSelection(element);
    }
  };

  // Auto-focus when entering edit mode
  useEffect(() => {
    if (isEditing) {
      const element = multiline ? textareaRef.current : inputRef.current;
      if (element) {
        element.focus();
        // Select all text for easy replacement
        element.select();
      }
    }
  }, [isEditing, multiline]);

  const displayValue = localValue || placeholder;
  const isEmpty = !localValue;

  if (isEditing) {
    const commonProps = {
      value: localValue,
      onChange: handleChange,
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
      onMouseUp: handleMouseUp,
      placeholder,
      className: cn(
        'border-2 border-blue-500 focus:border-blue-600',
        error && 'border-red-500 focus:border-red-600',
        className
      )
    };

    if (multiline) {
      return (
        <div className="space-y-1">
          <Textarea
            ref={textareaRef}
            rows={rows}
            {...commonProps}
          />
          {maxLength && (
            <div className="text-xs text-gray-500 text-right">
              {localValue.length}/{maxLength}
            </div>
          )}
          {error && (
            <div className="text-xs text-red-600">{error}</div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <Input
          ref={inputRef}
          {...commonProps}
        />
        {maxLength && (
          <div className="text-xs text-gray-500 text-right">
            {localValue.length}/{maxLength}
          </div>
        )}
        {error && (
          <div className="text-xs text-red-600">{error}</div>
        )}
      </div>
    );
  }

  // Display mode
  return (
    <div className="space-y-1">
      <div
        onClick={handleClick}
        className={cn(
          'cursor-text p-2 rounded-md border border-transparent hover:border-gray-300 hover:bg-gray-50 transition-colors flex items-start',
          multiline ? 'min-h-[4rem]' : 'min-h-[2.5rem] items-center',
          isEmpty && 'text-gray-400 italic',
          error && 'border-red-300 bg-red-50',
          className
        )}
      >
        {multiline ? (
          <div className="whitespace-pre-wrap w-full">
            {displayValue}
          </div>
        ) : (
          <span className="w-full">{displayValue}</span>
        )}
      </div>
      {error && (
        <div className="text-xs text-red-600">{error}</div>
      )}
    </div>
  );
}