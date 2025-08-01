/**
 * SmartTagInput Inline Demo
 * 
 * This demonstrates the new inline tag behavior where tags appear
 * as chips within the input field itself, similar to Gmail's "To" field.
 */

'use client';

import React, { useState } from 'react';
import { SmartTagInput, Tag } from './smart-tag-input';
import { Card } from '@/components/ui/card';

const demoTags: Tag[] = [
  { id: '1', name: 'React', projectCount: 15 },
  { id: '2', name: 'TypeScript', projectCount: 12 },
  { id: '3', name: 'Next.js', projectCount: 8 },
  { id: '4', name: 'JavaScript', projectCount: 20 },
  { id: '5', name: 'Node.js', projectCount: 10 },
];

export function SmartTagInputDemo() {
  const [tags, setTags] = useState<string[]>(['React']);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Inline SmartTagInput Demo</h1>
        <p className="text-gray-600">
          Tags appear as chips within the input field. Try typing "Type" or "Java" for autocomplete.
        </p>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Project Tags
          </label>
          
          <SmartTagInput
            value={tags}
            onChange={setTags}
            existingTags={demoTags}
            placeholder="Add tags (comma or semicolon separated)..."
            maxTags={5}
            showSuggestions={true}
            animateDuplicates={true}
            onTagCreate={(tag) => console.log('Created:', tag)}
            onDuplicateAttempt={(tag) => console.log('Duplicate:', tag)}
          />
          
          <div className="text-sm text-gray-500">
            <p><strong>Try these actions:</strong></p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Type "Type" and press Tab to autocomplete</li>
              <li>Type "react,javascript,node" to add multiple tags</li>
              <li>Try adding "React" again to see duplicate detection</li>
              <li>Use backspace on empty input to remove last tag</li>
              <li>Click the × button on any tag to remove it</li>
            </ul>
          </div>
          
          <div className="text-xs text-gray-400 bg-gray-50 p-3 rounded">
            <strong>Current tags:</strong> {JSON.stringify(tags)}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-3">Key Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">✅ Inline Display</h4>
            <p className="text-gray-600">Tags appear as chips within the input field, not below it</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">✅ Smart Autocomplete</h4>
            <p className="text-gray-600">Intelligent suggestions with Tab completion</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">✅ Multiple Separators</h4>
            <p className="text-gray-600">Comma, semicolon, or custom separators</p>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">✅ Duplicate Prevention</h4>
            <p className="text-gray-600">Case-insensitive duplicate detection with animation</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default SmartTagInputDemo;