import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLayout } from "@/components/admin/admin-page-layout";
import { ChunkingConfig } from "@/components/admin/chunking-config";

export default async function SemanticConfigPage() {
  const session = await getSession();
  
  if (!session?.user || (session.user as any)?.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Semantic Processing Configuration"
        description="Configure chunking, summaries, embeddings, and batch processing"
      >
        <ChunkingConfig />
      </AdminPageLayout>
    </AdminLayout>
  );
}
