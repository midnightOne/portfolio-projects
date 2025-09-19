import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLayout } from "@/components/admin/admin-page-layout";
import { ReflinksManager } from "@/components/admin/reflinks-manager";

export default async function ReflinksPage() {
  const session = await getSession();
  
  if (!session?.user || (session.user as any)?.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Reflinks Management"
        description="Create and manage reflink codes for enhanced AI assistant access"
      >
        <ReflinksManager />
      </AdminPageLayout>
    </AdminLayout>
  );
}