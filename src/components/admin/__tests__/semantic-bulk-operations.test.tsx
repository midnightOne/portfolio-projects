import { render, screen } from '@testing-library/react';
import { SemanticBulkOperations } from '../semantic-bulk-operations';

const getSearchParam = jest.fn();

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: getSearchParam }),
}));

describe('SemanticBulkOperations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens the operation selected by the semantic dashboard deep link', () => {
    getSearchParam.mockImplementation((name: string) => name === 'tab' ? 'export' : null);

    render(<SemanticBulkOperations />);

    expect(screen.getByRole('heading', { name: 'Export Semantic Indexes' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Cleanup Orphaned Chunks' })).not.toBeInTheDocument();
  });

  it('falls back to cleanup for an unsupported tab', () => {
    getSearchParam.mockReturnValue('unknown');

    render(<SemanticBulkOperations />);

    expect(screen.getByRole('heading', { name: 'Cleanup Orphaned Chunks' })).toBeInTheDocument();
  });
});
