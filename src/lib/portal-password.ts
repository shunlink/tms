const LOWER = "abcdefghjkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%&*-_";

export const PORTAL_PASSWORD_HINT =
  "At least 8 characters with uppercase, lowercase, a number, and a symbol.";

function randomIndex(max: number): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function pick(pool: string): string {
  return pool[randomIndex(pool.length)]!;
}

function shuffle(chars: string[]): string[] {
  const out = [...chars];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Generates a password that satisfies {@link getPortalPasswordValidationError}. */
export function generatePortalPassword(length = 12): string {
  const size = Math.max(8, length);
  const required = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  const pool = LOWER + UPPER + DIGITS + SYMBOLS;
  while (required.length < size) {
    required.push(pick(pool));
  }
  return shuffle(required).join("");
}

export function getPortalPasswordValidationError(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include a lowercase letter";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include an uppercase letter";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must include a number";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must include a symbol";
  }
  return null;
}

export function isValidPortalPassword(password: string): boolean {
  return getPortalPasswordValidationError(password) === null;
}
