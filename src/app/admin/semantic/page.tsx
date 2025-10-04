import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLayout } from "@/components/admin/admin-page-layout";
import { SemanticDashboard } from "@/components/admin/semantic-dashboard";

export default async function SemanticDashboardPage() {
  const session = await getSession();
  
  if (!session?.user || (session.user as any)?.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Semantic Content Management"
        description="Monitor and manage semantic indexes, embeddings, and AI operations"
      >
        <SemanticDashboard />
      </AdminPageLayout>
    </AdminLayout>
  );
}
