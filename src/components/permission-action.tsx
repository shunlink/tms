"use client";

import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

const DENIED_MESSAGE = "You are not allowed to perform this action";

type ButtonProps = ComponentProps<typeof Button>;

export function PermissionAction({
  allowed,
  deniedMessage = DENIED_MESSAGE,
  children,
  ...buttonProps
}: ButtonProps & {
  allowed: boolean;
  deniedMessage?: string;
}) {
  if (allowed) {
    return <Button {...buttonProps}>{children}</Button>;
  }

  return (
    <Button
      {...buttonProps}
      disabled
      title={deniedMessage}
      className={`${buttonProps.className ?? ""} cursor-not-allowed`}
      onClick={(e) => e.preventDefault()}
    >
      {children}
    </Button>
  );
}
