import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth-utils";
import { AdminLayout } from "@/components/admin/admin-layout";
import { GraphEditor } from "@/components/admin/graph-editor/GraphEditor";
import { TraversalViewer } from "@/components/admin/graph-editor/TraversalViewer";

export const metadata: Metadata = {
  title: "Graph Editor | Admin",
};

export default async function GraphEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ graphId: string }>;
  searchParams: Promise<{ traversal?: string; version?: string }>;
}) {
  const session = await getSession();
  if (!session?.user || (session.user as { role?: string })?.role !== "admin") {
    redirect("/admin/login");
  }
  const { graphId } = await params;
  const { traversal, version } = await searchParams;

  // Block E1 (Req 9.1): ?traversal=<conversationId>&version=<graphVersionId>
  // renders the read-only traversal view pinned to the run's version instead
  // of the draft editor.
  if (traversal && version) {
    return (
      <AdminLayout>
        <TraversalViewer graphId={graphId} versionId={version} conversationId={traversal} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <GraphEditor graphId={graphId} />
    </AdminLayout>
  );
}
