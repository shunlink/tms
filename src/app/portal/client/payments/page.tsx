"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readJsonBody } from "@/lib/api-client";
import { formatINR } from "@/lib/utils";

type OrderRow = {
  id: string;
  purpose: string;
  status: string;
  amount: number;
  settled: boolean;
  createdAt: string;
};

export default function ClientPaymentsPageClient() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/portal/client/payments/orders")
      .then(async (r) => {
        const data = (await readJsonBody(r)) as { orders?: OrderRow[]; enabled?: boolean };
        setOrders(data.orders ?? []);
        setEnabled(Boolean(data.enabled));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-950">Online payments</h1>
        <p className="text-sm text-gray-600 mt-1">
          {enabled
            ? "Recent checkout sessions and their status."
            : "Online payments are not configured in this environment."}
        </p>
      </div>
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Purpose</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  No online payments yet. Pay an invoice from the invoice detail page.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-gray-100">
                <td className="px-4 py-2">{new Date(o.createdAt).toLocaleString()}</td>
                <td className="px-4 py-2">{o.purpose}</td>
                <td className="px-4 py-2">{formatINR(o.amount)}</td>
                <td className="px-4 py-2">{o.settled ? "Paid" : o.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Link href="/portal/client/invoices" className="text-sm font-semibold text-gray-700 hover:text-gray-950">
        View invoices →
      </Link>
    </div>
  );
}
