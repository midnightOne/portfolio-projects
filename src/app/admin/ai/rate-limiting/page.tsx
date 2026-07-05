import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLayout } from "@/components/admin/admin-page-layout";
import { RateLimitingDashboard } from "@/components/admin/rate-limiting-dashboard";
import { AccessAndSpendPanel } from "@/components/admin/access-and-spend-panel";

export default async function RateLimitingPage() {
  const session = await getSession();

  if (!session?.user || (session.user as any)?.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Access & Spend"
        description="Public AI access, spend watchdog, rate limits, and security settings"
      >
        <AccessAndSpendPanel />
        <RateLimitingDashboard />
      </AdminPageLayout>
    </AdminLayout>
  );
}