"use client";

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LoadingIndicatorProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  message?: string;
  showMessage?: boolean;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export function LoadingIndicator({ 
  size = 'md', 
  className,
  message,
  showMessage = true 
}: LoadingIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <motion.div
        className={cn(
          "border-2 border-primary border-t-transparent rounded-full",
          sizeClasses[size]
        )}
        animate={{ rotate: 360 }}
        transition={{ 
          duration: 1, 
          repeat: Infinity, 
          ease: "linear" 
        }}
      />
      {showMessage && message && (
        <motion.span 
          className="text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {message}
        </motion.span>
      )}
    </div>
  );
}

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  className?: string;
}

export function LoadingOverlay({ 
  isVisible, 
  message = "Loading...", 
  className 
}: LoadingOverlayProps) {
  if (!isVisible) return null;

  return (
    <motion.div
      className={cn(
        "absolute inset-0 bg-background/80 backdrop-blur-sm",
        "flex items-center justify-center z-50",
        className
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="text-center">
        <LoadingIndicator size="lg" message={message} />
      </div>
    </motion.div>
  );
}

interface ProgressiveLoadingBarProps {
  progress: number; // 0-100
  className?: string;
  showPercentage?: boolean;
}

export function ProgressiveLoadingBar({ 
  progress, 
  className,
  showPercentage = false 
}: ProgressiveLoadingBarProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          transition={{ 
            duration: 0.5, 
            ease: [0.21, 1.11, 0.81, 0.99] 
          }}
        />
      </div>
      {showPercentage && (
        <div className="text-xs text-muted-foreground mt-1 text-center">
          {Math.round(progress)}%
        </div>
      )}
    </div>
  );
}

interface AsyncOperationIndicatorProps {
  isLoading: boolean;
  operation: string;
  success?: boolean;
  error?: string;
  className?: string;
}

export function AsyncOperationIndicator({
  isLoading,
  operation,
  success,
  error,
  className
}: AsyncOperationIndicatorProps) {
  if (!isLoading && !success && !error) return null;

  return (
    <motion.div
      className={cn("flex items-center gap-2 text-sm", className)}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      {isLoading && (
        <>
          <LoadingIndicator size="sm" showMessage={false} />
          <span className="text-muted-foreground">{operation}...</span>
        </>
      )}
      
      {success && !isLoading && (
        <>
          <motion.div
            className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <motion.div
              className="w-2 h-1 bg-white rounded-full"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.2 }}
            />
          </motion.div>
          <span className="text-green-600 font-medium">{operation} completed</span>
        </>
      )}
      
      {error && !isLoading && (
        <>
          <motion.div
            className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <motion.div
              className="w-2 h-2 bg-white rounded-full"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
            />
          </motion.div>
          <span className="text-red-600">{error}</span>
        </>
      )}
    </motion.div>
  );
}

interface ButtonLoadingStateProps {
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: string;
  className?: string;
}

export function ButtonLoadingState({
  isLoading,
  children,
  loadingText,
  className
}: ButtonLoadingStateProps) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      {isLoading && <LoadingIndicator size="sm" showMessage={false} />}
      {isLoading && loadingText ? loadingText : children}
    </span>
  );
}