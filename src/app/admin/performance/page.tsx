/**
 * Admin Performance Dashboard Page
 * Displays comprehensive performance metrics and monitoring
 */

import { Metadata } from 'next';
import { PerformanceDashboard } from '@/components/admin/performance-dashboard';

export const metadata: Metadata = {
  title: 'Performance Dashboard - Portfolio Admin',
  description: 'Monitor and analyze application performance metrics',
};

export default function PerformancePage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Performance Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Monitor application performance, database queries, and system health
        </p>
      </div>
      
      <PerformanceDashboard />
    </div>
  );
}