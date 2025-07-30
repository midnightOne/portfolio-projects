"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import type { HighlightMatch } from '@/lib/utils/search-highlight';

interface HighlightedTextProps {
  segments: HighlightMatch[];
  highlightClassName?: string;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}

/**
 * Component for displaying text with highlighted search terms
 */
export function HighlightedText({
  segments,
  highlightClassName = "bg-yellow-200 dark:bg-yellow-800 font-medium",
  className,
  as: Component = 'span'
}: HighlightedTextProps) {
  return (
    <Component className={className}>
      {segments.map((segment, index) => (
        <React.Fragment key={index}>
          {segment.isMatch ? (
            <mark className={cn(highlightClassName, "px-0.5 rounded-sm")}>
              {segment.text}
            </mark>
          ) : (
            segment.text
          )}
        </React.Fragment>
      ))}
    </Component>
  );
}

interface SearchExcerptProps {
  text: string;
  searchQuery: string;
  maxLength?: number;
  contextLength?: number;
  highlightClassName?: string;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}

/**
 * Component for displaying search excerpts with highlighted terms
 */
export function SearchExcerpt({
  text,
  searchQuery,
  maxLength = 200,
  contextLength = 50,
  highlightClassName = "bg-yellow-200 dark:bg-yellow-800 font-medium",
  className,
  as = 'p'
}: SearchExcerptProps) {
  // Import the function dynamically to avoid SSR issues
  const [segments, setSegments] = React.useState<HighlightMatch[]>([]);

  React.useEffect(() => {
    import('@/lib/utils/search-highlight').then(({ createSearchExcerpt }) => {
      const excerptSegments = createSearchExcerpt(text, searchQuery, maxLength, contextLength);
      setSegments(excerptSegments);
    });
  }, [text, searchQuery, maxLength, contextLength]);

  if (segments.length === 0) {
    // Fallback while loading
    const fallbackText = text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
    return React.createElement(as, { className }, fallbackText);
  }

  return (
    <HighlightedText
      segments={segments}
      highlightClassName={highlightClassName}
      className={className}
      as={as}
    />
  );
}