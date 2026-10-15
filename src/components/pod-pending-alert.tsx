import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";

type PendingPodTrip = {
  id: string;
  lrNumber: string;
  route: string;
  vehicle: string;
};

export default function PodPendingAlert({
  trips,
}: {
  trips: PendingPodTrip[];
}) {
  if (trips.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border-2 border-amber-200 bg-amber-50">
      <div className="flex items-start gap-4 p-5">
        <AlertTriangle className="h-6 w-6 text-amber-700 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-heading font-semibold text-lg text-amber-900">
            Delivery proof pending on {trips.length} trip{trips.length === 1 ? "" : "s"}
          </p>
          <p className="text-base text-amber-800 mt-1">
            Upload delivery proof to close these trips and receive payment.
          </p>
          <div className="mt-4 space-y-2">
            {trips.map((t) => (
              <Link
                key={t.id}
                href={`/portal/vendor/trips/${t.id}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-white border border-amber-200 px-4 py-3 text-base hover:border-amber-400 transition-colors min-h-[48px]"
              >
                <span className="font-semibold text-foreground">
                  {t.lrNumber}
                  <span className="text-muted-foreground font-normal ml-2">
                    {t.route} · {t.vehicle}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 text-amber-800 font-semibold shrink-0">
                  Upload proof <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
