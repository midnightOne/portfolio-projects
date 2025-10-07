import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLayout } from "@/components/admin/admin-page-layout";
import { ChunkingConfig } from "@/components/admin/chunking-config";
import { SummaryConfig } from "@/components/admin/summary-config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function SemanticConfigPage() {
  const session = await getSession();
  
  if (!session?.user || (session.user as any)?.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <AdminLayout>
      <AdminPageLayout
        title="Semantic Processing Configuration"
        description="Configure content decomposition, AI summary generation, and batch processing"
      >
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="summary">Summary Generation</TabsTrigger>
            <TabsTrigger value="chunking">Chunking & Embedding</TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary">
            <SummaryConfig />
          </TabsContent>
          
          <TabsContent value="chunking">
            <ChunkingConfig />
          </TabsContent>
        </Tabs>
      </AdminPageLayout>
    </AdminLayout>
  );
}
