"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isProfileOnlyStatus } from "@/lib/portal-access";

export default function PortalAccessGuard({
  profilePath,
  onboardingStatus,
}: {
  profilePath: string;
  onboardingStatus: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isProfileOnlyStatus(onboardingStatus)) return;
    if (pathname === profilePath || pathname.startsWith(`${profilePath}/`)) return;
    router.replace(profilePath);
  }, [pathname, onboardingStatus, profilePath, router]);

  return null;
}
