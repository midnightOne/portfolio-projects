import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { PerformanceDashboard } from "@/components/admin/performance-dashboard";

export const metadata = {
  title: "Performance Dashboard - Admin",
  description: "Monitor and analyze system performance metrics",
};

export default async function AdminPerformancePage() {
  const session = await getSession();
  
  if (!session?.user || (session.user as any)?.role !== "admin") {
    redirect("/admin/login");
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Performance Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor system performance, database queries, and API response times
        </p>
      </div>
      
      <PerformanceDashboard />
    </div>
  );
} 