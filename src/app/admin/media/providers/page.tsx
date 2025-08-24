import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { MediaProvidersInterface } from "@/components/admin/media-providers";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLayout } from "@/components/admin/admin-page-layout";

export default async function MediaProvidersPage() {
  const session = await getSession();
  
  if (!session?.user || (session.user as any)?.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Media Storage Providers"
        description="Configure and manage media storage providers"
      >
        <MediaProvidersInterface />
      </AdminPageLayout>
    </AdminLayout>
  );
}