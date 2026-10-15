"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileInput } from "lucide-react";

export default function ConvertRequirementButton({
  requirementId,
  indentId,
  status,
}: {
  requirementId: string;
  indentId?: string | null;
  status: string;
}) {
  if (status === "CONVERTED" && indentId) {
    return (
      <Link href={`/indents/${indentId}`}>
        <Button className="gap-2">
          <FileInput className="h-4 w-4" /> View indent
        </Button>
      </Link>
    );
  }

  if (status === "CANCELLED") return null;

  return (
    <Link href={`/indents/new?requirementId=${requirementId}`}>
      <Button className="gap-2">
        <FileInput className="h-4 w-4" />
        Create indent from requirement
      </Button>
    </Link>
  );
}
