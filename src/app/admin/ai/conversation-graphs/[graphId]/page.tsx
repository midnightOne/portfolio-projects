import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth-utils";
import { AdminLayout } from "@/components/admin/admin-layout";
import { GraphEditor } from "@/components/admin/graph-editor/GraphEditor";

export const metadata: Metadata = {
  title: "Graph Editor | Admin",
};

export default async function GraphEditorPage({ params }: { params: Promise<{ graphId: string }> }) {
  const session = await getSession();
  if (!session?.user || (session.user as { role?: string })?.role !== "admin") {
    redirect("/admin/login");
  }
  const { graphId } = await params;

  return (
    <AdminLayout>
      <GraphEditor graphId={graphId} />
    </AdminLayout>
  );
}
