export function homePathForRole(role: string | undefined): string {
  if (role === "CLIENT") return "/portal/client";
  if (role === "VENDOR") return "/portal/vendor";
  if (role === "DRIVER") return "/driver";
  return "/";
}
