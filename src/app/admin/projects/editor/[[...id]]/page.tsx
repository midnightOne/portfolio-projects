'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { EnhancedProjectEditor } from '@/components/admin/enhanced-project-editor';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Loader2 } from 'lucide-react';

interface UnifiedProjectEditorPageProps {
  params: Promise<{ id?: string[] }>;
}

export default function UnifiedProjectEditorPage({ params: paramsPromise }: UnifiedProjectEditorPageProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [params, setParams] = useState<{ id?: string[] }>({ id: undefined });

  // Extract project ID from params - it's either undefined (new) or the first element
  const projectId = params.id?.[0];
  const isEditing = !!projectId;

  // Resolve params promise
  useEffect(() => {
    paramsPromise.then(setParams);
  }, [paramsPromise]);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user || (session.user as any).role !== 'admin') {
      router.push('/admin/login');
      return;
    }

    setLoading(false);
  }, [session, status, router]);

  if (loading || status === 'loading') {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading editor...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <EnhancedProjectEditor 
        projectId={projectId}
        mode={isEditing ? 'edit' : 'create'}
      />
    </AdminLayout>
  );
}