'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { TextSelection } from '@/lib/types/project';

interface InlineEditableProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  error?: string;
  className?: string;
  onTextSelection?: (selection: TextSelection | undefined) => void;
  // Enhanced validation
  required?: boolean;
  minLength?: number;
  pattern?: RegExp;
  customValidator?: (value: string) => string | null;
  // Display options
  displayMode?: 'inline' | 'block';
  showCharacterCount?: boolean;
  // Field identification for AI context
  fieldName?: string;
  // Auto-save functionality
  autoSave?: boolean;
  autoSaveDelay?: number;
  onAutoSave?: (value: string) => void;
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
  onTextSelection,
  required = false,
  minLength,
  pattern,
  customValidator,
  displayMode = 'block',
  showCharacterCount = false,
  fieldName,
  autoSave = false,
  autoSaveDelay = 1000,
  onAutoSave
}: InlineEditableProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value);
    setIsDirty(false);
    setValidationError(null);
  }, [value]);

  // Enhanced validation function
  const validateValue = useCallback((val: string): string | null => {
    if (required && !val.trim()) {
      return 'This field is required';
    }
    
    if (minLength && val.length < minLength) {
      return `Minimum length is ${minLength} characters`;
    }
    
    if (maxLength && val.length > maxLength) {
      return `Maximum length is ${maxLength} characters`;
    }
    
    if (pattern && !pattern.test(val)) {
      return 'Invalid format';
    }
    
    if (customValidator) {
      return customValidator(val);
    }
    
    return null;
  }, [required, minLength, maxLength, pattern, customValidator]);

  // Auto-save functionality
  useEffect(() => {
    if (autoSave && onAutoSave && isDirty && localValue !== value) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      autoSaveTimeoutRef.current = setTimeout(() => {
        const validationErr = validateValue(localValue);
        if (!validationErr) {
          onAutoSave(localValue);
          setIsDirty(false);
        }
      }, autoSaveDelay);
    }
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [localValue, value, isDirty, autoSave, onAutoSave, autoSaveDelay, validateValue]);

  const handleClick = () => {
    if (!isEditing) {
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    const validationErr = validateValue(localValue);
    setValidationError(validationErr);
    
    if (!validationErr && localValue !== value) {
      onChange(localValue);
      setIsDirty(false);
    }
    
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setLocalValue(value); // Reset to original value
      setValidationError(null);
      setIsDirty(false);
      setIsEditing(false);
    } else if (e.key === 'Enter' && !multiline) {
      handleBlur();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (!maxLength || newValue.length <= maxLength) {
      setLocalValue(newValue);
      setIsDirty(true);
      
      // Clear validation error when user starts typing
      if (validationError) {
        setValidationError(null);
      }
    }
  };

  // Enhanced text selection handling for AI integration
  const handleTextSelection = useCallback((e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement> | React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (onTextSelection && isEditing) {
      const element = e.target as HTMLInputElement | HTMLTextAreaElement;
      const start = element.selectionStart;
      const end = element.selectionEnd;
      
      if (start !== null && end !== null && start !== end) {
        const selectedText = element.value.substring(start, end);
        const contextLength = 200;
        const contextStart = Math.max(0, start - contextLength);
        const contextEnd = Math.min(element.value.length, end + contextLength);
        const context = element.value.substring(contextStart, contextEnd);
        
        onTextSelection({
          start,
          end,
          text: selectedText,
          context,
          field: fieldName
        });
      } else {
        onTextSelection(undefined);
      }
    }
  }, [onTextSelection, isEditing, fieldName]);

  const handleMouseUp = (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    handleTextSelection(e);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Handle text selection on keyboard navigation
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
      handleTextSelection(e);
    }
  };

  // Auto-focus when entering edit mode
  useEffect(() => {
    if (isEditing) {
      const element = multiline ? textareaRef.current : inputRef.current;
      if (element) {
        element.focus();
        // Position cursor at the end instead of selecting all text
        const length = element.value.length;
        element.setSelectionRange(length, length);
      }
    }
  }, [isEditing, multiline]);

  const displayValue = localValue || placeholder;
  const isEmpty = !localValue;
  const currentError = validationError || error;
  const showCharCount = showCharacterCount || maxLength;

  if (isEditing) {
    const commonProps = {
      value: localValue,
      onChange: handleChange,
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
      onKeyUp: handleKeyUp,
      onMouseUp: handleMouseUp,
      placeholder,
      className: cn(
        'border-2 border-blue-500 focus:border-blue-600 transition-colors',
        currentError && 'border-red-500 focus:border-red-600',
        isDirty && autoSave && 'ring-1 ring-blue-200',
        className
      )
    };

    if (multiline) {
      // Calculate dynamic rows based on content to match display height
      const contentLines = localValue.split('\n').length;
      const dynamicRows = Math.max(rows || 3, contentLines);
      
      return (
        <div className="space-y-1">
          <Textarea
            ref={textareaRef}
            rows={dynamicRows}
            {...commonProps}
            style={{ 
              minHeight: `${(rows || 3) * 1.5 + 1}rem`,
              resize: 'vertical'
            }}
          />
          <div className="flex justify-between items-center">
            {showCharCount && (
              <div className={cn(
                "text-xs",
                maxLength && localValue.length > maxLength * 0.9 
                  ? "text-orange-600" 
                  : "text-gray-500"
              )}>
                {localValue.length}{maxLength ? `/${maxLength}` : ''} characters
              </div>
            )}
            {isDirty && autoSave && (
              <div className="text-xs text-blue-600">
                Auto-saving...
              </div>
            )}
          </div>
          {currentError && (
            <div className="text-xs text-red-600 flex items-center gap-1">
              <span className="w-1 h-1 bg-red-600 rounded-full"></span>
              {currentError}
            </div>
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
        <div className="flex justify-between items-center">
          {showCharCount && (
            <div className={cn(
              "text-xs",
              maxLength && localValue.length > maxLength * 0.9 
                ? "text-orange-600" 
                : "text-gray-500"
            )}>
              {localValue.length}{maxLength ? `/${maxLength}` : ''} characters
            </div>
          )}
          {isDirty && autoSave && (
            <div className="text-xs text-blue-600">
              Auto-saving...
            </div>
          )}
        </div>
        {currentError && (
          <div className="text-xs text-red-600 flex items-center gap-1">
            <span className="w-1 h-1 bg-red-600 rounded-full"></span>
            {currentError}
          </div>
        )}
      </div>
    );
  }

  // Display mode - Enhanced to match public project view styling
  const displayModeClasses = displayMode === 'inline' 
    ? 'inline-flex items-center' 
    : 'flex items-start';

  // Calculate consistent height for multiline content to prevent jumping
  const getDisplayHeight = () => {
    if (!multiline) return undefined;
    
    // Estimate height based on content and rows
    const lineHeight = 1.5; // rem
    const padding = 1; // rem (0.5rem top + 0.5rem bottom)
    const minRows = Math.max(rows || 3, 3);
    
    // Count actual lines in content
    const contentLines = localValue ? localValue.split('\n').length : 1;
    const displayRows = Math.max(minRows, contentLines);
    
    return `${displayRows * lineHeight + padding}rem`;
  };

  return (
    <div className="space-y-1">
      <div
        onClick={handleClick}
        className={cn(
          'cursor-text p-2 rounded-md border border-transparent hover:border-gray-300 hover:bg-gray-50 transition-all duration-200',
          displayModeClasses,
          multiline ? 'min-h-[4rem]' : 'min-h-[2.5rem] items-center',
          isEmpty && 'text-gray-400 italic',
          currentError && 'border-red-300 bg-red-50',
          'group relative',
          className
        )}
        style={multiline ? { minHeight: getDisplayHeight() } : undefined}
      >
        {multiline ? (
          <div 
            className="whitespace-pre-wrap w-full leading-relaxed"
            style={{ minHeight: `${(rows || 3) * 1.5}rem` }}
          >
            {displayValue}
          </div>
        ) : (
          <span className="w-full truncate">{displayValue}</span>
        )}
        
        {/* Edit indicator on hover */}
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="text-xs text-gray-400 bg-white px-1 py-0.5 rounded shadow-sm border">
            Click to edit
          </div>
        </div>
      </div>
      
      {/* Status indicators */}
      <div className="flex justify-between items-center">
        {showCharCount && !isEmpty && (
          <div className="text-xs text-gray-400">
            {localValue.length} characters
          </div>
        )}
        {required && isEmpty && (
          <div className="text-xs text-orange-600">
            Required field
          </div>
        )}
      </div>
      
      {currentError && (
        <div className="text-xs text-red-600 flex items-center gap-1">
          <span className="w-1 h-1 bg-red-600 rounded-full"></span>
          {currentError}
        </div>
      )}
    </div>
  );
}