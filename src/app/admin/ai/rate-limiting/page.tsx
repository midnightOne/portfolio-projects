import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLayout } from "@/components/admin/admin-page-layout";
import { RateLimitingDashboard } from "@/components/admin/rate-limiting-dashboard";

export default async function RateLimitingPage() {
  const session = await getSession();
  
  if (!session?.user || (session.user as any)?.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Rate Limiting"
        description="Manage AI assistant rate limits, reflinks, and security settings"
      >
        <RateLimitingDashboard />
      </AdminPageLayout>
    </AdminLayout>
  );
}