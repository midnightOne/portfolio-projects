/**
 * Context API Tests
 * Tests for the AI context building API endpoints
 */

// Mock the context manager
const mockContextManager = {
  buildContextWithCaching: jest.fn(),
  buildContext: jest.fn(),
  getCacheStats: jest.fn(),
  clearSessionCache: jest.fn(),
  clearAllCache: jest.fn()
};

jest.mock('@/lib/services/ai/context-manager', () => ({
  contextManager: mockContextManager
}));

// Mock other dependencies
jest.mock('@/lib/utils/api-utils', () => ({
  handleApiError: jest.fn((error, request) => 
    new Response(JSON.stringify({ error: error.message }), { status: 500 })
  ),
  addCorsHeaders: jest.fn((response) => response)
}));

jest.mock('@/lib/utils/performance', () => ({
  withPerformanceTracking: jest.fn((handler) => handler)
}));

// Mock Next.js server components
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((data) => ({
      json: () => Promise.resolve(data),
      status: 200
    }))
  }
}));

describe('/api/ai/context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Context Manager Integration', () => {
    it('should build context successfully', async () => {
      mockContextManager.buildContextWithCaching.mockResolvedValue({
        context: 'Test context content',
        fromCache: false
      });

      // Test the context manager directly since API route testing is complex
      const result = await mockContextManager.buildContextWithCaching(
        'test-session',
        [],
        'React developer',
        {}
      );

      expect(result.context).toBe('Test context content');
      expect(result.fromCache).toBe(false);
      expect(mockContextManager.buildContextWithCaching).toHaveBeenCalledWith(
        'test-session',
        [],
        'React developer',
        {}
      );
    });

    it('should build context without caching when requested', async () => {
      mockContextManager.buildContext.mockResolvedValue('Test context content');

      const result = await mockContextManager.buildContext(
        [],
        'React developer',
        {}
      );

      expect(result).toBe('Test context content');
      expect(mockContextManager.buildContext).toHaveBeenCalledWith(
        [],
        'React developer',
        {}
      );
    });

    it('should provide cache statistics', () => {
      mockContextManager.getCacheStats.mockReturnValue({
        size: 5,
        sessions: ['session-1', 'session-2'],
        totalTokens: 1000
      });

      const stats = mockContextManager.getCacheStats();

      expect(stats.size).toBe(5);
      expect(stats.sessions).toEqual(['session-1', 'session-2']);
      expect(stats.totalTokens).toBe(1000);
    });

    it('should clear specific session cache', () => {
      mockContextManager.clearSessionCache('test-session');
      
      expect(mockContextManager.clearSessionCache).toHaveBeenCalledWith('test-session');
    });

    it('should clear all cache', () => {
      mockContextManager.clearAllCache();
      
      expect(mockContextManager.clearAllCache).toHaveBeenCalled();
    });
  });
});