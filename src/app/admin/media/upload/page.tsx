import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { MediaUploadInterface } from "@/components/admin/media-upload";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLayout } from "@/components/admin/admin-page-layout";

export default async function MediaUploadPage() {
  const session = await getSession();
  
  if (!session?.user || (session.user as any)?.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Media Upload"
        description="Upload and manage media files for your projects"
      >
        <MediaUploadInterface />
      </AdminPageLayout>
    </AdminLayout>
  );
} 