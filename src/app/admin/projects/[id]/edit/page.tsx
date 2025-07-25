import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { ProjectEditor } from "@/components/admin/project-editor";
import { prisma } from "@/lib/database";

interface EditProjectPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditProjectPage({ params }: EditProjectPageProps) {
  const session = await getSession();
  
  if (!session?.user || (session.user as any)?.role !== "admin") {
    redirect("/admin/login");
  }

  // Await the params as they are now a Promise in Next.js 15
  const { id } = await params;

  // Fetch the project data
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      tags: true,
      _count: {
        select: {
          mediaItems: true
        }
      }
    }
  });

  if (!project) {
    notFound();
  }

  // Transform project data for the editor
  const projectData = {
    title: project.title,
    description: project.description || '',
    briefOverview: project.briefOverview || '',
    tags: project.tags.map(tag => tag.name),
    status: project.status as 'DRAFT' | 'PUBLISHED',
    visibility: project.visibility as 'PUBLIC' | 'PRIVATE',
    workDate: project.workDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Edit Project: {project.title}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Update your project details and content
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <ProjectEditor 
          projectId={id}
          initialData={projectData}
        />
      </main>
    </div>
  );
} 