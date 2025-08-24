"use client";

import { useState, useCallback } from 'react';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
}

let toastCount = 0;

// Simple toast implementation
const toastState: ToastState = {
  toasts: []
};

const listeners: Array<(state: ToastState) => void> = [];

function dispatch(action: { type: string; toast?: Toast; toastId?: string }) {
  switch (action.type) {
    case 'ADD_TOAST':
      if (action.toast) {
        toastState.toasts = [...toastState.toasts, action.toast];
      }
      break;
    case 'REMOVE_TOAST':
      if (action.toastId) {
        toastState.toasts = toastState.toasts.filter(t => t.id !== action.toastId);
      }
      break;
    case 'DISMISS_TOAST':
      if (action.toastId) {
        toastState.toasts = toastState.toasts.map(t =>
          t.id === action.toastId ? { ...t, open: false } : t
        );
      }
      break;
  }

  listeners.forEach(listener => listener(toastState));
}

function toast({
  title,
  description,
  variant = 'default',
  duration = 5000,
  ...props
}: Omit<Toast, 'id'>) {
  const id = (++toastCount).toString();

  const newToast: Toast = {
    id,
    title,
    description,
    variant,
    duration,
    ...props
  };

  dispatch({ type: 'ADD_TOAST', toast: newToast });

  // Auto-dismiss after duration
  if (duration > 0) {
    setTimeout(() => {
      dispatch({ type: 'REMOVE_TOAST', toastId: id });
    }, duration);
  }

  return {
    id,
    dismiss: () => dispatch({ type: 'REMOVE_TOAST', toastId: id }),
    update: (updates: Partial<Toast>) => {
      dispatch({
        type: 'ADD_TOAST',
        toast: { ...newToast, ...updates }
      });
    }
  };
}

export function useToast() {
  const [state, setState] = useState<ToastState>(toastState);

  const subscribe = useCallback((listener: (state: ToastState) => void) => {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  // Subscribe to state changes
  useState(() => {
    const unsubscribe = subscribe(setState);
    return unsubscribe;
  });

  return {
    toast,
    toasts: state.toasts,
    dismiss: (toastId: string) => dispatch({ type: 'REMOVE_TOAST', toastId })
  };
}