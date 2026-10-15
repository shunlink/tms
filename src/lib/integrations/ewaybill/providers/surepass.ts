import "server-only";

import { surepassEndpoints } from "../../core/config";
import { IntegrationError } from "../../core/errors";
import { surepassPost } from "../../core/surepass-client";
import { normalizeSurepassEwayBill } from "../normalize";
import type { EwayBillFetchResult, EwayBillGenerateInput, EwayBillGenerateResult } from "../types";

const EBN_RE = /^\d{12}$/;

export async function surepassFetchEwayBill(ewayBillNumber: string): Promise<EwayBillFetchResult> {
  const ebn = ewayBillNumber.replace(/\s+/g, "");
  if (!EBN_RE.test(ebn)) {
    throw new IntegrationError("Please enter a valid 12-digit E-Way Bill number.", "INVALID_INPUT");
  }

  const raw = await surepassPost<Record<string, unknown>>(surepassEndpoints().ewayFetch, {
    id_number: ebn,
  });

  const data = normalizeSurepassEwayBill(ebn, raw, "CLIENT_PROVIDED", "surepass");
  return { data };
}

export async function surepassGenerateEwayBill(
  input: EwayBillGenerateInput
): Promise<EwayBillGenerateResult> {
  const raw = await surepassPost<Record<string, unknown>>(surepassEndpoints().ewayGenerate, {
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
    transporter_id: input.transporterGstin,
  });

  const ebn =
    (typeof raw.eway_bill_number === "string" && raw.eway_bill_number) ||
    (typeof raw.ewb_no === "string" && raw.ewb_no) ||
    "GENERATED";

  const data = normalizeSurepassEwayBill(ebn, raw, "SHUNLINK_GENERATED", "surepass");
  data.source = "SHUNLINK_GENERATED";
  return { data };
}
