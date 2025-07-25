import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { ProjectEditor } from "@/components/admin/project-editor";

export default async function NewProjectPage() {
  const session = await getSession();
  
  if (!session?.user || (session.user as any)?.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Create New Project
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Add a new project to your portfolio
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <ProjectEditor />
      </main>
    </div>
  );
} 