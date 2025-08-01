'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { UnifiedProjectEditor } from '@/components/admin/unified-project-editor';
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <UnifiedProjectEditor 
        projectId={projectId}
        mode={isEditing ? 'edit' : 'create'}
      />
    </div>
  );
}