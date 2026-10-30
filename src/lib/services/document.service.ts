import { prisma } from "../prisma";
import { putObject } from "../storage";

const ENTITY_TYPES = ["CLIENT", "VENDOR", "DRIVER", "VEHICLE", "INDENT", "TRIP", "REQUIREMENT", "CLIENT_PAYMENT"] as const;
export type DocumentEntityType = (typeof ENTITY_TYPES)[number];

const OWNER_MODEL: Record<string, keyof typeof prisma> = {
  client: "client",
  vendor: "vendor",
  driver: "driver",
  vehicle: "vehicle",
  indent: "indent",
  trip: "trip",
  requirement: "requirement",
  clientpayment: "clientPayment",
};

export const ALLOWED_DOCUMENT_TYPES = [
  "GST", "PAN", "AADHAAR", "MSME", "CIN", "BANK_PROOF", "AGREEMENT", "LICENSE",
  "ADDRESS_PROOF", "PROFILE_PHOTO",
  "RC", "INSURANCE", "FITNESS", "PUC", "PERMIT",
  "CLIENT_INVOICE", "VEHICLE_DOC", "APPROVAL",
  "LR", "EWAY_BILL", "POD", "DELIVERY_CHALLAN", "GATE_PASS", "INVOICE", "PAYMENT_PROOF", "OTHER",
];

export async function ownerExists(ownerType: string, ownerId: string): Promise<boolean> {
  const modelName = OWNER_MODEL[ownerType];
  if (!modelName) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = (prisma as any)[modelName];
  if (!model?.findFirst) return false;
  const rec = await model.findFirst({ where: { id: ownerId } });
  return Boolean(rec);
}

export async function listDocuments(entityType: DocumentEntityType, entityId: string) {
  const rows = await prisma.documentAttachment.findMany({
    where: { entityType, entityId },
    include: { file: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((d) => ({
    id: d.id,
    type: d.documentType,
    url: d.file.url,
    name: d.title ?? d.file.fileName,
    createdAt: d.createdAt,
  }));
}

export async function uploadDocument(opts: {
  ownerType: string;
  ownerId: string;
  documentType: string;
  fileName: string;
  mimeType?: string;
  sizeBytes: number;
  buffer: Buffer;
  uploadedById?: string | null;
  /** When true, removes an existing attachment of the same type before upload (driver portal replace). */
  replaceExisting?: boolean;
}) {
  const entityType = opts.ownerType.toUpperCase() as DocumentEntityType;
  if (!ENTITY_TYPES.includes(entityType)) {
    throw new Error("Invalid owner type");
  }

  const exists = await ownerExists(opts.ownerType, opts.ownerId);
  if (!exists) throw new Error("Owner not found");

  const docType = ALLOWED_DOCUMENT_TYPES.includes(opts.documentType)
    ? opts.documentType
    : "OTHER";

  const singleFileOwners = new Set<DocumentEntityType>(["CLIENT", "VENDOR", "DRIVER", "VEHICLE"]);
  if (singleFileOwners.has(entityType)) {
    const existing = await prisma.documentAttachment.findFirst({
      where: {
        entityType,
        entityId: opts.ownerId,
        documentType: docType,
      },
      select: { id: true },
    });
    if (existing) {
      if (opts.replaceExisting) {
        await deleteDocument(existing.id);
      } else {
        throw new Error(
          `A ${docType.replace(/_/g, " ")} file is already on record. Delete it before uploading another.`
        );
      }
    }
  }

  const safeName = opts.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${opts.ownerType}/${opts.ownerId}/${Date.now()}-${safeName}`;
  const { url } = await putObject(key, opts.buffer);

  const stored = await prisma.storedFile.create({
    data: {
      fileName: opts.fileName,
      mimeType: opts.mimeType ?? null,
      sizeBytes: opts.sizeBytes,
      storageKey: key,
      url,
      uploadedById: opts.uploadedById ?? null,
    },
  });

  const attachment = await prisma.documentAttachment.create({
    data: {
      fileId: stored.id,
      entityType,
      entityId: opts.ownerId,
      documentType: docType,
      title: opts.fileName,
    },
    include: { file: true },
  });

  return {
    id: attachment.id,
    fileId: stored.id,
    type: attachment.documentType,
    url: attachment.file.url,
    name: attachment.title ?? attachment.file.fileName,
    createdAt: attachment.createdAt,
  };
}

export async function deleteDocument(id: string) {
  const attachment = await prisma.documentAttachment.findFirst({
    where: { id },
    include: { file: true },
  });
  if (!attachment) return false;

  await prisma.$transaction([
    prisma.documentAttachment.delete({ where: { id } }),
    prisma.storedFile.delete({ where: { id: attachment.fileId } }),
  ]);
  return true;
}
