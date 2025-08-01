import { redirect } from "next/navigation";

interface EditProjectRedirectProps {
  params: Promise<{ id: string }>;
}

export default async function EditProjectRedirect({ params }: EditProjectRedirectProps) {
  const { id } = await params;
  redirect(`/admin/projects/editor/${id}`);
}