'use client';

import { useState } from 'react';
import { AIQuickActions, TextSelection, ProjectContext, AIQuickActionResult } from './ai-quick-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * Example implementation of AI Quick Actions component
 * This demonstrates how to integrate the component with a text editor
 */
export function AIQuickActionsExample() {
  const [content, setContent] = useState(`# My Portfolio Project

This is a sample project that demonstrates the use of React and TypeScript to build modern web applications. The project includes features like responsive design, state management, and API integration.

## Features
- Modern React with hooks
- TypeScript for type safety
- Responsive design with Tailwind CSS
- API integration with fetch

## Technologies Used
React, TypeScript, Tailwind CSS, Next.js

The project showcases best practices in modern web development and serves as a foundation for building scalable applications.`);

  const [selectedText, setSelectedText] = useState<TextSelection | undefined>();
  const [projectTags, setProjectTags] = useState<string[]>(['react', 'typescript', 'nextjs']);
  const [lastAction, setLastAction] = useState<string>('');

  // Mock project context
  const projectContext: ProjectContext = {
    title: 'My Portfolio Project',
    description: 'A sample project demonstrating React and TypeScript',
    existingTags: projectTags,
    fullContent: content
  };

  // Handle text selection in textarea
  const handleTextSelection = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const textarea = event.target as HTMLTextAreaElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    if (start !== end) {
      const selectedText = content.substring(start, end);
      setSelectedText({
        text: selectedText,
        start,
        end
      });
    } else {
      setSelectedText(undefined);
    }
  };

  // Handle applying AI-generated changes
  const handleApplyChanges = (result: AIQuickActionResult) => {
    setLastAction(`Applied AI changes using ${result.model}`);

    // Apply full content replacement
    if (result.changes.fullContent) {
      setContent(result.changes.fullContent);
      setSelectedText(undefined);
    }

    // Apply partial text replacement
    if (result.changes.partialUpdate) {
      const { start, end, newText } = result.changes.partialUpdate;
      const newContent = content.substring(0, start) + newText + content.substring(end);
      setContent(newContent);
      setSelectedText(undefined);
    }

    // Apply tag suggestions
    if (result.changes.suggestedTags) {
      const { add, remove } = result.changes.suggestedTags;
      let newTags = [...projectTags];
      
      // Remove suggested tags
      newTags = newTags.filter(tag => !remove.includes(tag));
      
      // Add new tags (avoid duplicates)
      add.forEach(tag => {
        if (!newTags.includes(tag)) {
          newTags.push(tag);
        }
      });
      
      setProjectTags(newTags);
    }
  };

  const clearSelection = () => {
    setSelectedText(undefined);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">AI Quick Actions Example</h1>
        <p className="text-gray-600">
          Select text in the editor below and use AI quick actions to improve your content
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Content Editor */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Content Editor</CardTitle>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Select text to enable AI actions
                </p>
                {selectedText && (
                  <Button variant="outline" size="sm" onClick={clearSelection}>
                    Clear Selection
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onSelect={handleTextSelection}
                onMouseUp={handleTextSelection}
                onKeyUp={handleTextSelection}
                rows={20}
                className="font-mono text-sm"
                placeholder="Enter your project content here..."
              />
            </CardContent>
          </Card>

          {/* Project Tags */}
          <Card>
            <CardHeader>
              <CardTitle>Project Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {projectTags.map((tag, index) => (
                  <Badge key={index} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Status */}
          {lastAction && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-green-600">✅ {lastAction}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* AI Quick Actions */}
        <div>
          <AIQuickActions
            selectedText={selectedText}
            projectContext={projectContext}
            onApplyChanges={handleApplyChanges}
          />
        </div>
      </div>

      {/* Selection Info */}
      {selectedText && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800">Current Selection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-blue-700">
                <strong>Position:</strong> {selectedText.start} - {selectedText.end}
              </p>
              <p className="text-sm text-blue-700">
                <strong>Length:</strong> {selectedText.text.length} characters
              </p>
              <div className="bg-white border border-blue-200 rounded p-3">
                <p className="text-sm text-blue-900 italic">
                  "{selectedText.text}"
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Text-Based Actions:</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Select text in the editor</li>
                <li>• Choose an AI model</li>
                <li>• Click a quick action button</li>
                <li>• Preview and apply changes</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Tag Suggestions:</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• No text selection needed</li>
                <li>• Choose an AI model</li>
                <li>• Click "Suggest Tags"</li>
                <li>• Review and apply suggestions</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AIQuickActionsExample;