/**
 * Admin Performance Dashboard Page
 * Displays comprehensive performance metrics and monitoring
 */

import { Metadata } from 'next';
import { PerformanceDashboard } from '@/components/admin/performance-dashboard';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminPageLayout } from '@/components/admin/admin-page-layout';

export const metadata: Metadata = {
  title: 'Performance Dashboard - Portfolio Admin',
  description: 'Monitor and analyze application performance metrics',
};

export default function PerformancePage() {
  return (
    <AdminLayout>
      <AdminPageLayout
        title="Performance Dashboard"
        description="Monitor application performance, database queries, and system health"
      >
        <PerformanceDashboard />
      </AdminPageLayout>
    </AdminLayout>
  );
}