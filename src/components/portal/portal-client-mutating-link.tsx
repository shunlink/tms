"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useClientPortalViewOnly } from "./client-portal-view-only-context";

type LinkProps = ComponentProps<typeof Link>;

export default function PortalClientMutatingLink({
  href,
  className,
  children,
  ...rest
}: LinkProps) {
  const viewOnly = useClientPortalViewOnly();

  if (viewOnly) {
    return (
      <span
        className={`${className ?? ""} opacity-50 cursor-not-allowed`}
        title="View-only until your account is approved"
        aria-disabled
      >
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  );
}
