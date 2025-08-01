'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Modular Tag interface - designed for extractability
export interface Tag {
  id: string;
  name: string;
  color?: string | null;
  createdAt?: Date;
  projectCount?: number;
}

// Modular SmartTagInput props - designed for reusability
export interface SmartTagInputProps {
  // Current tags (display only, not saved to DB until parent saves)
  value: string[];
  onChange: (tags: string[]) => void;
  
  // Existing tags for autocomplete
  existingTags: Tag[];
  
  // Configuration
  placeholder?: string;
  separators?: string[]; // [',', ';'] - default
  maxTags?: number;
  caseSensitive?: boolean; // default: false
  
  // Styling
  className?: string;
  error?: string;
  
  // Callbacks
  onTagCreate?: (tagName: string) => void; // Called when new tag is visually created
  onDuplicateAttempt?: (tagName: string) => void; // Called when duplicate is attempted
  
  // Advanced features
  showSuggestions?: boolean; // default: true
  maxSuggestions?: number; // default: 5
  animateDuplicates?: boolean; // default: true
}

// Internal state interface for better organization
interface TagInputState {
  inputValue: string;
  suggestions: Tag[];
  showSuggestions: boolean;
  selectedSuggestionIndex: number;
  duplicateAnimation: string | null;
  isComposing: boolean; // For IME support
}

// Modular tag behavior utilities - extractable
export class TagInputBehavior {
  // Visual feedback for duplicates with animation
  static highlightDuplicate(tagName: string, onAnimationEnd: () => void): void {
    // This will be handled by the component state
    setTimeout(onAnimationEnd, 600); // Animation duration
  }
  
  // Case-insensitive matching
  static findExistingTag(tagName: string, existingTags: Tag[], caseSensitive = false): Tag | null {
    const normalizedInput = caseSensitive ? tagName : tagName.toLowerCase();
    return existingTags.find(tag => 
      (caseSensitive ? tag.name : tag.name.toLowerCase()) === normalizedInput
    ) || null;
  }
  
  // Separator handling
  static processSeparators(input: string, separators: string[]): string[] {
    if (!separators.length) return [input];
    
    const regex = new RegExp(`[${separators.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('')}]`);
    return input
      .split(regex)
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
  }
  
  // Autocomplete matching with fuzzy search
  static getMatchingSuggestions(
    input: string, 
    existingTags: Tag[], 
    currentTags: string[],
    caseSensitive = false,
    maxSuggestions = 5
  ): Tag[] {
    if (!input.trim()) return [];
    
    const normalizedInput = caseSensitive ? input : input.toLowerCase();
    const normalizedCurrentTags = currentTags.map(tag => caseSensitive ? tag : tag.toLowerCase());
    
    return existingTags
      .filter(tag => {
        const normalizedTagName = caseSensitive ? tag.name : tag.name.toLowerCase();
        return (
          normalizedTagName.includes(normalizedInput) &&
          !normalizedCurrentTags.includes(normalizedTagName)
        );
      })
      .sort((a, b) => {
        const aName = caseSensitive ? a.name : a.name.toLowerCase();
        const bName = caseSensitive ? b.name : b.name.toLowerCase();
        
        // Exact matches first (case-insensitive comparison with input)
        const aExact = aName === normalizedInput;
        const bExact = bName === normalizedInput;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // Starts with matches next
        const aStarts = aName.startsWith(normalizedInput);
        const bStarts = bName.startsWith(normalizedInput);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // For "Script" input, prioritize tags ending with "Script" (like TypeScript)
        const aEnds = aName.endsWith(normalizedInput);
        const bEnds = bName.endsWith(normalizedInput);
        if (aEnds && !bEnds) return -1;
        if (!aEnds && bEnds) return 1;
        
        // Sort by project count (if available) then alphabetically
        if (a.projectCount !== undefined && b.projectCount !== undefined) {
          if (a.projectCount !== b.projectCount) {
            return b.projectCount - a.projectCount;
          }
        }
        
        return aName.localeCompare(bName);
      })
      .slice(0, maxSuggestions);
  }
}

