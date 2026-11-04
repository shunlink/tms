/** GST state / UT codes as on E-Way Bill (fromGstin first two digits often match). */
export const INDIAN_GST_STATE_CODE_TO_NAME: Record<number, string> = {
  1: "Jammu and Kashmir",
  2: "Himachal Pradesh",
  3: "Punjab",
  4: "Chandigarh",
  5: "Uttarakhand",
  6: "Haryana",
  7: "Delhi",
  8: "Rajasthan",
  9: "Uttar Pradesh",
  10: "Bihar",
  11: "Sikkim",
  12: "Arunachal Pradesh",
  13: "Nagaland",
  14: "Manipur",
  15: "Mizoram",
  16: "Tripura",
  17: "Meghalaya",
  18: "Assam",
  19: "West Bengal",
  20: "Jharkhand",
  21: "Odisha",
  22: "Chhattisgarh",
  23: "Madhya Pradesh",
  24: "Gujarat",
  26: "Dadra and Nagar Haveli and Daman and Diu",
  27: "Maharashtra",
  28: "Andhra Pradesh",
  29: "Karnataka",
  30: "Goa",
  31: "Lakshadweep",
  32: "Kerala",
  33: "Tamil Nadu",
  34: "Puducherry",
  35: "Andaman and Nicobar Islands",
  36: "Telangana",
  37: "Andhra Pradesh",
  38: "Ladakh",
};

export function gstStateNameFromCode(code: number | string | null | undefined): string | null {
  if (code == null || code === "") return null;
  const n = typeof code === "number" ? code : Number.parseInt(String(code).trim(), 10);
  if (!Number.isFinite(n)) return null;
  return INDIAN_GST_STATE_CODE_TO_NAME[n] ?? null;
}
