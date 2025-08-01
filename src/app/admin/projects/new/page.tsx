import { redirect } from "next/navigation";

export default function NewProjectRedirect() {
  redirect("/admin/projects/editor");
}