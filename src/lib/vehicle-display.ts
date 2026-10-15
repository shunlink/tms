/** Map vehicle record to legacy UI shape */
export function vehicleDisplay(v: {
  id: string;
  registrationNumber: string;
  vehicleTypeCode: string;
  type?: string;
}) {
  return {
    id: v.id,
    number: v.registrationNumber,
    type: v.vehicleTypeCode ?? v.type ?? "",
  };
}
