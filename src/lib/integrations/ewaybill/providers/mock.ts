import { markMockVerification } from "../../core/verification-status";
import { IntegrationError } from "../../core/errors";
import { normalizeSurepassEwayBill } from "../normalize";
import type {
  EwayBillGenerateInput,
  EwayBillGenerateResult,
  EwayBillProviderFetchResult,
} from "../types";

const EBN_RE = /^\d{12}$/;

export async function mockFetchEwayBill(ewayBillNumber: string): Promise<EwayBillProviderFetchResult> {
  const ebn = ewayBillNumber.replace(/\s+/g, "");
  if (!EBN_RE.test(ebn)) {
    throw new IntegrationError("Please enter a valid 12-digit E-Way Bill number.", "INVALID_INPUT");
  }
  if (ebn.endsWith("00")) {
    throw new IntegrationError("E-Way Bill not found.", "NOT_FOUND", { provider: "mock" });
  }

  const raw = {
    eway_bill_number: ebn,
    eway_bill_status: "Active",
    from_gstin: "27AAAAA0000A1Z5",
    to_gstin: "29BBBBB0000B1Z6",
    fromTrdName: "Welton Industries",
    fromAddr1: "4556 Industrial Estate",
    fromAddr2: "Hulimavu",
    fromPlace: "Pune",
    fromPincode: 411018,
    fromStateCode: 27,
    toTrdName: "Test Receiver Ltd",
    toAddr1: "Warehouse 9",
    toAddr2: "Chakan MIDC",
    toPlace: "Pune",
    toPincode: 410501,
    toStateCode: 27,
    doc_type: "Tax Invoice",
    doc_no: "INV-12345",
    doc_date: "2026-10-06",
    goods_description: "Steel Coils",
    hsn_code: "7208",
    quantity: "100",
    total_value: 120000,
    totInvValue: 125000,
    from_place: "Jamshedpur",
    to_place: "Pune",
    vehicle_number: "MH12AB1234",
    valid_upto: "2026-10-10",
    itemList: [{ productName: "Steel Coils", hsnCode: 7208, quantity: 100, qtyUnit: "MT" }],
  };

  const data = markMockVerification(normalizeSurepassEwayBill(ebn, raw, "CLIENT_PROVIDED", "mock"));
  return { data, rawNic: raw };
}

export async function mockGenerateEwayBill(
  input: EwayBillGenerateInput
): Promise<EwayBillGenerateResult> {
  const raw = {
    eway_bill_number: "123456789099",
    eway_bill_status: "Active",
    from_gstin: input.supplierGstin,
    to_gstin: input.recipientGstin,
    doc_type: input.documentType,
    doc_no: input.documentNumber,
    doc_date: input.documentDate,
    goods_description: input.goodsDescription,
    hsn_code: input.hsnCode,
    quantity: input.quantity,
    total_value: input.value,
    from_place: input.origin,
    to_place: input.destination,
    vehicle_number: input.vehicleNumber,
    valid_upto: "2026-10-10",
  };
  const data = markMockVerification(
    normalizeSurepassEwayBill("123456789099", raw, "SHUNLINK_GENERATED", "mock")
  );
  return { data };
}
