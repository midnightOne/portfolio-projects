import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth-utils";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLayout } from "@/components/admin/admin-page-layout";
import { ConversationGraphsManager } from "@/components/admin/conversation-graphs-manager";

export const metadata: Metadata = {
  title: "Conversation Graphs | Admin",
  description: "Node-graph conversation policy editor",
};

export default async function ConversationGraphsPage() {
  const session = await getSession();
  if (!session?.user || (session.user as { role?: string })?.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Conversation Graphs"
        description="Versioned node-graph conversation policy — draft, validate, publish. One graph is active at a time; published changes apply to new conversations."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "AI Assistant", href: "/admin/ai" },
          { label: "Conversation Graphs", href: "/admin/ai/conversation-graphs" },
        ]}
      >
        <ConversationGraphsManager />
      </AdminPageLayout>
    </AdminLayout>
  );
}
