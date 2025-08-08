'use client';

import React, { useState } from 'react';
import { TiptapEditorWithAI, TiptapContentData } from '@/components/tiptap/tiptap-editor-with-ai';
import { TiptapDisplayRenderer } from '@/components/tiptap/tiptap-display-renderer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestTiptapPage() {
  const [content, setContent] = useState<TiptapContentData>({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Welcome to the Tiptap extensions test page! Try typing "/" to see the slash commands menu with portfolio-specific extensions.'
          }
        ]
      }
    ]
  });

  const mockProjectContext = {
    title: 'Test Project',
    description: 'Testing Tiptap extensions with custom portfolio extensions',
    existingTags: ['React', 'TypeScript', 'Tiptap', 'Portfolio'],
    fullContent: 'Welcome to the Tiptap extensions test page! Try typing "/" to see the slash commands menu with portfolio-specific extensions.'
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Tiptap Extensions Test</h1>
        <p className="text-gray-600">
          Test the custom portfolio extensions: Image Carousel, Interactive Embed, Download Button, and Project Reference
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Editor */}
        <Card>
          <CardHeader>
            <CardTitle>Editor (with AI Panel)</CardTitle>
            <p className="text-sm text-gray-600">
              Type "/" to see slash commands. Try /carousel, /interactive, /download, /project
            </p>
          </CardHeader>
          <CardContent>
            <TiptapEditorWithAI
              content={content}
              onChange={setContent}
              projectContext={mockProjectContext}
              showAIPanel={true}
              aiPanelHeight={500}
            />
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Preview (Display Renderer)</CardTitle>
            <p className="text-sm text-gray-600">
              See how the content renders for public viewing
            </p>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg p-4 min-h-[500px] bg-gray-50">
              <TiptapDisplayRenderer content={content} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* JSON Debug */}
      <Card>
        <CardHeader>
          <CardTitle>Content JSON (Debug)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded-lg text-xs overflow-auto max-h-64">
            {JSON.stringify(content, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}