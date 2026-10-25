"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { readJsonBody, reportApiFailure } from "@/lib/api-client";
import { useToast } from "@/components/toast";
export type VehicleSlotView = {
  lineId: string;
  lineNumber: number;
  lineStatus: string;
  placementStatus: string;
  trip: { id: string; lrNumber: string; status: string } | null;
  vehicle: { id: string; registrationNumber: string } | null;
  driver: {
    id: string;
    name: string;
    phone: string;
    dlNumber: string;
    deviceType: string;
    otpVerified: boolean;
  } | null;
};

type DriverFields = {
  name: string;
  dlNumber: string;
  phone: string;
  deviceType: string;
};

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return phone;
  const last5 = digits.slice(-5);
  return `+91 XXXXX ${last5.slice(0, 1)}${last5.slice(1)}`;
}

function emptyDriver(slot?: VehicleSlotView): DriverFields {
  return {
    name: slot?.driver?.name ?? "",
    dlNumber: slot?.driver?.dlNumber ?? "",
    phone: slot?.driver?.phone ?? "",
    deviceType: slot?.driver?.deviceType ?? "SMARTPHONE",
  };
}

export default function IndentVehicleSlots({
  indentId,
  vendorAllocated,
  vendorName,
  vehicleTypeCode,
  bodyTypeCode,
  slots,
  canMarkPlacement = false,
}: {
  indentId: string;
  vendorAllocated: boolean;
  vendorName?: string | null;
  vehicleTypeCode: string;
  bodyTypeCode?: string;
  slots: VehicleSlotView[];
  canMarkPlacement?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busyLine, setBusyLine] = useState<string | null>(null);
  const [errorByLine, setErrorByLine] = useState<Record<string, string>>({});

  const [vehicleReg, setVehicleReg] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const s of slots) {
      m[s.lineId] = s.vehicle?.registrationNumber ?? "";
    }
    return m;
  });

  const [drivers, setDrivers] = useState<Record<string, DriverFields>>(() => {
    const m: Record<string, DriverFields> = {};
    for (const s of slots) m[s.lineId] = emptyDriver(s);
    return m;
  });

  const [otpState, setOtpState] = useState<
    Record<string, { pendingDriverId: string | null; otp: string; sent: boolean; verified: boolean }>
  >(() => {
    const m: Record<string, { pendingDriverId: string | null; otp: string; sent: boolean; verified: boolean }> = {};
    for (const s of slots) {
      m[s.lineId] = {
        pendingDriverId: s.driver?.id && !s.driver.otpVerified ? s.driver.id : null,
        otp: "",
        sent: Boolean(s.driver?.id && !s.driver.otpVerified),
        verified: s.driver?.otpVerified ?? false,
      };
    }
    return m;
  });

  const assignedCount = useMemo(
    () => slots.filter((s) => s.driver?.otpVerified && s.vehicle?.registrationNumber).length,
    [slots]
  );

  function canAssignSlot(slot: VehicleSlotView) {
    return vendorAllocated && slot.placementStatus === "VEHICLE_REACHED" && !slot.trip;
  }

  async function markReached(lineId: string) {
    setErrorByLine((e) => ({ ...e, [lineId]: "" }));
    setBusyLine(lineId);
    const res = await fetch(`/api/indents/${indentId}/placement/vehicle-reached`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "vehicle_reached", indentLineId: lineId }),
    });
    setBusyLine(null);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, {
        toast,
        setError: (msg) => setErrorByLine((e) => ({ ...e, [lineId]: msg })),
        fallback: "Failed to mark placement",
      });
      return;
    }
    router.refresh();
  }

  async function saveSlot(lineId: string) {
    setErrorByLine((e) => ({ ...e, [lineId]: "" }));
    const reg = (vehicleReg[lineId] ?? "").trim();
    const driver = drivers[lineId] ?? emptyDriver();
    const hasVehicle = reg.length > 0;
    const hasDriver = driver.name.trim() && driver.dlNumber.trim() && driver.phone.trim();
    if (!hasVehicle && !hasDriver) {
      setErrorByLine((e) => ({ ...e, [lineId]: "Enter vehicle and/or driver details" }));
      return;
    }

    setBusyLine(lineId);
    try {
      if (hasVehicle) {
        const vRes = await fetch(`/api/indents/${indentId}/vehicle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registrationNumber: reg,
            vehicleTypeCode,
            bodyTypeCode: bodyTypeCode || null,
            indentLineId: lineId,
          }),
        });
        const vData = await readJsonBody(vRes);
        if (!vRes.ok) {
          reportApiFailure(vRes, vData, {
            toast,
            setError: (msg) => setErrorByLine((e) => ({ ...e, [lineId]: msg })),
            fallback: "Vehicle assignment failed",
          });
          return;
        }
      }
      if (hasDriver) {
        const dRes = await fetch(`/api/indents/${indentId}/driver`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...driver, indentLineId: lineId }),
        });
        const dData = await readJsonBody(dRes);
        if (!dRes.ok) {
          reportApiFailure(dRes, dData, {
            toast,
            setError: (msg) => setErrorByLine((e) => ({ ...e, [lineId]: msg })),
            fallback: "Driver registration failed",
          });
          return;
        }
        const driverBody = dData as { driver?: { id?: string } };
        setOtpState((o) => ({
          ...o,
          [lineId]: {
            ...o[lineId],
            pendingDriverId: driverBody.driver?.id ?? null,
            sent: true,
            verified: false,
            otp: "",
          },
        }));
      }
      router.refresh();
    } finally {
      setBusyLine(null);
    }
  }

  async function verifyOtp(lineId: string) {
    const st = otpState[lineId];
    if (!st?.pendingDriverId || !st.otp.trim()) {
      setErrorByLine((e) => ({ ...e, [lineId]: "Enter the OTP sent to the driver" }));
      return;
    }
    setBusyLine(lineId);
    const res = await fetch(`/api/indents/${indentId}/driver/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driverId: st.pendingDriverId,
        otp: st.otp.trim(),
        indentLineId: lineId,
      }),
    });
    setBusyLine(null);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, {
        toast,
        setError: (msg) => setErrorByLine((e) => ({ ...e, [lineId]: msg })),
        fallback: "OTP verification failed",
      });
      return;
    }
    setOtpState((o) => ({
      ...o,
      [lineId]: { ...o[lineId], verified: true, sent: false },
    }));
    router.refresh();
  }

  async function createTrip(lineId: string) {
    setBusyLine(lineId);
    const res = await fetch(`/api/indents/${indentId}/create-trip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ indentLineId: lineId }),
    });
    setBusyLine(null);
    const data = await readJsonBody(res);
    if (!res.ok) {
      reportApiFailure(res, data, {
        toast,
        setError: (msg) => setErrorByLine((e) => ({ ...e, [lineId]: msg })),
        fallback: "Failed to create trip",
      });
      return;
    }
    const payload =
      data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    const tripId = typeof payload?.id === "string" ? payload.id : null;
    const lrNumber = typeof payload?.lrNumber === "string" ? payload.lrNumber : null;
    const lrPdf = payload?.lrPdf as { ok?: boolean; url?: string; error?: string } | undefined;
    if (lrPdf?.ok && lrPdf.url) {
      toast.push({
        variant: "success",
        title: lrNumber ? `LR ${lrNumber} created` : "Trip / LR created",
        description: tripId
          ? `View LR PDF from the trip page (/trips/${tripId}).`
          : "LR PDF is ready to view.",
      });
      window.open(lrPdf.url, "_blank", "noopener,noreferrer");
    } else if (tripId) {
      toast.push({
        variant: lrPdf?.error ? "warning" : "success",
        title: lrNumber ? `LR ${lrNumber} created` : "Trip created",
        description: lrPdf?.error
          ? `LR PDF could not be generated (${lrPdf.error}). Regenerate from /trips/${tripId}.`
          : `Open trip: /trips/${tripId}`,
      });
    } else {
      toast.push({ variant: "success", title: "Trip / LR created" });
    }
    router.refresh();
  }

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle>Vehicle & Driver Assignment</CardTitle>
        <p className="text-sm text-slate-500 font-normal">
          {!vendorAllocated
            ? "Available after vendor allocation."
            : vendorName
              ? `Vendor: ${vendorName} — ${assignedCount} of ${slots.length} vehicles ready`
              : `${assignedCount} of ${slots.length} vehicles ready`}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {slots.map((slot) => {
          const canAssign = canAssignSlot(slot);
          const st = otpState[slot.lineId];
          const driver = drivers[slot.lineId] ?? emptyDriver(slot);
          const tripReady =
            slot.placementStatus === "VEHICLE_REACHED" &&
            slot.vehicle &&
            slot.driver?.otpVerified &&
            !slot.trip;

          return (
            <div
              key={slot.lineId}
              className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">Vehicle {slot.lineNumber}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200">
                    Placement: {slot.placementStatus.replace(/_/g, " ")}
                  </span>
                  {slot.trip && (
                    <Link
                      href={`/trips/${slot.trip.id}`}
                      className="px-2 py-0.5 rounded-full bg-green-50 text-green-800 border border-green-200 hover:bg-green-100"
                    >
                      LR {slot.trip.lrNumber}
                    </Link>
                  )}
                </div>
              </div>

              {vendorAllocated && slot.placementStatus === "PLACEMENT_PENDING" && canMarkPlacement && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyLine === slot.lineId}
                  onClick={() => void markReached(slot.lineId)}
                >
                  Mark vehicle reached
                </Button>
              )}

              {vendorAllocated && slot.placementStatus === "PLACEMENT_PENDING" && !canMarkPlacement && (
                <p className="text-xs text-amber-800">
                  Mark placement reached before assigning vehicle and driver for this slot.
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Registration</label>
                  <input
                    type="text"
                    className="w-full border rounded-md px-3 py-2 text-sm disabled:bg-slate-100"
                    value={vehicleReg[slot.lineId] ?? ""}
                    onChange={(e) =>
                      setVehicleReg((m) => ({ ...m, [slot.lineId]: e.target.value }))
                    }
                    disabled={!canAssign}
                    placeholder="MH12AB1234"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Driver name</label>
                  <input
                    type="text"
                    className="w-full border rounded-md px-3 py-2 text-sm disabled:bg-slate-100"
                    value={driver.name}
                    onChange={(e) =>
                      setDrivers((m) => ({
                        ...m,
                        [slot.lineId]: { ...driver, name: e.target.value },
                      }))
                    }
                    disabled={!canAssign}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">DL number</label>
                  <input
                    type="text"
                    className="w-full border rounded-md px-3 py-2 text-sm disabled:bg-slate-100"
                    value={driver.dlNumber}
                    onChange={(e) =>
                      setDrivers((m) => ({
                        ...m,
                        [slot.lineId]: { ...driver, dlNumber: e.target.value },
                      }))
                    }
                    disabled={!canAssign}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Driver mobile</label>
                  <input
                    type="tel"
                    className="w-full border rounded-md px-3 py-2 text-sm disabled:bg-slate-100"
                    value={driver.phone}
                    onChange={(e) =>
                      setDrivers((m) => ({
                        ...m,
                        [slot.lineId]: { ...driver, phone: e.target.value },
                      }))
                    }
                    disabled={!canAssign}
                  />
                </div>
              </div>

              {canAssign && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyLine === slot.lineId}
                    onClick={() => void saveSlot(slot.lineId)}
                  >
                    {busyLine === slot.lineId ? "Saving..." : "Save vehicle & driver"}
                  </Button>
                  {(st?.verified || slot.driver?.otpVerified) && (
                    <span className="text-xs text-green-700 self-center">Driver verified</span>
                  )}
                  {tripReady && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyLine === slot.lineId}
                      onClick={() => void createTrip(slot.lineId)}
                    >
                      Create LR
                    </Button>
                  )}
                </div>
              )}

              {st?.sent && !st.verified && !slot.driver?.otpVerified && canAssign && (
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="text-xs text-slate-500">OTP ({maskPhone(driver.phone)})</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      className="w-28 border rounded-md px-2 py-1 text-sm"
                      value={st.otp}
                      onChange={(e) =>
                        setOtpState((o) => ({
                          ...o,
                          [slot.lineId]: {
                            ...o[slot.lineId],
                            otp: e.target.value.replace(/\D/g, "").slice(0, 6),
                          },
                        }))
                      }
                    />
                  </div>
                  <Button type="button" size="sm" onClick={() => void verifyOtp(slot.lineId)}>
                    Verify OTP
                  </Button>
                </div>
              )}

              {errorByLine[slot.lineId] && (
                <p className="text-sm text-red-600">{errorByLine[slot.lineId]}</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
