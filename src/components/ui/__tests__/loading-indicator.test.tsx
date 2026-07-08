import { render, screen } from '@testing-library/react';
import { LoadingIndicator, LoadingOverlay, ProgressiveLoadingBar } from '../loading-indicator';

// Mock framer-motion: Proxy passthrough — ANY motion.<tag> renders the plain
// element (per-tag partial mocks broke on tags like motion.h3 in empty states).
jest.mock("framer-motion", () => {
  const React = require("react");
  const motion = new Proxy({}, {
    get: (_t, tag) => ({ children, ...props }: any) => React.createElement(String(tag), props, children),
  });
  return {
    motion,
    AnimatePresence: ({ children }: any) => children,
    useReducedMotion: () => false,
  };
});

describe('LoadingIndicator', () => {
  it('should render with default props', () => {
    render(<LoadingIndicator />);
    
    // Query by the spinner's distinctive classes — role 'generic' matches
    // every div in the tree.
    const spinner = document.querySelector('.border-t-transparent');
    expect(spinner).toHaveClass('w-6', 'h-6');
  });

  it('should render with custom size', () => {
    render(<LoadingIndicator size="lg" />);
    
    const spinner = document.querySelector('.border-t-transparent');
    expect(spinner).toHaveClass('w-8', 'h-8');
  });

  it('should render with message when showMessage is true', () => {
    render(<LoadingIndicator message="Loading data..." showMessage={true} />);
    
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  it('should not render message when showMessage is false', () => {
    render(<LoadingIndicator message="Loading data..." showMessage={false} />);
    
    expect(screen.queryByText('Loading data...')).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<LoadingIndicator className="custom-class" />);
    
    const container = document.querySelector('.custom-class');
    expect(container).toBeInTheDocument();
    expect(container!.querySelector('.border-t-transparent')).toBeInTheDocument();
  });
});

describe('LoadingOverlay', () => {
  it('should render when visible', () => {
    render(<LoadingOverlay isVisible={true} message="Loading..." />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should not render when not visible', () => {
    render(<LoadingOverlay isVisible={false} message="Loading..." />);
    
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('should render with default message', () => {
    render(<LoadingOverlay isVisible={true} />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<LoadingOverlay isVisible={true} className="custom-overlay" />);
    
    // The class lands on the outer overlay, not the closest ancestor div
    expect(document.querySelector('.custom-overlay')).toBeInTheDocument();
  });
});

describe('ProgressiveLoadingBar', () => {
  it('should render with correct progress', () => {
    render(<ProgressiveLoadingBar progress={50} />);
    
    // The filled bar carries bg-primary inside the track
    expect(document.querySelector('.bg-primary')).toBeInTheDocument();
  });

  it('should show percentage when showPercentage is true', () => {
    render(<ProgressiveLoadingBar progress={75} showPercentage={true} />);
    
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('should not show percentage when showPercentage is false', () => {
    render(<ProgressiveLoadingBar progress={75} showPercentage={false} />);
    
    expect(screen.queryByText('75%')).not.toBeInTheDocument();
  });

  it('should handle progress values outside 0-100 range', () => {
    render(<ProgressiveLoadingBar progress={150} showPercentage={true} />);
    
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('should handle negative progress values', () => {
    render(<ProgressiveLoadingBar progress={-10} showPercentage={true} />);
    
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<ProgressiveLoadingBar progress={50} className="custom-progress" />);
    
    expect(document.querySelector('.custom-progress')).toBeInTheDocument();
  });
});