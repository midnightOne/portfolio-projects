import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-utils";
import { AdminDashboard } from "@/components/admin/dashboard";

export default async function AdminPage() {
  const session = await getSession();
  
  if (!session?.user || (session.user as any)?.role !== "admin") {
    redirect("/admin/login");
  }

  return <AdminDashboard />;
}