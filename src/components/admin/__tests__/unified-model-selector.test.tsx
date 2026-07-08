import { render as rtlRender, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { UnifiedModelSelector } from '../unified-model-selector';
import { ToastProvider } from '@/components/ui/toast';

// The component calls useToast, which requires the app's ToastProvider.
const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: ToastProvider });

// The selector reads the admin session — supply one without a SessionProvider.
// STABLE identity: the component refetches on [session] changes, so a fresh
// object per render loops it into infinite fetching.
const mockSession = {
  data: { user: { id: 'admin-user', role: 'admin' } },
  status: 'authenticated',
};
jest.mock('next-auth/react', () => ({
  useSession: () => mockSession,
}));

// The component also runs an AI-availability probe on mount; the real checker
// would share (and consume) the fetch mock, so pin it available.
jest.mock('@/lib/ai/availability-checker', () => ({
  AIAvailabilityChecker: {
    getInstance: () => ({ isAIEnabled: jest.fn().mockResolvedValue(true) }),
  },
}));

// The component validates the response content-type before parsing.
const jsonRes = (payload: unknown, ok = true, status = 200) => ({
  ok,
  status,
  statusText: '',
  headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? 'application/json' : null) },
  json: async () => payload,
});

// Mock fetch globally
global.fetch = jest.fn();

// Radix Select needs these DOM APIs that jsdom lacks
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
  (Element.prototype as any).hasPointerCapture = jest.fn(() => false);
  (Element.prototype as any).setPointerCapture = jest.fn();
  (Element.prototype as any).releasePointerCapture = jest.fn();
});

const mockSuccessResponse = {
  success: true,
  data: {
    byProvider: {
      openai: {
        provider: 'openai',
        configured: true,
        connected: true,
        availableModels: ['gpt-4o', 'gpt-4o-mini'],
        configuredModels: ['gpt-4o', 'gpt-4o-mini']
      },
      anthropic: {
        provider: 'anthropic',
        configured: true,
        connected: true,
        availableModels: ['claude-3-5-sonnet-20241022'],
        configuredModels: ['claude-3-5-sonnet-20241022']
      }
    },
    unified: [
      { id: 'gpt-4o', name: 'gpt-4o', provider: 'openai', available: true },
      { id: 'gpt-4o-mini', name: 'gpt-4o-mini', provider: 'openai', available: true },
      { id: 'claude-3-5-sonnet-20241022', name: 'claude-3-5-sonnet-20241022', provider: 'anthropic', available: true }
    ],
    summary: {
      totalProviders: 2,
      configuredProviders: 2,
      connectedProviders: 2,
      totalAvailableModels: 3,
      totalConfiguredModels: 3,
      availableForUse: 3
    },
    retrievedAt: new Date().toISOString()
  }
};

const mockErrorResponse = {
  success: false,
  error: {
    message: 'Failed to load models',
    code: 'LOAD_ERROR',
    details: 'Network error'
  }
};

const mockEmptyResponse = {
  success: true,
  data: {
    byProvider: {
      openai: {
        provider: 'openai',
        configured: false,
        connected: false,
        availableModels: [],
        configuredModels: []
      },
      anthropic: {
        provider: 'anthropic',
        configured: false,
        connected: false,
        availableModels: [],
        configuredModels: []
      }
    },
    unified: [],
    summary: {
      totalProviders: 2,
      configuredProviders: 0,
      connectedProviders: 0,
      totalAvailableModels: 0,
      totalConfiguredModels: 0,
      availableForUse: 0
    },
    retrievedAt: new Date().toISOString()
  }
};

describe('UnifiedModelSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state initially', () => {
    (fetch as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<UnifiedModelSelector />);
    
    expect(screen.getByText('Loading models...')).toBeInTheDocument();
  });

  it('loads and displays models successfully', async () => {
    (fetch as jest.Mock).mockResolvedValue(jsonRes(mockSuccessResponse));

    const mockOnValueChange = jest.fn();
    render(
      <UnifiedModelSelector 
        value=""
        onValueChange={mockOnValueChange}
        placeholder="Select a model..."
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select a model...')).toBeInTheDocument();
    });

    // Click to open dropdown
    fireEvent.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
      expect(screen.getByText('Anthropic')).toBeInTheDocument();
      expect(screen.getByText('gpt-4o')).toBeInTheDocument();
      expect(screen.getByText('claude-3-5-sonnet-20241022')).toBeInTheDocument();
    });
  });

  it('handles error state correctly', async () => {
    (fetch as jest.Mock).mockResolvedValue(jsonRes(mockErrorResponse));

    render(<UnifiedModelSelector />);

    await waitFor(() => {
      expect(screen.getByText('Error loading models')).toBeInTheDocument();
    });
  });

  it('handles empty state when no providers configured', async () => {
    (fetch as jest.Mock).mockResolvedValue(jsonRes(mockEmptyResponse));

    render(<UnifiedModelSelector />);

    await waitFor(() => {
      expect(screen.getByText('No AI providers configured')).toBeInTheDocument();
    });
  });

  it('shows refresh button when enabled', async () => {
    (fetch as jest.Mock).mockResolvedValue(jsonRes(mockSuccessResponse));

    const mockOnRefresh = jest.fn();
    render(
      <UnifiedModelSelector 
        showRefreshButton={true}
        onRefresh={mockOnRefresh}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  it('calls onRefresh when refresh button is clicked', async () => {
    (fetch as jest.Mock).mockResolvedValue(jsonRes(mockSuccessResponse));

    const mockOnRefresh = jest.fn();
    render(
      <UnifiedModelSelector 
        showRefreshButton={true}
        onRefresh={mockOnRefresh}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockOnRefresh).toHaveBeenCalled();
    });
  });

  it('calls onValueChange when model is selected', async () => {
    (fetch as jest.Mock).mockResolvedValue(jsonRes(mockSuccessResponse));

    const mockOnValueChange = jest.fn();
    render(
      <UnifiedModelSelector 
        value=""
        onValueChange={mockOnValueChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    // Click to open dropdown
    fireEvent.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByText('gpt-4o')).toBeInTheDocument();
    });

    // Select a model
    fireEvent.click(screen.getByText('gpt-4o'));

    expect(mockOnValueChange).toHaveBeenCalledWith('gpt-4o');
  });

  it('is disabled when disabled prop is true', async () => {
    (fetch as jest.Mock).mockResolvedValue(jsonRes(mockSuccessResponse));

    render(<UnifiedModelSelector disabled={true} />);

    await waitFor(() => {
      const combobox = screen.getByRole('combobox');
      expect(combobox).toBeDisabled();
    });
  });

  it('displays custom placeholder', async () => {
    (fetch as jest.Mock).mockResolvedValue(jsonRes(mockSuccessResponse));

    render(<UnifiedModelSelector placeholder="Custom placeholder..." />);

    await waitFor(() => {
      expect(screen.getByText('Custom placeholder...')).toBeInTheDocument();
    });
  });
});