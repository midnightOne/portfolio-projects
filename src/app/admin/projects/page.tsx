import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { AdminProjectsList } from "@/components/admin/projects-list";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLayout } from "@/components/admin/admin-page-layout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export default async function AdminProjectsPage() {
  const session = await getSession();
  
  if (!session?.user || (session.user as any)?.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="All Projects"
        description="View, edit, and manage all your portfolio projects"
        actions={
          <Button asChild>
            <Link href="/admin/projects/editor">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Link>
          </Button>
        }
      >
        <AdminProjectsList />
      </AdminPageLayout>
    </AdminLayout>
  );
} 