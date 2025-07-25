import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { ProjectMediaManager } from "@/components/admin/project-media-manager";
import { prisma } from "@/lib/database";

interface ProjectMediaPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProjectMediaPage({ params }: ProjectMediaPageProps) {
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
      mediaItems: {
        orderBy: { createdAt: 'desc' }
      },
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Media Management: {project.title}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Upload and manage media files for this project
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <ProjectMediaManager 
          projectId={id}
          projectTitle={project.title}
          existingMedia={project.mediaItems}
        />
      </main>
    </div>
  );
} 