import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { AdminDashboard } from "@/components/admin/dashboard";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLayout } from "@/components/admin/admin-page-layout";

export default async function AdminPage() {
  const session = await getSession();
  
  if (!session?.user || (session.user as any)?.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Dashboard"
        description="Overview of your portfolio and system status"
      >
        <AdminDashboard />
      </AdminPageLayout>
    </AdminLayout>
  );
}