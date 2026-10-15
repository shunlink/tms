"use client";

import { Children, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ExpandableListCard({
  title,
  initialCount = 5,
  viewAllHref,
  emptyMessage = "No items to show.",
  children,
}: {
  title: string;
  initialCount?: number;
  viewAllHref?: string;
  emptyMessage?: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = Children.toArray(children);
  const hasMore = items.length > initialCount;
  const visible = expanded ? items : items.slice(0, initialCount);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        {viewAllHref && (
          <Link href={viewAllHref} className="text-sm font-semibold text-primary hover:underline">
            View all
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-base">{emptyMessage}</p>
        ) : (
          <>
            <div className="space-y-3">{visible}</div>
            {hasMore && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-3 w-full text-primary"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" /> Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" /> Show {items.length - initialCount} more
                  </>
                )}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
