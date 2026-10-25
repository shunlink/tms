import { redirect } from "next/navigation";

/** Legacy static matrix — replaced by dynamic access role bundles. */
export default function PermissionsPage() {
  redirect("/access-roles");
}
