/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ToastProvider, useToast } from '../toast';

// Test component that uses the toast hook
const TestComponent = () => {
  const toast = useToast();

  return (
    <div>
      <button onClick={() => toast.success('Success', 'This is a success message')}>
        Success Toast
      </button>
      <button onClick={() => toast.error('Error', 'This is an error message')}>
        Error Toast
      </button>
      <button onClick={() => toast.warning('Warning', 'This is a warning message')}>
        Warning Toast
      </button>
      <button onClick={() => toast.info('Info', 'This is an info message')}>
        Info Toast
      </button>
    </div>
  );
};

describe('Toast System', () => {
  const renderWithProvider = (component: React.ReactElement) => {
    return render(
      <ToastProvider>
        {component}
      </ToastProvider>
    );
  };

  it('should display success toast', async () => {
    renderWithProvider(<TestComponent />);
    
    fireEvent.click(screen.getByText('Success Toast'));
    
    await waitFor(() => {
      expect(screen.getByText('Success')).toBeInTheDocument();
      expect(screen.getByText('This is a success message')).toBeInTheDocument();
    });
  });

  it('should display error toast', async () => {
    renderWithProvider(<TestComponent />);
    
    fireEvent.click(screen.getByText('Error Toast'));
    
    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('This is an error message')).toBeInTheDocument();
    });
  });

  it('should display warning toast', async () => {
    renderWithProvider(<TestComponent />);
    
    fireEvent.click(screen.getByText('Warning Toast'));
    
    await waitFor(() => {
      expect(screen.getByText('Warning')).toBeInTheDocument();
      expect(screen.getByText('This is a warning message')).toBeInTheDocument();
    });
  });

  it('should display info toast', async () => {
    renderWithProvider(<TestComponent />);
    
    fireEvent.click(screen.getByText('Info Toast'));
    
    await waitFor(() => {
      expect(screen.getByText('Info')).toBeInTheDocument();
      expect(screen.getByText('This is an info message')).toBeInTheDocument();
    });
  });

  it('should allow toast dismissal', async () => {
    renderWithProvider(<TestComponent />);
    
    fireEvent.click(screen.getByText('Success Toast'));
    
    await waitFor(() => {
      expect(screen.getByText('Success')).toBeInTheDocument();
    });

    // Find and click the close button
    const closeButton = screen.getByRole('button', { name: '' }); // X button has no text
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText('Success')).not.toBeInTheDocument();
    });
  });

  it('should auto-dismiss toasts after duration', async () => {
    jest.useFakeTimers();
    
    renderWithProvider(<TestComponent />);
    
    fireEvent.click(screen.getByText('Success Toast'));
    
    await waitFor(() => {
      expect(screen.getByText('Success')).toBeInTheDocument();
    });

    // Fast-forward time by 5 seconds (default duration)
    jest.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(screen.queryByText('Success')).not.toBeInTheDocument();
    });

    jest.useRealTimers();
  });
});