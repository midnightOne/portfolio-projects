/**
 * Admin AI Integration Tests
 *
 * The AdminSidebar's AI section now carries a single "AI Settings" entry —
 * the AI admin subpages (voice config, conversations, voice-debug, …) hang
 * off /admin/ai with their own in-page navigation, not the sidebar. This
 * suite covers the sidebar's current structure and active-state logic.
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

  describe('AdminSidebar AI Section', () => {
    it('should render the AI Assistant section with its settings entry', () => {
      render(<AdminSidebar />);

      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
      expect(screen.getByText('AI Settings')).toBeInTheDocument();
    });

    it('should link AI Settings to /admin/ai', () => {
      render(<AdminSidebar />);

      const aiSettingsLink = screen.getByRole('link', { name: /AI Settings/ });
      expect(aiSettingsLink).toHaveAttribute('href', '/admin/ai');
    });

    it('should render the other admin sections around the AI section', () => {
      render(<AdminSidebar />);

      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Homepage')).toBeInTheDocument();
      expect(screen.getByText('Media Library')).toBeInTheDocument();
    });
  });
});
