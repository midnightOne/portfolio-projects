import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLayout } from "@/components/admin/admin-page-layout";
import { SemanticBudgetManager } from "@/components/admin/semantic-budget-manager";

export default async function SemanticBudgetPage() {
  const session = await getSession();
  
  if (!session?.user || (session.user as any)?.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Semantic Budget Manager"
        description="Manage budget allocation, track spending, and monitor AI operation costs"
      >
        <SemanticBudgetManager />
      </AdminPageLayout>
    </AdminLayout>
  );
}
