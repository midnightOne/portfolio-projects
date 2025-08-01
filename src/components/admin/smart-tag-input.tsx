'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface Tag {
  id: string;
  name: string;
  color: string | null;
  createdAt: Date;
}

interface SmartTagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  existingTags: Tag[];
  placeholder?: string;
  separators?: string[];
  maxTags?: number;
  caseSensitive?: boolean;
  className?: string;
  error?: string;
  onTagCreate?: (tagName: string) => void;
  onDuplicateAttempt?: (tagName: string) => void;
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
  onDuplicateAttempt
}: SmartTagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    // Check if any separator was typed
    const hasSeparator = separators.some(sep => newValue.includes(sep));
    
    if (hasSeparator) {
      // Process the input to extract tags
      const tags = newValue
        .split(new RegExp(`[${separators.join('')}]`))
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
      
      // Add valid tags
      const newTags = [...value];
      tags.forEach(tag => {
        const normalizedTag = caseSensitive ? tag : tag.toLowerCase();
        const existingNormalized = value.map(t => caseSensitive ? t : t.toLowerCase());
        
        if (!existingNormalized.includes(normalizedTag)) {
          if (!maxTags || newTags.length < maxTags) {
            newTags.push(tag);
            onTagCreate?.(tag);
          }
        } else {
          onDuplicateAttempt?.(tag);
        }
      });
      
      onChange(newTags);
      setInputValue('');
    } else {
      setInputValue(newValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      const tag = inputValue.trim();
      const normalizedTag = caseSensitive ? tag : tag.toLowerCase();
      const existingNormalized = value.map(t => caseSensitive ? t : t.toLowerCase());
      
      if (!existingNormalized.includes(normalizedTag)) {
        if (!maxTags || value.length < maxTags) {
          onChange([...value, tag]);
          onTagCreate?.(tag);
        }
      } else {
        onDuplicateAttempt?.(tag);
      }
      
      setInputValue('');
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      // Remove last tag when backspace is pressed on empty input
      onChange(value.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Input
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={error ? 'border-red-500' : ''}
      />
      
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <Badge 
              key={tag} 
              variant="secondary"
              className="flex items-center gap-1"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="ml-1 hover:bg-gray-200 rounded-full p-0.5"
                type="button"
              >
                <X size={12} />
              </button>
            </Badge>
          ))}
        </div>
      )}
      
      {error && (
        <div className="text-xs text-red-600">{error}</div>
      )}
      
      {maxTags && (
        <div className="text-xs text-gray-500">
          {value.length}/{maxTags} tags
        </div>
      )}
    </div>
  );
}