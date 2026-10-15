import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PendingTaskItem } from "@/lib/team-dashboard-types";

export default function PendingTasksSection({
  tasks,
  className,
}: {
  tasks: PendingTaskItem[];
  className?: string;
}) {
  return (
    <Card className={`border-2 border-amber-300 bg-amber-50/40 ${className ?? ""}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-heading tracking-wide uppercase text-amber-900">
          Pending Tasks
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="flex items-center gap-3 text-muted-foreground py-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <p className="text-base">All caught up — no pending tasks.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {tasks.map((task) => (
              <li key={task.key}>
                {task.href ? (
                  <Link
                    href={task.href}
                    className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-4 py-3 hover:bg-amber-50 transition-colors"
                  >
                    <span className="font-semibold text-foreground">{task.label}</span>
                    <span className="text-sm font-medium text-muted-foreground tabular-nums">{task.count}</span>
                  </Link>
                ) : (
                  <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-4 py-3">
                    <span className="font-semibold text-foreground">{task.label}</span>
                    <span className="text-sm font-medium text-muted-foreground tabular-nums">{task.count}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
