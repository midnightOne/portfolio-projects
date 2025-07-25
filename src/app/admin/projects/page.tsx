import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { AdminProjectsList } from "@/components/admin/projects-list";

export default async function AdminProjectsPage() {
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
              Manage Projects
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              View, edit, and manage all your portfolio projects
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <AdminProjectsList />
      </main>
    </div>
  );
} 