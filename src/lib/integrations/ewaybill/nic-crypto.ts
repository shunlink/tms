import crypto from "node:crypto";

/** AES-256-ECB decrypt; NIC returns next layer as base64-encoded key material. */
export function nicAes256EcbDecryptBase64(cipherBase64: string, key: Buffer): string {
  if (key.length !== 32) {
    throw new Error("NIC AES key must be 32 bytes");
  }
  const cipher = Buffer.from(cipherBase64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-ecb", key, null);
  decipher.setAutoPadding(true);
  const plain = Buffer.concat([decipher.update(cipher), decipher.final()]);
  return plain.toString("base64");
}

export function nicDecryptGetEwayBillPayload(
  encryptedData: string,
  encryptedRek: string,
  sessionSekKeyBase64: string
): string {
  const sekKey = Buffer.from(sessionSekKeyBase64, "base64");
  const rekKeyBase64 = nicAes256EcbDecryptBase64(encryptedRek, sekKey);
  const rekKey = Buffer.from(rekKeyBase64, "base64");
  const dataBase64 = nicAes256EcbDecryptBase64(encryptedData, rekKey);
  return Buffer.from(dataBase64, "base64").toString("utf8");
}

export function nicGenerateAppKey(): { appKey: Buffer; appKeyBase64: string } {
  const appKey = crypto.randomBytes(32);
  return { appKey, appKeyBase64: appKey.toString("base64") };
}

export function nicRsaEncryptBase64Payload(payloadBase64: string, publicKeyPem: string): string {
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(payloadBase64, "utf8")
  );
  return encrypted.toString("base64");
}

export function nicDecryptAuthSek(encryptedSekBase64: string, appKey: Buffer): string {
  return nicAes256EcbDecryptBase64(encryptedSekBase64, appKey);
}
