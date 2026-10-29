"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/page-header";
import DataTable, { type DataColumn } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { loadActiveRequirements } from "@/lib/bidding/admin-api";
import {
  auctionDetailHref,
  normalizeRequirement,
  resolveAuctionId,
  type RequirementRow,
} from "@/lib/bidding/requirement-display";

const LIST_COLUMNS: DataColumn[] = [
  { key: "id", header: "ID" },
  { key: "clientName", header: "Client" },
  { key: "origin", header: "Origin" },
  { key: "destination", header: "Destination" },
  { key: "status", header: "Status", kind: "badge" },
  { key: "lowestPrice", header: "Lowest Price", align: "right", kind: "money" },
  { key: "openAction", header: "Actions" },
];

export default function AuctionDeskSection() {
  const router = useRouter();
  const [rows, setRows] = useState<RequirementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const loadList = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      const result = await loadActiveRequirements();
      if (!result.ok) {
        setListError(result.error ?? "Failed to load requirements");
        setRows([]);
        return;
      }
      setRows(result.items.map((item) => normalizeRequirement(item)));
    } catch {
      setListError("Network error while loading requirements");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const tableRows = useMemo(
    () =>
      rows.map((r) => {
        const auctionId = resolveAuctionId(null, r.raw);
        const href = auctionDetailHref(r.id, auctionId, r.status);
        return {
          ...r,
          id: r.id,
          lowestPrice: r.lowestPrice ?? undefined,
          openAction: href ? "Open" : "—",
          _href: href,
          _canOpen: Boolean(href),
        };
      }),
    [rows]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live auction desk"
        description="Active load requirements from the Bidding platform. Open an auction to monitor bids or curate quotes."
        action={
          <Button type="button" variant="outline" size="sm" onClick={loadList} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {listError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {listError}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Loading active requirements…</p>
      ) : (
        <DataTable
          rows={tableRows}
          columns={LIST_COLUMNS}
          searchKeys={["id", "clientName", "origin", "destination", "status", "material", "vehicleType"]}
          pageSize={15}
          exportName="bidding-requirements"
          emptyText="No active requirements."
          onRowClick={(row) => {
            const href = row._href as string | undefined;
            if (href) router.push(href);
          }}
        />
      )}

      <p className="text-xs text-muted-foreground">
        Click a row or use the Open action to open the full auction page. Requirements without an auction ID
        cannot be opened until the auction exists (except published loads).
      </p>
    </div>
  );
}
