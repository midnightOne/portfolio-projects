'use client';

import { useState, useRef, useMemo } from 'react';
import { 
  TextSelectionManager, 
  TextareaAdapter, 
  TextSelection, 
  TextChange,
  applyTextChangeWithPosition,
  findTextPosition
} from './text-selection-manager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

/**
 * Example implementation of Text Selection Manager
 * Demonstrates text selection detection and change application
 */
export function TextSelectionManagerExample() {
  const [content, setContent] = useState(`# Text Selection Manager Demo

This is a demonstration of the Text Selection Manager component. 

Select any text in this editor to see the selection details below. You can then apply various text transformations to see how the manager handles precise text replacement.

## Features Demonstrated:
- Text selection detection
- Precise character positioning
- Text replacement with cursor management
- Content change notifications
- Selection state management

Try selecting different portions of text and using the action buttons below!`);

  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [changeHistory, setChangeHistory] = useState<Array<{
    timestamp: Date;
    change: TextChange;
    description: string;
  }>>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Create adapter for the textarea
  const adapter = useMemo(() => {
    if (textareaRef.current) {
      return new TextareaAdapter(textareaRef.current, setContent);
    }
    return null;
  }, [textareaRef.current]);

  // Handle manual text changes
  const handleApplyChange = (change: TextChange, description: string) => {
    if (adapter) {
      adapter.applyChange(change);
      
      // Add to history
      setChangeHistory(prev => [...prev, {
        timestamp: new Date(),
        change,
        description
      }]);
    }
  };

  // Transform selected text to uppercase
  const handleUppercase = () => {
    if (selection) {
      handleApplyChange({
        start: selection.start,
        end: selection.end,
        newText: selection.text.toUpperCase(),
        reasoning: 'Converted to uppercase'
      }, 'Convert to Uppercase');
    }
  };

  // Transform selected text to lowercase
  const handleLowercase = () => {
    if (selection) {
      handleApplyChange({
        start: selection.start,
        end: selection.end,
        newText: selection.text.toLowerCase(),
        reasoning: 'Converted to lowercase'
      }, 'Convert to Lowercase');
    }
  };

  // Wrap selected text with markdown bold
  const handleBold = () => {
    if (selection) {
      handleApplyChange({
        start: selection.start,
        end: selection.end,
        newText: `**${selection.text}**`,
        reasoning: 'Added markdown bold formatting'
      }, 'Make Bold');
    }
  };

  // Wrap selected text with markdown italic
  const handleItalic = () => {
    if (selection) {
      handleApplyChange({
        start: selection.start,
        end: selection.end,
        newText: `*${selection.text}*`,
        reasoning: 'Added markdown italic formatting'
      }, 'Make Italic');
    }
  };

  // Replace selected text with custom text
  const handleCustomReplace = () => {
    if (selection && replaceText) {
      handleApplyChange({
        start: selection.start,
        end: selection.end,
        newText: replaceText,
        reasoning: 'Custom text replacement'
      }, `Replace with "${replaceText}"`);
      setReplaceText('');
    }
  };

  // Find and replace functionality
  const handleFindReplace = () => {
    if (searchText && replaceText) {
      const position = findTextPosition(content, searchText);
      if (position) {
        handleApplyChange({
          start: position.start,
          end: position.end,
          newText: replaceText,
          reasoning: 'Find and replace operation'
        }, `Find "${searchText}" and replace with "${replaceText}"`);
        setSearchText('');
        setReplaceText('');
      } else {
        alert(`Text "${searchText}" not found in content`);
      }
    }
  };

  // Clear all content
  const handleClearContent = () => {
    if (adapter) {
      adapter.setFullContent('');
      setChangeHistory([]);
    }
  };

  // Reset to demo content
  const handleResetContent = () => {
    if (adapter) {
      const demoContent = `# Text Selection Manager Demo

This is a demonstration of the Text Selection Manager component. 

Select any text in this editor to see the selection details below. You can then apply various text transformations to see how the manager handles precise text replacement.

## Features Demonstrated:
- Text selection detection
- Precise character positioning
- Text replacement with cursor management
- Content change notifications
- Selection state management

Try selecting different portions of text and using the action buttons below!`;
      
      adapter.setFullContent(demoContent);
      setChangeHistory([]);
    }
  };

  if (!adapter) {
    return <div>Loading editor...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Text Selection Manager Example</h1>
        <p className="text-gray-600">
          Demonstrates text selection detection and precise text replacement
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor Section */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Text Editor</CardTitle>
              <p className="text-sm text-gray-600">
                Select text to enable transformation actions
              </p>
            </CardHeader>
            <CardContent>
              <TextSelectionManager
                adapter={adapter}
                onSelectionChange={setSelection}
                onContentChange={setContent}
              >
                <Textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={15}
                  className="font-mono text-sm"
                  placeholder="Enter your text here..."
                />
              </TextSelectionManager>
            </CardContent>
          </Card>

          {/* Editor Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Editor Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleResetContent}>
                  Reset Demo Content
                </Button>
                <Button variant="outline" size="sm" onClick={handleClearContent}>
                  Clear All
                </Button>
              </div>
              
              <Separator />
              
              {/* Find and Replace */}
              <div className="space-y-2">
                <h4 className="font-medium">Find and Replace</h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="Find text..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="h-8"
                  />
                  <Input
                    placeholder="Replace with..."
                    value={replaceText}
                    onChange={(e) => setReplaceText(e.target.value)}
                    className="h-8"
                  />
                  <Button
                    size="sm"
                    onClick={handleFindReplace}
                    disabled={!searchText || !replaceText}
                  >
                    Replace
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Selection and Actions Section */}
        <div className="space-y-4">
          {/* Current Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Current Selection</CardTitle>
            </CardHeader>
            <CardContent>
              {selection ? (
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="text-sm font-medium text-blue-800 mb-1">Selected Text:</p>
                    <p className="text-sm text-blue-900 italic">"{selection.text}"</p>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="font-medium">Start:</span> {selection.start}
                    </div>
                    <div>
                      <span className="font-medium">End:</span> {selection.end}
                    </div>
                    <div>
                      <span className="font-medium">Length:</span> {selection.text.length}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No text selected</p>
              )}
            </CardContent>
          </Card>

          {/* Text Transformations */}
          <Card>
            <CardHeader>
              <CardTitle>Text Transformations</CardTitle>
              <p className="text-sm text-gray-600">
                Select text first to enable these actions
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUppercase}
                  disabled={!selection}
                >
                  UPPERCASE
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLowercase}
                  disabled={!selection}
                >
                  lowercase
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBold}
                  disabled={!selection}
                >
                  **Bold**
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleItalic}
                  disabled={!selection}
                >
                  *Italic*
                </Button>
              </div>
              
              <Separator className="my-3" />
              
              {/* Custom Replace */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Custom Replace</h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="Replace selection with..."
                    value={replaceText}
                    onChange={(e) => setReplaceText(e.target.value)}
                    className="h-8"
                  />
                  <Button
                    size="sm"
                    onClick={handleCustomReplace}
                    disabled={!selection || !replaceText}
                  >
                    Replace
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Change History */}
          <Card>
            <CardHeader>
              <CardTitle>Change History</CardTitle>
              <p className="text-sm text-gray-600">
                Recent text modifications
              </p>
            </CardHeader>
            <CardContent>
              {changeHistory.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {changeHistory.slice(-10).reverse().map((entry, index) => (
                    <div key={index} className="bg-gray-50 rounded p-2 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-xs">
                          {entry.description}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {entry.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600">
                        Position: {entry.change.start}-{entry.change.end} → "{entry.change.newText}"
                      </div>
                      {entry.change.reasoning && (
                        <div className="text-xs text-gray-500 italic">
                          {entry.change.reasoning}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No changes yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Text Selection:</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Click and drag to select text</li>
                <li>• Selection details appear in the right panel</li>
                <li>• Position and length are tracked precisely</li>
                <li>• Selection updates automatically</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Text Transformations:</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Select text first to enable actions</li>
                <li>• Use transformation buttons for quick changes</li>
                <li>• Try find and replace for bulk changes</li>
                <li>• All changes are tracked in history</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default TextSelectionManagerExample;