export function SmartTagInput({
  value,
  onChange,
  existingTags,
  placeholder = 'Add tags (comma or semicolon separated)...',
  separators = [',', ';'],
  maxTags,
  caseSensitive = false,
  className = '',
  error,
  onTagCreate,
  onDuplicateAttempt,
  showSuggestions = true,
  maxSuggestions = 5,
  animateDuplicates = true
}: SmartTagInputProps) {
  const [state, setState] = useState<TagInputState>({
    inputValue: '',
    suggestions: [],
    showSuggestions: false,
    selectedSuggestionIndex: -1,
    duplicateAnimation: null,
    isComposing: false
  });
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update suggestions when input changes
  const updateSuggestions = useCallback((input: string) => {
    if (!showSuggestions || state.isComposing) {
      setState(prev => ({ ...prev, suggestions: [], showSuggestions: false }));
      return;
    }

    const suggestions = TagInputBehavior.getMatchingSuggestions(
      input,
      existingTags,
      value,
      caseSensitive,
      maxSuggestions
    );

    setState(prev => ({
      ...prev,
      suggestions,
      showSuggestions: suggestions.length > 0 && input.trim().length > 0,
      selectedSuggestionIndex: suggestions.length > 0 ? 0 : -1
    }));
  }, [existingTags, value, caseSensitive, maxSuggestions, showSuggestions, state.isComposing]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    // Check if any separator was typed
    const hasSeparator = separators.some(sep => newValue.includes(sep));
    
    if (hasSeparator && !state.isComposing) {
      // Process the input to extract tags
      const tags = TagInputBehavior.processSeparators(newValue, separators);
      
      // Add valid tags
      const newTags = [...value];
      
      tags.forEach(tag => {
        addTag(tag, newTags);
      });
      
      // Only call onChange once with all new tags
      onChange(newTags);
      
      setState(prev => ({ 
        ...prev, 
        inputValue: '', 
        showSuggestions: false,
        selectedSuggestionIndex: -1
      }));
    } else {
      setState(prev => ({ ...prev, inputValue: newValue }));
      updateSuggestions(newValue);
    }
  };

  // Add a single tag with validation
  const addTag = (tag: string, targetArray: string[] = value): boolean => {
    const trimmedTag = tag.trim();
    if (!trimmedTag) return false;

    const normalizedTag = caseSensitive ? trimmedTag : trimmedTag.toLowerCase();
    const existingNormalized = targetArray.map(t => caseSensitive ? t : t.toLowerCase());
    
    if (existingNormalized.includes(normalizedTag)) {
      // Handle duplicate with animation
      if (animateDuplicates) {
        setState(prev => ({ ...prev, duplicateAnimation: trimmedTag }));
        TagInputBehavior.highlightDuplicate(trimmedTag, () => {
          setState(prev => ({ ...prev, duplicateAnimation: null }));
        });
      }
      onDuplicateAttempt?.(trimmedTag);
      return false;
    }
    
    if (maxTags && targetArray.length >= maxTags) {
      return false;
    }
    
    targetArray.push(trimmedTag);
    onTagCreate?.(trimmedTag);
    return true;
  };

  // Handle keyboard navigation and actions
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (state.isComposing) return;

    const { suggestions, showSuggestions, selectedSuggestionIndex, inputValue } = state;

    switch (e.key) {
      case 'Tab':
        if (showSuggestions && suggestions.length > 0 && selectedSuggestionIndex >= 0) {
          e.preventDefault();
          const selectedTag = suggestions[selectedSuggestionIndex];
          const newTags = [...value];
          if (addTag(selectedTag.name, newTags)) {
            onChange(newTags);
          }
          setState(prev => ({ 
            ...prev, 
            inputValue: '', 
            showSuggestions: false,
            selectedSuggestionIndex: -1
          }));
        }
        break;

      case 'Enter':
        e.preventDefault();
        const newTags = [...value];
        let tagAdded = false;
        
        if (showSuggestions && selectedSuggestionIndex >= 0) {
          // Use selected suggestion
          const selectedTag = suggestions[selectedSuggestionIndex];
          tagAdded = addTag(selectedTag.name, newTags);
        } else if (inputValue.trim()) {
          // Add typed tag
          tagAdded = addTag(inputValue, newTags);
        }
        
        if (tagAdded) {
          onChange(newTags);
        }
        
        setState(prev => ({ 
          ...prev, 
          inputValue: '', 
          showSuggestions: false,
          selectedSuggestionIndex: -1
        }));
        break;

      case 'ArrowDown':
        if (showSuggestions && suggestions.length > 0) {
          e.preventDefault();
          setState(prev => ({
            ...prev,
            selectedSuggestionIndex: Math.min(selectedSuggestionIndex + 1, suggestions.length - 1)
          }));
        }
        break;

      case 'ArrowUp':
        if (showSuggestions && suggestions.length > 0) {
          e.preventDefault();
          setState(prev => ({
            ...prev,
            selectedSuggestionIndex: Math.max(selectedSuggestionIndex - 1, 0)
          }));
        }
        break;

      case 'Escape':
        setState(prev => ({ 
          ...prev, 
          showSuggestions: false,
          selectedSuggestionIndex: -1
        }));
        break;

      case 'Backspace':
        if (!inputValue && value.length > 0) {
          // Remove last tag when backspace is pressed on empty input
          onChange(value.slice(0, -1));
        }
        break;
    }
  };

  // Handle IME composition events
  const handleCompositionStart = () => {
    setState(prev => ({ ...prev, isComposing: true }));
  };

  const handleCompositionEnd = () => {
    setState(prev => ({ ...prev, isComposing: false }));
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: Tag) => {
    const newTags = [...value];
    if (addTag(suggestion.name, newTags)) {
      onChange(newTags);
    }
    setState(prev => ({ 
      ...prev, 
      inputValue: '', 
      showSuggestions: false,
      selectedSuggestionIndex: -1
    }));
    inputRef.current?.focus();
  };

  // Remove tag with animation
  const removeTag = (tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove));
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setState(prev => ({ ...prev, showSuggestions: false }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Inline Tag Input Field */}
      <div 
        className={cn(
          'flex flex-wrap items-center gap-1 min-h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors',
          'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
          error && 'border-red-500',
          state.showSuggestions && 'rounded-b-none border-b-0'
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Existing Tags as Inline Chips */}
        {value.map((tag) => (
          <Badge 
            key={tag} 
            variant="secondary"
            className={cn(
              'flex items-center gap-1 h-6 px-2 py-0 text-xs transition-all duration-200 shrink-0',
              state.duplicateAnimation === tag && animateDuplicates && 
              'animate-pulse bg-red-100 border-red-300 text-red-700'
            )}
          >
            {tag}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="ml-1 hover:bg-gray-200 rounded-full p-0.5 transition-colors"
              type="button"
              aria-label={`Remove ${tag} tag`}
            >
              <X size={10} />
            </button>
          </Badge>
        ))}
        
        {/* Input Field */}
        <input
          ref={inputRef}
          value={state.inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent outline-none placeholder:text-muted-foreground"
          autoComplete="off"
        />
        
        {/* Dropdown indicator */}
        {state.showSuggestions && (
          <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
        )}
      </div>

      {/* Suggestions Dropdown */}
      {state.showSuggestions && state.suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full bg-white border border-t-0 border-gray-200 rounded-b-md shadow-lg max-h-48 overflow-y-auto"
          style={{ top: '100%', marginTop: '-1px' }}
        >
          {state.suggestions.map((suggestion, index) => (
            <div
              key={suggestion.id}
              className={cn(
                'px-3 py-2 cursor-pointer text-sm hover:bg-gray-50 flex items-center justify-between',
                index === state.selectedSuggestionIndex && 'bg-blue-50 text-blue-700'
              )}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <span className="flex-1">{suggestion.name}</span>
              {suggestion.projectCount && (
                <span className="text-xs text-gray-400 ml-2">
                  {suggestion.projectCount} project{suggestion.projectCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Error Message */}
      {error && (
        <div className="text-xs text-red-600 flex items-center gap-1 mt-2">
          <span className="w-1 h-1 bg-red-600 rounded-full"></span>
          {error}
        </div>
      )}
      
      {/* Tag Counter and Help */}
      <div className="flex items-center justify-between mt-2">
        {maxTags && (
          <div className="text-xs text-gray-500">
            {value.length}/{maxTags} tags
          </div>
        )}
        
        {state.showSuggestions && state.suggestions.length > 0 && (
          <div className="text-xs text-blue-600">
            Press Tab or Enter to select • ↑↓ to navigate
          </div>
        )}
        
        {!error && !state.showSuggestions && value.length === 0 && (
          <div className="text-xs text-gray-500">
            Type and press Enter, or use {separators.join(' or ')} to separate multiple tags
          </div>
        )}
      </div>
    </div>
  );
}