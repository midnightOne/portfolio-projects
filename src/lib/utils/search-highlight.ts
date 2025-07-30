/**
 * Search result highlighting utilities
 * Provides functions to highlight search terms in text content
 */

export interface HighlightMatch {
  text: string;
  isMatch: boolean;
}

/**
 * Highlights search terms in text by splitting into matched and non-matched segments
 * @param text - The text to highlight
 * @param searchQuery - The search query to highlight
 * @param caseSensitive - Whether the search should be case sensitive
 * @returns Array of text segments with match indicators
 */
export function highlightSearchTerms(
  text: string,
  searchQuery: string,
  caseSensitive: boolean = false
): HighlightMatch[] {
  if (!text || !searchQuery.trim()) {
    return [{ text, isMatch: false }];
  }

  const query = searchQuery.trim();
  const searchTerms = query
    .split(/\s+/)
    .filter(term => term.length > 0)
    .map(term => escapeRegExp(term));

  if (searchTerms.length === 0) {
    return [{ text, isMatch: false }];
  }

  // Create regex pattern that matches any of the search terms
  const pattern = searchTerms.join('|');
  const flags = caseSensitive ? 'g' : 'gi';
  const regex = new RegExp(`(${pattern})`, flags);

  const parts = text.split(regex);
  const result: HighlightMatch[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part) {
      // Check if this part matches any search term
      const isMatch = searchTerms.some(term => {
        const termRegex = new RegExp(`^${term}$`, caseSensitive ? '' : 'i');
        return termRegex.test(part);
      });

      result.push({
        text: part,
        isMatch
      });
    }
  }

  return result;
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Creates a highlighted text excerpt around search matches
 * @param text - The full text
 * @param searchQuery - The search query
 * @param maxLength - Maximum length of the excerpt
 * @param contextLength - Number of characters to show around matches
 * @returns Highlighted excerpt
 */
export function createSearchExcerpt(
  text: string,
  searchQuery: string,
  maxLength: number = 200,
  contextLength: number = 50
): HighlightMatch[] {
  if (!text || !searchQuery.trim()) {
    return [{ text: text.slice(0, maxLength), isMatch: false }];
  }

  const query = searchQuery.trim();
  const searchTerms = query
    .split(/\s+/)
    .filter(term => term.length > 0)
    .map(term => escapeRegExp(term));

  if (searchTerms.length === 0) {
    return [{ text: text.slice(0, maxLength), isMatch: false }];
  }

  // Find the first match
  const pattern = searchTerms.join('|');
  const regex = new RegExp(pattern, 'gi');
  const match = regex.exec(text);

  if (!match) {
    return [{ text: text.slice(0, maxLength), isMatch: false }];
  }

  // Calculate excerpt boundaries
  const matchStart = match.index;
  const matchEnd = matchStart + match[0].length;
  
  const excerptStart = Math.max(0, matchStart - contextLength);
  const excerptEnd = Math.min(text.length, matchEnd + contextLength);
  
  // Adjust to word boundaries if possible
  let adjustedStart = excerptStart;
  let adjustedEnd = excerptEnd;
  
  if (excerptStart > 0) {
    const spaceIndex = text.indexOf(' ', excerptStart);
    if (spaceIndex !== -1 && spaceIndex < matchStart) {
      adjustedStart = spaceIndex + 1;
    }
  }
  
  if (excerptEnd < text.length) {
    const spaceIndex = text.lastIndexOf(' ', excerptEnd);
    if (spaceIndex !== -1 && spaceIndex > matchEnd) {
      adjustedEnd = spaceIndex;
    }
  }

  const excerpt = text.slice(adjustedStart, adjustedEnd);
  const prefix = adjustedStart > 0 ? '...' : '';
  const suffix = adjustedEnd < text.length ? '...' : '';
  
  const fullExcerpt = prefix + excerpt + suffix;
  
  return highlightSearchTerms(fullExcerpt, searchQuery);
}

/**
 * React component props for highlighted text
 */
export interface HighlightedTextProps {
  segments: HighlightMatch[];
  highlightClassName?: string;
  className?: string;
}

/**
 * Utility to check if text contains search terms
 */
export function containsSearchTerms(
  text: string,
  searchQuery: string,
  caseSensitive: boolean = false
): boolean {
  if (!text || !searchQuery.trim()) {
    return false;
  }

  const query = searchQuery.trim();
  const searchText = caseSensitive ? text : text.toLowerCase();
  const searchTerms = (caseSensitive ? query : query.toLowerCase())
    .split(/\s+/)
    .filter(term => term.length > 0);

  return searchTerms.some(term => searchText.includes(term));
}