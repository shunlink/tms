import { cn } from "@/lib/utils";

export default function EmptyState({
  title = "Nothing here yet",
  description,
  icon: Icon,
  className,
}: {
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-7 w-7" />
        </div>
      )}
      <p className="font-heading text-lg font-semibold text-foreground">{title}</p>
      {description && (
        <p className="text-muted-foreground mt-2 max-w-sm text-base">{description}</p>
      )}
    </div>
  );
}
