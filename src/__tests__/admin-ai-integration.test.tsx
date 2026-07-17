/**
 * Admin AI Integration Tests
 *
 * The AdminSidebar groups admin pages by task: Overview, Site Content,
 * Media, AI Assistant, Knowledge Base, Access & Safety, Insights &
 * Monitoring, and Developer Tools. Groups are collapsible; a group is
 * open when marked defaultExpanded or when it owns the current route.
 * This suite covers the sidebar's structure and active-state logic.
 */

import React from 'react';
import { render as rtlRender, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';

// AdminSidebar is built on the shadcn sidebar primitives, which require the
// SidebarProvider context.
const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: SidebarProvider });

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
}));

// Mock NextAuth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));

// Mock admin projects hook
jest.mock('@/hooks/use-admin-projects', () => ({
  useAdminProjects: jest.fn(() => ({
    projects: [],
    loading: false
  }))
}));

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
};

const mockSession = {
  user: {
    id: 'admin-user',
    email: 'admin@example.com',
    role: 'admin'
  }
};

describe('Admin AI Integration', () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useSession as jest.Mock).mockReturnValue({
      data: mockSession,
      status: 'authenticated'
    });

    require('next/navigation').usePathname.mockReturnValue('/admin/ai');

    jest.clearAllMocks();
  });

  describe('AdminSidebar structure', () => {
    it('should render every navigation group label', () => {
      render(<AdminSidebar />);

      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Site Content')).toBeInTheDocument();
      expect(screen.getByText('Media')).toBeInTheDocument();
      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
      expect(screen.getByText('Knowledge Base')).toBeInTheDocument();
      expect(screen.getByText('Access & Safety')).toBeInTheDocument();
      expect(screen.getByText('Insights & Monitoring')).toBeInTheDocument();
      expect(screen.getByText('Developer Tools')).toBeInTheDocument();
    });

    it('should open the AI Assistant group when an AI route is active and link AI Settings to /admin/ai', () => {
      render(<AdminSidebar />);

      const aiSettingsLink = screen.getByRole('link', { name: /AI Settings/ });
      expect(aiSettingsLink).toHaveAttribute('href', '/admin/ai');
    });

    it('should show default-expanded groups but keep inactive groups collapsed', () => {
      render(<AdminSidebar />);

      // Overview / Site Content / Media are defaultExpanded
      expect(screen.getByRole('link', { name: /^Dashboard$/ })).toHaveAttribute('href', '/admin');
      expect(screen.getByRole('link', { name: /Homepage/ })).toHaveAttribute('href', '/admin/homepage');
      // Insights & Monitoring is closed on /admin/ai, so its items are not rendered
      expect(screen.queryByRole('link', { name: /Performance/ })).not.toBeInTheDocument();
    });

    it('should open the group owning the active route on render', () => {
      require('next/navigation').usePathname.mockReturnValue('/admin/performance');
      render(<AdminSidebar />);

      const performanceLink = screen.getByRole('link', { name: /Performance/ });
      expect(performanceLink).toHaveAttribute('href', '/admin/performance');
      // AI Assistant group stays collapsed
      expect(screen.queryByRole('link', { name: /AI Settings/ })).not.toBeInTheDocument();
    });

    it('places chunking controls in the Knowledge Base group', () => {
      require('next/navigation').usePathname.mockReturnValue('/admin/semantic/config');
      render(<AdminSidebar />);

      expect(screen.getByRole('link', { name: /Semantic Dashboard/ }))
        .toHaveAttribute('href', '/admin/semantic');
      expect(screen.getByRole('link', { name: /Chunking Configuration/ }))
        .toHaveAttribute('href', '/admin/semantic/config');
      expect(screen.queryByRole('link', { name: /AI Settings/ })).not.toBeInTheDocument();
    });
  });
});
