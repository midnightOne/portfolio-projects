import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLayout } from "@/components/admin/admin-page-layout";
import { SemanticTreeView } from "@/components/admin/semantic-tree-view";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProjectSemanticTreePage({ params }: PageProps) {
  const session = await getSession();
  
  if (!session?.user || (session.user as any)?.role !== "admin") {
    redirect("/admin/login");
  }

  // Await params as required by Next.js 15
  const { id } = await params;

  // Fetch project details
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true
    }
  });

  if (!project) {
    notFound();
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title={`Semantic Tree: ${project.title}`}
        description="View and manage the hierarchical semantic structure of this project"
        breadcrumbs={[
          { label: "Semantic Dashboard", href: "/admin/semantic" },
          { label: project.title, href: `/admin/semantic/projects/${id}` }
        ]}
      >
        <SemanticTreeView projectId={id} />
      </AdminPageLayout>
    </AdminLayout>
  );
}
