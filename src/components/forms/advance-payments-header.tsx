"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import RaiseAdvanceDialog from "@/components/forms/raise-advance-dialog";

type TripOption = {
  id: string;
  lrNumber: string;
  route: string;
  vendorId: string;
  vendorRate: number;
  indentNumber?: string | null;
};

export default function AdvancePaymentsHeader({
  canRaise,
  vendors,
  trips,
}: {
  canRaise: boolean;
  vendors: { id: string; label: string }[];
  trips: TripOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {canRaise && (
        <Button onClick={() => setOpen(true)}>+ Raise Advance Request</Button>
      )}
      <RaiseAdvanceDialog
        vendors={vendors}
        trips={trips}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
