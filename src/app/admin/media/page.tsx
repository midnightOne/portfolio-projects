import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLayout } from "@/components/admin/admin-page-layout";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import Link from "next/link";

export default async function MediaPage() {
  const session = await getSession();
  
  if (!session?.user || (session.user as any)?.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Media Library"
        description="Manage and organize your media files"
        actions={
          <Button asChild>
            <Link href="/admin/media/upload">
              <Upload className="w-4 h-4 mr-2" />
              Upload Media
            </Link>
          </Button>
        }
      >
        <div className="space-y-6">
          <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
            <div className="mx-auto max-w-md">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Media Library Coming Soon
              </h3>
              <p className="text-gray-500 mb-4">
                The media library interface is being developed. For now, you can upload media files.
              </p>
              <Button asChild>
                <Link href="/admin/media/upload">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Media
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </AdminPageLayout>
    </AdminLayout>
  );
}