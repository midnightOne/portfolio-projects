import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLayout } from "@/components/admin/admin-page-layout";
import { SemanticBulkOperations } from "@/components/admin/semantic-bulk-operations";

export default async function BulkOperationsPage() {
  const session = await getSession();
  
  if (!session?.user || (session.user as any)?.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Bulk Operations"
        description="Maintenance operations for semantic content: cleanup, export/import, and bulk regeneration with cost optimization"
      >
        <SemanticBulkOperations />
      </AdminPageLayout>
    </AdminLayout>
  );
}
