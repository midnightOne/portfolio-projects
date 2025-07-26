import { render, screen } from '@testing-library/react';
import { LoadingIndicator, LoadingOverlay, ProgressiveLoadingBar } from '../loading-indicator';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
}));

describe('LoadingIndicator', () => {
  it('should render with default props', () => {
    render(<LoadingIndicator />);
    
    const spinner = screen.getByRole('generic');
    expect(spinner).toHaveClass('w-6', 'h-6');
  });

  it('should render with custom size', () => {
    render(<LoadingIndicator size="lg" />);
    
    const spinner = screen.getByRole('generic');
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
    
    const container = screen.getByRole('generic').parentElement;
    expect(container).toHaveClass('custom-class');
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
    
    const overlay = screen.getByText('Loading...').closest('div');
    expect(overlay).toHaveClass('custom-overlay');
  });
});

describe('ProgressiveLoadingBar', () => {
  it('should render with correct progress', () => {
    render(<ProgressiveLoadingBar progress={50} />);
    
    // The progress bar should be rendered
    const progressBar = screen.getByRole('generic');
    expect(progressBar).toBeInTheDocument();
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
    
    const container = screen.getByRole('generic').parentElement;
    expect(container).toHaveClass('custom-progress');
  });
});