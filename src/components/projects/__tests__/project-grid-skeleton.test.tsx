import { render } from '@testing-library/react';
import { ProjectGridSkeleton } from '../project-grid-skeleton';

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

describe('ProjectGridSkeleton', () => {
  it('should render default number of skeleton cards', () => {
    const { container } = render(<ProjectGridSkeleton />);
    
    // Should render 6 skeleton cards by default
    const gridContainer = container.firstChild as HTMLElement;
    expect(gridContainer.children.length).toBe(6);
  });

  it('should render custom number of skeleton cards', () => {
    const { container } = render(<ProjectGridSkeleton count={3} />);
    
    // Should render 3 skeleton cards
    const gridContainer = container.firstChild as HTMLElement;
    expect(gridContainer.children.length).toBe(3);
  });

  it('should render with proper grid layout classes', () => {
    const { container } = render(<ProjectGridSkeleton />);
    
    const gridContainer = container.firstChild as HTMLElement;
    expect(gridContainer).toHaveClass('grid');
    expect(gridContainer).toHaveClass('grid-cols-1');
    expect(gridContainer).toHaveClass('sm:grid-cols-2');
    expect(gridContainer).toHaveClass('lg:grid-cols-3');
    expect(gridContainer).toHaveClass('xl:grid-cols-4');
  });

  it('should render skeleton elements with proper structure', () => {
    const { container } = render(<ProjectGridSkeleton count={1} />);
    
    // Should have card structure
    const gridContainer = container.firstChild as HTMLElement;
    const card = gridContainer.firstChild;
    expect(card).toBeInTheDocument();
  });

  it('should handle showStaggered prop', () => {
    const { container } = render(<ProjectGridSkeleton count={2} showStaggered={false} />);
    
    const gridContainer = container.firstChild as HTMLElement;
    expect(gridContainer.children.length).toBe(2);
  });
});