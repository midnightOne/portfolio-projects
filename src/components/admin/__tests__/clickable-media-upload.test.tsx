/**
 * Test file for ClickableMediaUpload component
 * This verifies the component's functionality and modularity
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClickableMediaUpload } from '../clickable-media-upload';
import { MediaItem } from '@/lib/types/project';

// Mock the MediaSelectionModal
jest.mock('../media-selection-modal', () => ({
  MediaSelectionModal: ({ isOpen, onClose, onMediaSelect }: any) => (
    isOpen ? (
      <div data-testid="media-selection-modal">
        <button onClick={onClose}>Close</button>
        <button onClick={() => onMediaSelect({ id: 'test-media', url: 'test.jpg' })}>
          Select Media
        </button>
      </div>
    ) : null
  )
}));

const mockMediaItem: MediaItem = {
  id: 'test-media-1',
  projectId: 'test-project',
  type: 'IMAGE',
  url: 'https://example.com/test-image.jpg',
  thumbnailUrl: 'https://example.com/test-image-thumb.jpg',
  altText: 'Test Image',
  description: 'A test image',
  width: 800,
  height: 600,
  fileSize: BigInt(1024000),
  displayOrder: 0,
  createdAt: new Date('2023-01-01')
};

describe('ClickableMediaUpload', () => {
  const mockOnMediaSelect = jest.fn();
  const mockOnMediaRemove = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders empty state correctly', () => {
    render(
      <ClickableMediaUpload
        onMediaSelect={mockOnMediaSelect}
        onMediaRemove={mockOnMediaRemove}
      />
    );

    expect(screen.getByText('Click to select image')).toBeInTheDocument();
    expect(screen.getByText(/or drag and drop to upload directly/)).toBeInTheDocument();
  });

  it('renders current media correctly', () => {
    render(
      <ClickableMediaUpload
        currentMedia={mockMediaItem}
        onMediaSelect={mockOnMediaSelect}
        onMediaRemove={mockOnMediaRemove}
      />
    );

    const image = screen.getByRole('img');
    expect(image).toHaveAttribute('src', mockMediaItem.thumbnailUrl);
    expect(image).toHaveAttribute('alt', mockMediaItem.altText);
    expect(screen.getByText('Test Image (1000.0 KB)')).toBeInTheDocument();
  });

  it('opens media selection modal when clicked', async () => {
    render(
      <ClickableMediaUpload
        projectId="test-project"
        onMediaSelect={mockOnMediaSelect}
        onMediaRemove={mockOnMediaRemove}
      />
    );

    const uploadArea = screen.getByText('Click to select image').closest('div');
    fireEvent.click(uploadArea!);

    await waitFor(() => {
      expect(screen.getByTestId('media-selection-modal')).toBeInTheDocument();
    });
  });

  it('handles media selection from modal', async () => {
    render(
      <ClickableMediaUpload
        projectId="test-project"
        onMediaSelect={mockOnMediaSelect}
        onMediaRemove={mockOnMediaRemove}
      />
    );

    // Open modal
    const uploadArea = screen.getByText('Click to select image').closest('div');
    fireEvent.click(uploadArea!);

    await waitFor(() => {
      expect(screen.getByTestId('media-selection-modal')).toBeInTheDocument();
    });

    // Select media
    fireEvent.click(screen.getByText('Select Media'));

    expect(mockOnMediaSelect).toHaveBeenCalledWith({
      id: 'test-media',
      url: 'test.jpg'
    });
  });

  it('handles media removal', () => {
    render(
      <ClickableMediaUpload
        currentMedia={mockMediaItem}
        onMediaSelect={mockOnMediaSelect}
        onMediaRemove={mockOnMediaRemove}
      />
    );

    // Hover to show buttons
    const mediaContainer = screen.getByRole('img').closest('div');
    fireEvent.mouseEnter(mediaContainer!);

    const removeButton = screen.getByText('Remove');
    fireEvent.click(removeButton);

    expect(mockOnMediaRemove).toHaveBeenCalled();
  });

  it('applies custom aspect ratio classes', () => {
    const { rerender } = render(
      <ClickableMediaUpload
        aspectRatio="square"
        onMediaSelect={mockOnMediaSelect}
        onMediaRemove={mockOnMediaRemove}
      />
    );

    let uploadArea = screen.getByText('Click to select image').closest('div');
    expect(uploadArea).toHaveClass('aspect-square');

    rerender(
      <ClickableMediaUpload
        aspectRatio="16:9"
        onMediaSelect={mockOnMediaSelect}
        onMediaRemove={mockOnMediaRemove}
      />
    );

    uploadArea = screen.getByText('Click to select image').closest('div');
    expect(uploadArea).toHaveClass('aspect-video');
  });

  it('displays custom placeholder when provided', () => {
    const customPlaceholder = <div>Custom Upload Area</div>;

    render(
      <ClickableMediaUpload
        placeholder={customPlaceholder}
        onMediaSelect={mockOnMediaSelect}
        onMediaRemove={mockOnMediaRemove}
      />
    );

    expect(screen.getByText('Custom Upload Area')).toBeInTheDocument();
    expect(screen.queryByText('Click to select image')).not.toBeInTheDocument();
  });

  it('displays error message when provided', () => {
    render(
      <ClickableMediaUpload
        error="Upload failed"
        onMediaSelect={mockOnMediaSelect}
        onMediaRemove={mockOnMediaRemove}
      />
    );

    expect(screen.getByText('Upload failed')).toBeInTheDocument();
    expect(screen.getByText('Upload failed')).toHaveClass('text-red-600');
  });

  it('handles drag and drop events', () => {
    const mockOnDirectUpload = jest.fn().mockResolvedValue(mockMediaItem);

    render(
      <ClickableMediaUpload
        onMediaSelect={mockOnMediaSelect}
        onMediaRemove={mockOnMediaRemove}
        onDirectUpload={mockOnDirectUpload}
      />
    );

    const uploadArea = screen.getByText('Click to select image').closest('div');
    
    // Test drag over
    fireEvent.dragOver(uploadArea!, {
      dataTransfer: { files: [] }
    });
    expect(uploadArea).toHaveClass('border-blue-500');

    // Test drag leave
    fireEvent.dragLeave(uploadArea!);
    expect(uploadArea).not.toHaveClass('border-blue-500');
  });

  it('validates file types correctly', async () => {
    const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    
    render(
      <ClickableMediaUpload
        onMediaSelect={mockOnMediaSelect}
        onMediaRemove={mockOnMediaRemove}
        onError={mockOnError}
        acceptedTypes={['image/jpeg', 'image/png']}
      />
    );

    const uploadArea = screen.getByText('Click to select image').closest('div');
    
    fireEvent.drop(uploadArea!, {
      dataTransfer: { files: [mockFile] }
    });

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid file type')
      );
    });
  });

  it('validates file size correctly', async () => {
    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', { 
      type: 'image/jpeg' 
    });
    
    render(
      <ClickableMediaUpload
        onMediaSelect={mockOnMediaSelect}
        onMediaRemove={mockOnMediaRemove}
        onError={mockOnError}
        maxSize={10 * 1024 * 1024} // 10MB
      />
    );

    const uploadArea = screen.getByText('Click to select image').closest('div');
    
    fireEvent.drop(uploadArea!, {
      dataTransfer: { files: [largeFile] }
    });

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(
        expect.stringContaining('File too large')
      );
    });
  });
});