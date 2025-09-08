'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminPageLayout } from '@/components/admin/admin-page-layout';
import { VoiceDebugInterface } from '@/components/admin/VoiceDebugInterface';
import { AdminDebugTest } from '@/components/admin/AdminDebugTest';

export default function VoiceDebugPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user || (session.user as any)?.role !== 'admin') {
      router.push('/admin/login');
      return;
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <AdminLayout>
        <AdminPageLayout
          title="Voice Debug & Testing"
          description="Test and debug voice AI functionality"
          breadcrumbs={[
            { label: "Dashboard", href: "/admin" },
            { label: "AI Assistant", href: "/admin/ai" },
            { label: "Voice Debug", href: "/admin/ai/voice-debug" }
          ]}
        >
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p>Loading...</p>
            </div>
          </div>
        </AdminPageLayout>
      </AdminLayout>
    );
  }

  if (!session?.user || (session.user as any)?.role !== 'admin') {
    return null;
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Voice Debug & Testing"
        description="Test and debug real voice AI functionality with OpenAI Realtime and ElevenLabs"
        breadcrumbs={[
          { label: "Dashboard", href: "/admin" },
          { label: "AI Assistant", href: "/admin/ai" },
          { label: "Voice Debug", href: "/admin/ai/voice-debug" }
        ]}
      >
        <div className="space-y-8">
          <AdminDebugTest />
          <VoiceDebugInterface />
        </div>
      </AdminPageLayout>
    </AdminLayout>
  );
}