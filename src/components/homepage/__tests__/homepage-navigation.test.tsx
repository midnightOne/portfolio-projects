import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { Homepage } from '../homepage';
import { MainNavigation } from '@/components/layout/main-navigation';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(() => '/'),
}));

// Mock useProjects hook
jest.mock('@/hooks/use-projects', () => ({
  useProjects: jest.fn(() => ({
    projects: [],
    tags: [],
    loading: false
  }))
}));

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    header: ({ children, ...props }: any) => <header {...props}>{children}</header>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    section: ({ children, ...props }: any) => <section {...props}>{children}</section>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
    h2: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
  },
  AnimatePresence: ({ children }: any) => children,
  useReducedMotion: () => false,
}));

// Mock scroll behavior
const mockScrollIntoView = jest.fn();
Object.defineProperty(Element.prototype, 'scrollIntoView', {
  value: mockScrollIntoView,
  writable: true,
});

describe('Homepage Navigation', () => {
  const mockPush = jest.fn();
  
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
    mockScrollIntoView.mockClear();
    mockPush.mockClear();
  });

  it('renders homepage with navigation', () => {
    render(
      <div>
        <MainNavigation />
        <Homepage />
      </div>
    );

    // Check if navigation is rendered
    expect(screen.getByText('Portfolio')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();

    // Check if homepage sections are rendered
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Full Stack Developer')).toBeInTheDocument();
    expect(screen.getByText('About Me')).toBeInTheDocument();
    expect(screen.getByText('Featured Projects')).toBeInTheDocument();
    expect(screen.getByText('Get In Touch')).toBeInTheDocument();
  });

  it('handles navigation to projects page', () => {
    render(
      <div>
        <MainNavigation />
        <Homepage />
      </div>
    );

    const projectsLink = screen.getByText('Projects');
    fireEvent.click(projectsLink);

    expect(mockPush).toHaveBeenCalledWith('/projects');
  });

  it('handles smooth scrolling to sections', async () => {
    // Mock querySelector to return elements with scrollIntoView
    const mockElement = { scrollIntoView: mockScrollIntoView };
    jest.spyOn(document, 'querySelector').mockReturnValue(mockElement as any);

    render(
      <div>
        <MainNavigation />
        <Homepage />
      </div>
    );

    const aboutLink = screen.getByText('About');
    fireEvent.click(aboutLink);

    await waitFor(() => {
      expect(document.querySelector).toHaveBeenCalledWith('[data-section-id="about-main"]');
      expect(mockScrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start'
      });
    });
  });

  it('renders sections with correct IDs for navigation', () => {
    render(<Homepage />);

    // Check if sections have the correct data attributes
    const heroSection = screen.getByText('John Doe').closest('[data-section-type="hero"]');
    const aboutSection = screen.getByText('About Me').closest('[data-section-type="about"]');
    const projectsSection = screen.getByText('Featured Projects').closest('[data-section-type="projects"]');
    const contactSection = screen.getByText('Get In Touch').closest('[data-section-type="contact"]');

    expect(heroSection).toHaveAttribute('data-section-id', 'hero-main');
    expect(aboutSection).toHaveAttribute('data-section-id', 'about-main');
    expect(projectsSection).toHaveAttribute('data-section-id', 'projects-main');
    expect(contactSection).toHaveAttribute('data-section-id', 'contact-main');
  });

  it('handles CTA button click in hero section', async () => {
    const mockElement = { scrollIntoView: mockScrollIntoView };
    jest.spyOn(document, 'querySelector').mockReturnValue(mockElement as any);

    render(<Homepage />);

    const ctaButton = screen.getByText('View My Work');
    fireEvent.click(ctaButton);

    await waitFor(() => {
      expect(document.querySelector).toHaveBeenCalledWith('[data-section-id="projects-main"]');
      expect(mockScrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start'
      });
    });
  });

  it('renders responsive design classes', () => {
    render(<Homepage />);

    // Check if the main container has responsive classes
    const mainContainer = screen.getByText('John Doe').closest('.min-h-screen');
    expect(mainContainer).toBeInTheDocument();

    // Check if sections have scroll margin for fixed navigation
    const heroSection = screen.getByText('John Doe').closest('[data-section-type="hero"]');
    expect(heroSection).toHaveClass('scroll-mt-16');
  });
});