/**
 * Tests for editor abstraction layer
 */

import { EditorFactory } from '../editor-factory';
import { TextareaAdapter } from '../textarea-adapter';
import { TiptapAdapter } from '../tiptap-adapter';
import { NovelAdapter } from '../novel-adapter';
import { ContentParser } from '../content-parser';
import { StructuredContentHandler } from '../structured-content-handler';
import { RichTextProcessor } from '../rich-text-processor';
import { SelectionManager } from '../selection-manager';
import { StructuredContent, ContentBlock } from '../types';

// Mock DOM elements
class MockTextarea {
  value = '';
  selectionStart = 0;
  selectionEnd = 0;

  setSelectionRange(start: number, end: number) {
    this.selectionStart = start;
    this.selectionEnd = end;
  }

  focus() {}
  blur() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }
}

class MockTiptapEditor {
  private content = { type: 'doc', content: [] };
  
  getJSON() {
    return this.content;
  }

  setContent(content: any) {
    this.content = content;
  }

  getSelection() {
    return { from: 0, to: 0, empty: true };
  }

  state = {
    selection: { from: 0, to: 0, empty: true },
    doc: { textBetween: () => '' }
  };

  commands = {
    setContent: (content: any) => this.setContent(content),
    setTextSelection: () => {},
    focus: () => {},
    toggleBold: () => {},
    toggleItalic: () => {},
    insertContent: () => {}
  };

  view = { dispatch: () => {}, dom: {} };
  on() {}
  off() {}
  destroy() {}
}

class MockNovelEditor {
  private content = { type: 'doc', blocks: [] };

  getJSON() {
    return this.content;
  }

  setContent(content: any) {
    this.content = content;
  }

  getSelection() {
    return { from: 0, to: 0, empty: true };
  }

  replaceRange() {}
  setSelection() {}
  insertBlock() {}
  updateBlock() {}
  deleteBlock() {}
  focus() {}
  blur() {}
  on() {}
  off() {}
  destroy() {}
}

