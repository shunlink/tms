/** Placement gates for vehicle/driver assignment on an indent. */
export function isVehicleReached(placementStatus: string | null | undefined) {
  return placementStatus === "VEHICLE_REACHED";
}

export function assertVehicleDriverAssignable(indent: {
  vendorId: string | null;
  placementStatus: string | null;
}) {
  if (!indent.vendorId) {
    throw new Error("Vendor must be allocated before assigning a vehicle or driver");
  }
  if (
    !isVehicleReached(indent.placementStatus) &&
    indent.placementStatus !== "PARTIALLY_REACHED"
  ) {
    throw new Error(
      "Vehicle and driver can only be assigned after the vehicle has reached placement"
    );
  }
}

export function assertVehicleDriverAssignableForLine(
  indent: { vendorId: string | null },
  line: { placementStatus: string }
) {
  if (!indent.vendorId) {
    throw new Error("Vendor must be allocated before assigning a vehicle or driver");
  }
  if (!isVehicleReached(line.placementStatus)) {
    throw new Error(
      "Vehicle and driver can only be assigned after this vehicle has reached placement"
    );
  }
}
