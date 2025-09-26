import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLayout } from "@/components/admin/admin-page-layout";
import { ToolTestingInterface } from "@/components/admin/tool-testing-interface";

export default async function ToolTestingPage() {
  const session = await getSession();
  
  if (!session?.user || (session.user as any)?.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Tool Testing"
        description="Test and debug server-side AI tools with custom parameters"
      >
        <ToolTestingInterface />
      </AdminPageLayout>
    </AdminLayout>
  );
}