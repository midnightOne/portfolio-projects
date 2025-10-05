/**
 * Project Semantic Management Page
 * 
 * Provides detailed semantic content management for individual projects
 * with stage-based processing controls and job queue monitoring.
 */

import { Suspense } from 'react';
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLayout } from "@/components/admin/admin-page-layout";
import { ProjectSemanticManager } from '@/components/admin/project-semantic-manager';
import { Loader2 } from 'lucide-react';

interface ProjectSemanticPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectSemanticPage({ params }: ProjectSemanticPageProps) {
  const session = await getSession();
  
  if (!session?.user || (session.user as any)?.role !== "admin") {
    redirect("/admin/login");
  }

  const { id: projectId } = await params;

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Project Semantic Management"
        description="Manage semantic content processing for this project"
      >
        <Suspense fallback={
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        }>
          <ProjectSemanticManager projectId={projectId} />
        </Suspense>
      </AdminPageLayout>
    </AdminLayout>
  );
}