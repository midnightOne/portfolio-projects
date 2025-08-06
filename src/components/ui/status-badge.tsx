/**
 * Status Badge Component
 * 
 * Enhanced badges for showing connection and configuration states
 */

'use client';

import React from 'react';
import { CheckCircle, AlertCircle, Clock, Loader2, Wifi, WifiOff, Settings, X } from 'lucide-react';
import { Badge } from './badge';
import { cn } from '@/lib/utils';

export type StatusType = 
  | 'connected' 
  | 'disconnected' 
  | 'connecting' 
  | 'configured' 
  | 'not-configured' 
  | 'testing' 
  | 'success' 
  | 'error' 
  | 'warning' 
  | 'pending';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  showIcon = true,
  size = 'md',
  className = ''
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          variant: 'default' as const,
          icon: CheckCircle,
          color: 'text-green-500',
          bgColor: 'bg-green-50 border-green-200',
          defaultLabel: 'Connected'
        };
      case 'disconnected':
        return {
          variant: 'destructive' as const,
          icon: WifiOff,
          color: 'text-red-500',
          bgColor: 'bg-red-50 border-red-200',
          defaultLabel: 'Disconnected'
        };
      case 'connecting':
      case 'testing':
        return {
          variant: 'secondary' as const,
          icon: Loader2,
          color: 'text-blue-500',
          bgColor: 'bg-blue-50 border-blue-200',
          defaultLabel: status === 'connecting' ? 'Connecting...' : 'Testing...',
          animate: true
        };
      case 'configured':
        return {
          variant: 'default' as const,
          icon: Settings,
          color: 'text-green-500',
          bgColor: 'bg-green-50 border-green-200',
          defaultLabel: 'Configured'
        };
      case 'not-configured':
        return {
          variant: 'secondary' as const,
          icon: Settings,
          color: 'text-gray-500',
          bgColor: 'bg-gray-50 border-gray-200',
          defaultLabel: 'Not Configured'
        };
      case 'success':
        return {
          variant: 'default' as const,
          icon: CheckCircle,
          color: 'text-green-500',
          bgColor: 'bg-green-50 border-green-200',
          defaultLabel: 'Success'
        };
      case 'error':
        return {
          variant: 'destructive' as const,
          icon: X,
          color: 'text-red-500',
          bgColor: 'bg-red-50 border-red-200',
          defaultLabel: 'Error'
        };
      case 'warning':
        return {
          variant: 'secondary' as const,
          icon: AlertCircle,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-50 border-yellow-200',
          defaultLabel: 'Warning'
        };
      case 'pending':
        return {
          variant: 'secondary' as const,
          icon: Clock,
          color: 'text-gray-500',
          bgColor: 'bg-gray-50 border-gray-200',
          defaultLabel: 'Pending'
        };
      default:
        return {
          variant: 'secondary' as const,
          icon: AlertCircle,
          color: 'text-gray-500',
          bgColor: 'bg-gray-50 border-gray-200',
          defaultLabel: 'Unknown'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  const displayLabel = label || config.defaultLabel;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4'
  };

  return (
    <Badge
      variant={config.variant}
      className={cn(
        'inline-flex items-center gap-1.5 font-medium',
        sizeClasses[size],
        config.bgColor,
        className
      )}
    >
      {showIcon && (
        <Icon 
          className={cn(
            iconSizes[size],
            config.color,
            config.animate && 'animate-spin'
          )} 
        />
      )}
      {displayLabel}
    </Badge>
  );
};

interface ConnectionStatusProps {
  isConnected: boolean;
  isTesting?: boolean;
  label?: string;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected,
  isTesting = false,
  label,
  className = ''
}) => {
  if (isTesting) {
    return (
      <StatusBadge
        status="testing"
        label={label || 'Testing connection...'}
        className={className}
      />
    );
  }

  return (
    <StatusBadge
      status={isConnected ? 'connected' : 'disconnected'}
      label={label}
      className={className}
    />
  );
};

interface ConfigurationStatusProps {
  isConfigured: boolean;
  label?: string;
  className?: string;
}

export const ConfigurationStatus: React.FC<ConfigurationStatusProps> = ({
  isConfigured,
  label,
  className = ''
}) => {
  return (
    <StatusBadge
      status={isConfigured ? 'configured' : 'not-configured'}
      label={label}
      className={className}
    />
  );
};

interface ModelCountBadgeProps {
  count: number;
  total?: number;
  className?: string;
}

export const ModelCountBadge: React.FC<ModelCountBadgeProps> = ({
  count,
  total,
  className = ''
}) => {
  const status: StatusType = count > 0 ? 'success' : 'warning';
  const label = total ? `${count}/${total} models` : `${count} models`;

  return (
    <StatusBadge
      status={status}
      label={label}
      showIcon={false}
      className={className}
    />
  );
};

export default StatusBadge;