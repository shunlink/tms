"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SignOutButton({ className }: { className?: string }) {
  const { data: session } = useSession();

  async function handleSignOut() {
    if (session?.portalAccess?.sessionId) {
      await fetch("/api/superadmin/portal-access/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.portalAccess.sessionId }),
      });
    }
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <button
      onClick={() => handleSignOut()}
      className={cn(
        "inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900",
        className
      )}
    >
      <LogOut className="h-4 w-4" /> Sign out
    </button>
  );
}
