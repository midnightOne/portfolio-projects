'use client';

/**
 * Pill Visuals playground page (ui-system task 3.8 — the subsystem's one D16
 * admin playground). Route is middleware-gated (/admin/*) with the standard
 * belt-and-suspenders client role check.
 */

import React, { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminPageLayout } from '@/components/admin/admin-page-layout';
import { PillVisualsPlayground } from '@/components/admin/pill-visuals-playground';

export default function PillVisualsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user || (session.user as { role?: string })?.role !== 'admin') {
      router.push('/admin/login');
    }
  }, [session, status, router]);

  const breadcrumbs = [
    { label: 'Dashboard', href: '/admin' },
    { label: 'AI Assistant', href: '/admin/ai' },
    { label: 'Pill Visuals', href: '/admin/ai/pill-visuals' },
  ];

  if (status === 'loading') {
    return (
      <AdminLayout>
        <AdminPageLayout
          title="Pill Visuals"
          description="Live-tweak the liquid pill's edge, gradient, breathing, and morph timing"
          breadcrumbs={breadcrumbs}
        >
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </AdminPageLayout>
      </AdminLayout>
    );
  }

  if (!session?.user || (session.user as { role?: string })?.role !== 'admin') {
    return null;
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Pill Visuals"
        description="Live-tweak the liquid pill's edge, gradient, breathing, and morph timing (ui-system 3.8)"
        breadcrumbs={breadcrumbs}
      >
        <PillVisualsPlayground />
      </AdminPageLayout>
    </AdminLayout>
  );
}
