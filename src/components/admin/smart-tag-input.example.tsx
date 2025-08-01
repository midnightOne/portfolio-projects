/**
 * SmartTagInput Component Example
 * 
 * This file demonstrates how to use the SmartTagInput component
 * with various configurations and features.
 */

'use client';

import React, { useState } from 'react';
import { SmartTagInput, Tag } from './smart-tag-input';
import { Card } from '@/components/ui/card';

// Mock existing tags for demonstration
const mockExistingTags: Tag[] = [
  { id: '1', name: 'React', projectCount: 15 },
  { id: '2', name: 'TypeScript', projectCount: 12 },
  { id: '3', name: 'Next.js', projectCount: 8 },
  { id: '4', name: 'JavaScript', projectCount: 20 },
  { id: '5', name: 'Node.js', projectCount: 10 },
  { id: '6', name: 'Python', projectCount: 7 },
  { id: '7', name: 'React Native', projectCount: 5 },
  { id: '8', name: 'Vue.js', projectCount: 6 },
  { id: '9', name: 'Angular', projectCount: 4 },
  { id: '10', name: 'Svelte', projectCount: 3 },
];

export function SmartTagInputExample() {
  const [basicTags, setBasicTags] = useState<string[]>(['React', 'TypeScript']);
  const [advancedTags, setAdvancedTags] = useState<string[]>([]);
  const [limitedTags, setLimitedTags] = useState<string[]>([]);
  const [caseSensitiveTags, setCaseSensitiveTags] = useState<string[]>([]);

  return (
    <div className="space-y-8 p-6 max-w-4xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">SmartTagInput Examples</h1>
        <p className="text-gray-600">
          Demonstrating various configurations and features of the SmartTagInput component
        </p>
      </div>

      {/* Basic Usage */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Inline Tag Input</h2>
        <p className="text-gray-600 mb-4">
          Tags appear inline within the input field. Try typing "Rea" or "Type" for autocomplete, or use commas/semicolons to add multiple tags.
        </p>
        <SmartTagInput
          value={basicTags}
          onChange={setBasicTags}
          existingTags={mockExistingTags}
          placeholder="Add technology tags..."
          onTagCreate={(tag) => console.log('Created tag:', tag)}
          onDuplicateAttempt={(tag) => console.log('Duplicate attempted:', tag)}
        />
        <div className="mt-4 text-sm text-gray-500">
          Current tags: {JSON.stringify(basicTags)}
        </div>
      </Card>

      {/* Advanced Features */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Advanced Inline Features</h2>
        <p className="text-gray-600 mb-4">
          Custom separators, animations, and enhanced autocomplete. Tags appear as chips within the input field. Try typing multiple tags separated by commas, semicolons, or pipes.
        </p>
        <SmartTagInput
          value={advancedTags}
          onChange={setAdvancedTags}
          existingTags={mockExistingTags}
          placeholder="Add tags using , ; or | as separators..."
          separators={[',', ';', '|']}
          maxSuggestions={8}
          animateDuplicates={true}
          showSuggestions={true}
          onTagCreate={(tag) => console.log('Advanced: Created tag:', tag)}
          onDuplicateAttempt={(tag) => console.log('Advanced: Duplicate attempted:', tag)}
        />
        <div className="mt-4 text-sm text-gray-500">
          Current tags: {JSON.stringify(advancedTags)}
        </div>
      </Card>

      {/* Limited Tags */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Limited Tags (Max 3)</h2>
        <p className="text-gray-600 mb-4">
          Demonstrates tag limit functionality with counter display.
        </p>
        <SmartTagInput
          value={limitedTags}
          onChange={setLimitedTags}
          existingTags={mockExistingTags}
          placeholder="Add up to 3 tags..."
          maxTags={3}
          onTagCreate={(tag) => console.log('Limited: Created tag:', tag)}
        />
        <div className="mt-4 text-sm text-gray-500">
          Current tags: {JSON.stringify(limitedTags)}
        </div>
      </Card>

      {/* Case Sensitive */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Case Sensitive Mode</h2>
        <p className="text-gray-600 mb-4">
          Case-sensitive duplicate detection. "React" and "react" are treated as different tags.
        </p>
        <SmartTagInput
          value={caseSensitiveTags}
          onChange={setCaseSensitiveTags}
          existingTags={mockExistingTags}
          placeholder="Case-sensitive tag input..."
          caseSensitive={true}
          onTagCreate={(tag) => console.log('Case-sensitive: Created tag:', tag)}
          onDuplicateAttempt={(tag) => console.log('Case-sensitive: Duplicate attempted:', tag)}
        />
        <div className="mt-4 text-sm text-gray-500">
          Current tags: {JSON.stringify(caseSensitiveTags)}
        </div>
      </Card>

      {/* Error State */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Error State</h2>
        <p className="text-gray-600 mb-4">
          Demonstrates error display functionality.
        </p>
        <SmartTagInput
          value={[]}
          onChange={() => {}}
          existingTags={mockExistingTags}
          placeholder="This input has an error..."
          error="At least one tag is required"
        />
      </Card>

      {/* Keyboard Shortcuts Help */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Keyboard Shortcuts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-medium mb-2">Navigation</h3>
            <ul className="space-y-1 text-gray-600">
              <li><kbd className="px-2 py-1 bg-gray-100 rounded">↑/↓</kbd> Navigate suggestions</li>
              <li><kbd className="px-2 py-1 bg-gray-100 rounded">Tab</kbd> Complete with suggestion</li>
              <li><kbd className="px-2 py-1 bg-gray-100 rounded">Enter</kbd> Add tag or suggestion</li>
              <li><kbd className="px-2 py-1 bg-gray-100 rounded">Escape</kbd> Close suggestions</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">Editing</h3>
            <ul className="space-y-1 text-gray-600">
              <li><kbd className="px-2 py-1 bg-gray-100 rounded">,</kbd> or <kbd className="px-2 py-1 bg-gray-100 rounded">;</kbd> Add multiple tags</li>
              <li><kbd className="px-2 py-1 bg-gray-100 rounded">Backspace</kbd> Remove last tag (empty input)</li>
              <li>Click <kbd className="px-1 py-0.5 bg-gray-100 rounded text-xs">×</kbd> Remove specific tag</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Integration Notes */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Integration Notes</h2>
        <div className="prose prose-sm max-w-none">
          <p>
            The SmartTagInput component is designed to be modular and reusable. Key features:
          </p>
          <ul>
            <li><strong>Autocomplete:</strong> Intelligent suggestions based on existing tags</li>
            <li><strong>Flexible separators:</strong> Support for comma, semicolon, and custom separators</li>
            <li><strong>Duplicate detection:</strong> Case-sensitive or case-insensitive duplicate prevention</li>
            <li><strong>Keyboard navigation:</strong> Full keyboard support for accessibility</li>
            <li><strong>Visual feedback:</strong> Animations for duplicates and smooth transitions</li>
            <li><strong>Configurable limits:</strong> Maximum tag count with visual counter</li>
            <li><strong>Error handling:</strong> Built-in error display and validation</li>
          </ul>
          <p>
            Check the browser console to see callback events when interacting with the examples above.
          </p>
        </div>
      </Card>
    </div>
  );
}

export default SmartTagInputExample;