describe('Editor Abstraction Layer', () => {
  describe('EditorFactory', () => {
    it('should create textarea adapter for textarea element', () => {
      const textarea = new MockTextarea() as any;
      const adapter = EditorFactory.createAdapter(textarea, 'textarea');
      
      expect(adapter).toBeInstanceOf(TextareaAdapter);
      expect(adapter.type).toBe('textarea');
    });

    it('should create tiptap adapter for tiptap editor', () => {
      const editor = new MockTiptapEditor();
      const adapter = EditorFactory.createAdapter(editor, 'tiptap');
      
      expect(adapter).toBeInstanceOf(TiptapAdapter);
      expect(adapter.type).toBe('tiptap');
    });

    it('should create novel adapter for novel editor', () => {
      const editor = new MockNovelEditor();
      const adapter = EditorFactory.createAdapter(editor, 'novel');
      
      expect(adapter).toBeInstanceOf(NovelAdapter);
      expect(adapter.type).toBe('novel');
    });

    it('should detect editor type automatically', () => {
      const textarea = new MockTextarea() as any;
      const detection = EditorFactory.detectEditorType(textarea);
      
      expect(detection.type).toBe('textarea');
      expect(detection.element).toBe(textarea);
    });

    it('should return supported editor types', () => {
      const types = EditorFactory.getSupportedTypes();
      expect(types).toEqual(['textarea', 'tiptap', 'novel']);
    });
  });

  describe('TextareaAdapter', () => {
    let textarea: any;
    let adapter: TextareaAdapter;

    beforeEach(() => {
      textarea = new MockTextarea();
      adapter = new TextareaAdapter(textarea);
    });

    afterEach(() => {
      adapter.destroy();
    });

    it('should get and set content', () => {
      const content = 'Hello, world!';
      adapter.setContent(content);
      expect(adapter.getContent()).toBe(content);
      expect(adapter.getTextContent()).toBe(content);
    });

    it('should handle text selection', () => {
      textarea.value = 'Hello, world!';
      textarea.selectionStart = 0;
      textarea.selectionEnd = 5;

      const selection = adapter.getSelection();
      expect(selection).toEqual({
        text: 'Hello',
        start: 0,
        end: 5,
        context: expect.any(Object)
      });
    });

    it('should apply text changes', () => {
      adapter.setContent('Hello, world!');
      
      adapter.applyChange({
        start: 7,
        end: 12,
        newText: 'universe'
      });

      expect(adapter.getContent()).toBe('Hello, universe!');
    });

    it('should get editor capabilities', () => {
      expect(adapter.capabilities).toEqual({
        supportsRichText: false,
        supportsStructuredContent: false,
        supportsUndo: true,
        supportsSelection: true,
        supportsFormatting: false,
        supportedFormats: ['text/plain']
      });
    });
  });

  describe('ContentParser', () => {
    it('should parse plain text content', () => {
      const text = 'Hello, world!\n\nThis is a test.';
      const result = ContentParser.parseContent(text);
      
      expect(result.plainText).toBe(text);
      expect(result.metadata.wordCount).toBe(6);
      expect(result.metadata.characterCount).toBe(text.length);
      expect(result.metadata.estimatedTokens).toBeGreaterThan(0);
    });

    it('should convert text to structured content', () => {
      const text = 'Paragraph 1\n\nParagraph 2';
      const structured = ContentParser.textToStructured(text);
      
      expect(structured.type).toBe('doc');
      expect(structured.content).toHaveLength(2);
      expect(structured.content[0].type).toBe('paragraph');
      expect(structured.content[0].content).toBe('Paragraph 1');
    });

    it('should extract plain text from structured content', () => {
      const structured: StructuredContent = {
        type: 'doc',
        content: [
          { id: '1', type: 'paragraph', content: 'Hello' },
          { id: '2', type: 'paragraph', content: 'World' }
        ]
      };

      const plainText = ContentParser.extractPlainText(structured);
      expect(plainText).toBe('Hello\nWorld');
    });

    it('should convert structured content to HTML', () => {
      const structured: StructuredContent = {
        type: 'doc',
        content: [
          { id: '1', type: 'paragraph', content: 'Hello' },
          { id: '2', type: 'heading', content: 'Title', attributes: { level: 1 } }
        ]
      };

      const html = ContentParser.structuredToHtml(structured);
      expect(html).toContain('<p>Hello</p>');
      expect(html).toContain('<h1>Title</h1>');
    });

    it('should validate structured content', () => {
      const validContent: StructuredContent = {
        type: 'doc',
        content: [
          { id: '1', type: 'paragraph', content: 'Hello' }
        ]
      };

      expect(ContentParser.validateStructuredContent(validContent)).toBe(true);

      const invalidContent = {
        type: 'invalid',
        content: 'not an array'
      } as any;

      expect(ContentParser.validateStructuredContent(invalidContent)).toBe(false);
    });
  });

  describe('StructuredContentHandler', () => {
    let handler: StructuredContentHandler;
    let sampleContent: StructuredContent;

    beforeEach(() => {
      sampleContent = {
        type: 'doc',
        content: [
          { id: '1', type: 'paragraph', content: 'First paragraph' },
          { id: '2', type: 'heading', content: 'Title', attributes: { level: 1 } },
          { id: '3', type: 'paragraph', content: 'Second paragraph' }
        ]
      };

      handler = new StructuredContentHandler(sampleContent);
    });

    it('should insert new blocks', () => {
      const newBlock: ContentBlock = {
        id: '4',
        type: 'paragraph',
        content: 'New paragraph'
      };

      const success = handler.insertBlock(newBlock, 1);
      expect(success).toBe(true);

      const stats = handler.getStatistics();
      expect(stats.blockCount).toBe(4);
    });

    it('should update existing blocks', () => {
      const success = handler.updateBlock('1', { content: 'Updated paragraph' });
      expect(success).toBe(true);

      const plainText = handler.toPlainText();
      expect(plainText).toContain('Updated paragraph');
    });

    it('should delete blocks', () => {
      const success = handler.deleteBlock('2');
      expect(success).toBe(true);

      const stats = handler.getStatistics();
      expect(stats.blockCount).toBe(2);
    });

    it('should find blocks by type', () => {
      const paragraphs = handler.findBlocksByType('paragraph');
      expect(paragraphs).toHaveLength(2);
      expect(paragraphs[0].content).toBe('First paragraph');
    });

    it('should find blocks by text', () => {
      const blocks = handler.findBlocksByText('First');
      expect(blocks).toHaveLength(1);
      expect(blocks[0].content).toBe('First paragraph');
    });

    it('should get content statistics', () => {
      const stats = handler.getStatistics();
      expect(stats.blockCount).toBe(3);
      expect(stats.wordCount).toBeGreaterThan(0);
      expect(stats.blockTypes.paragraph).toBe(2);
      expect(stats.blockTypes.heading).toBe(1);
    });

    it('should validate content structure', () => {
      const validation = handler.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should convert to different formats', () => {
      const html = handler.toHtml();
      expect(html).toContain('<p>First paragraph</p>');
      expect(html).toContain('<h1>Title</h1>');

      const markdown = handler.toMarkdown();
      expect(markdown).toContain('# Title');
      expect(markdown).toContain('First paragraph');
    });
  });

  describe('RichTextProcessor', () => {
    let processor: RichTextProcessor;

    beforeEach(() => {
      processor = new RichTextProcessor({
        preserveLinks: true,
        preserveImages: true,
        preserveFormatting: true
      });
    });

    it('should extract links from text', () => {
      const text = 'Check out [Google](https://google.com) for search.';
      const links = processor.extractLinks(text);
      
      expect(links).toHaveLength(1);
      expect(links[0].href).toBe('https://google.com');
      expect(links[0].text).toBe('Google');
    });

    it('should extract images from text', () => {
      const text = 'Here is an image: ![Alt text](https://example.com/image.jpg)';
      const images = processor.extractMediaElements(text);
      
      expect(images).toHaveLength(1);
      expect(images[0].src).toBe('https://example.com/image.jpg');
      expect(images[0].alt).toBe('Alt text');
    });

    it('should preserve links in modified text', () => {
      const original = 'Visit [Google](https://google.com) for search.';
      const modified = 'You should visit Google for searching.';
      
      const result = processor.preserveLinksInText(original, modified);
      expect(result).toContain('[Google](https://google.com)');
    });

    it('should handle AI response processing', () => {
      const original = 'Check [this link](https://example.com) out!';
      const aiResponse = 'You should check this link for more information.';
      
      const result = processor.processAIResponse(original, aiResponse);
      expect(result.processedText).toContain('[this link](https://example.com)');
      expect(result.errors).toHaveLength(0);
    });

    it('should extract rich text elements', () => {
      const text = 'This is **bold** and *italic* text with `code`.';
      const elements = processor.extractRichTextElements(text);
      
      expect(elements.length).toBeGreaterThan(0);
      const boldElement = elements.find(el => el.type === 'bold');
      expect(boldElement).toBeDefined();
      expect(boldElement?.content).toBe('bold');
    });
  });

  describe('SelectionManager', () => {
    let manager: SelectionManager;
    let textarea: any;
    let adapter: TextareaAdapter;

    beforeEach(() => {
      manager = new SelectionManager();
      textarea = new MockTextarea();
      adapter = new TextareaAdapter(textarea);
      
      manager.registerAdapter('test', adapter);
      manager.setActiveAdapter('test');
    });

    afterEach(() => {
      manager.destroy();
    });

    it('should register and manage adapters', () => {
      const ids = manager.getAdapterIds();
      expect(ids).toContain('test');
      
      const retrievedAdapter = manager.getAdapter('test');
      expect(retrievedAdapter).toBe(adapter);
    });

    it('should handle active adapter selection', () => {
      const activeId = manager.getActiveAdapterId();
      expect(activeId).toBe('test');
    });

    it('should get content from active adapter', () => {
      adapter.setContent('Test content');
      const content = manager.getFullContent();
      expect(content).toBe('Test content');
    });

    it('should apply changes through active adapter', () => {
      adapter.setContent('Hello, world!');
      
      manager.applyChange({
        start: 7,
        end: 12,
        newText: 'universe'
      });

      expect(manager.getFullContent()).toBe('Hello, universe!');
    });

    it('should find text in content', () => {
      adapter.setContent('Hello, world!');
      
      const position = manager.findText('world');
      expect(position).toEqual({ start: 7, end: 12 });
    });

    it('should replace text in content', () => {
      adapter.setContent('Hello, world! Hello, world!');
      
      const replacements = manager.replaceText('world', 'universe', true);
      expect(replacements).toBe(2);
      expect(manager.getFullContent()).toBe('Hello, universe! Hello, universe!');
    });

    it('should get content statistics', () => {
      adapter.setContent('Hello, world!');
      
      const stats = manager.getContentStats();
      expect(stats).toBeDefined();
      expect(stats!.wordCount).toBe(2);
      expect(stats!.characterCount).toBe(13);
    });

    it('should handle selection changes', () => {
      let selectionChangeCount = 0;
      
      const unsubscribe = manager.onSelectionChange(() => {
        selectionChangeCount++;
      });

      // Simulate selection change
      textarea.selectionStart = 0;
      textarea.selectionEnd = 5;
      
      // Clean up
      unsubscribe();
    });
  });

  describe('Integration Tests', () => {
    it('should work with all adapter types', () => {
      const textarea = new MockTextarea() as any;
      const tiptapEditor = new MockTiptapEditor();
      const novelEditor = new MockNovelEditor();

      const textareaAdapter = EditorFactory.createAdapter(textarea, 'textarea');
      const tiptapAdapter = EditorFactory.createAdapter(tiptapEditor, 'tiptap');
      const novelAdapter = EditorFactory.createAdapter(novelEditor, 'novel');

      expect(textareaAdapter.type).toBe('textarea');
      expect(tiptapAdapter.type).toBe('tiptap');
      expect(novelAdapter.type).toBe('novel');

      // Test basic operations
      textareaAdapter.setContent('Test');
      expect(textareaAdapter.getTextContent()).toBe('Test');

      // Clean up
      textareaAdapter.destroy();
      tiptapAdapter.destroy();
      novelAdapter.destroy();
    });

    it('should handle content conversion between formats', () => {
      const plainText = 'Hello\n\nWorld';
      const structured = ContentParser.textToStructured(plainText);
      const backToText = ContentParser.extractPlainText(structured);
      
      expect(backToText).toBe('Hello\nWorld');
    });

    it('should preserve formatting during AI operations', () => {
      const processor = new RichTextProcessor();
      const original = 'Visit [Google](https://google.com) and ![image](test.jpg)';
      const aiResponse = 'You should visit Google and see the image';
      
      const result = processor.processAIResponse(original, aiResponse);
      expect(result.processedText).toContain('Google');
      expect(result.errors).toHaveLength(0);
    });
  });
});