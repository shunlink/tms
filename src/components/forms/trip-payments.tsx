import Link from "next/link";
import StatusBadge from "@/components/status-badge";
import { formatINR, formatDate } from "@/lib/utils";

type Payment = {
  id: string;
  paymentType: string;
  amount: number;
  advanceAmount: number;
  tdsAmount: number;
  netPayable: number;
  status: string;
  paymentMode: string | null;
  referenceNo: string | null;
  paidAt: Date | string | null;
};

const TYPE_LABEL: Record<string, string> = {
  ADVANCE: "Advance",
  BALANCE: "Balance",
  OTHER: "Other",
};

function breakdown(p: Payment) {
  if (p.paymentType === "ADVANCE") return `Advance against freight ${formatINR(p.amount)}`;
  if (p.paymentType === "BALANCE") {
    return `Final payable ${formatINR(p.amount)} − advance ${formatINR(p.advanceAmount)}${
      p.tdsAmount > 0 ? ` (TDS ${formatINR(p.tdsAmount)})` : ""
    }`;
  }
  return null;
}

export default function TripPayments({ payments }: { payments: Payment[] }) {
  const totalPaid = payments
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + p.netPayable, 0);

  return (
    <div className="space-y-4">
      {payments.length > 0 ? (
        <div className="space-y-2">
          {payments.map((p) => {
            const detail = breakdown(p);
            return (
              <div key={p.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <div className="text-sm">
                  <p className="font-medium text-slate-900">
                    {TYPE_LABEL[p.paymentType] ?? p.paymentType} · {formatINR(p.netPayable)}
                  </p>
                  {detail && <p className="text-xs text-slate-500">{detail}</p>}
                  <p className="text-xs text-slate-400">
                    {[p.paymentMode, p.referenceNo, p.paidAt ? formatDate(p.paidAt) : null]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </div>
            );
          })}
          <p className="text-sm text-slate-600 pt-1">
            Total paid to vendor: <span className="font-semibold">{formatINR(totalPaid)}</span>
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-500">No vendor payments recorded yet.</p>
      )}
      <p className="text-xs text-slate-500 border-t pt-3">
        Advances are paid from{" "}
        <Link href="/advance-payments" className="text-blue-600 hover:underline">Advance Payments</Link>, balances from{" "}
        <Link href="/balance-payments" className="text-blue-600 hover:underline">Balance Payments</Link>, and other payouts from{" "}
        <Link href="/payments" className="text-blue-600 hover:underline">Vendor Payments</Link>.
      </p>
    </div>
  );
}
