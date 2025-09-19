import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLayout } from "@/components/admin/admin-page-layout";
import { SecurityManager } from "@/components/admin/security-manager";

export default async function SecurityPage() {
  const session = await getSession();
  
  if (!session?.user || (session.user as any)?.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Security Management"
        description="Monitor and manage IP blacklists, security violations, and access control"
      >
        <SecurityManager />
      </AdminPageLayout>
    </AdminLayout>
  );
}