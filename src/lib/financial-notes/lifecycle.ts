import type { NoteStatus } from "./types";

const TRANSITIONS: Record<NoteStatus, NoteStatus[]> = {
  DRAFT: ["PENDING_APPROVAL", "APPROVED", "VOIDED"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED", "DRAFT"],
  APPROVED: ["ISSUED", "VOIDED", "PENDING_APPROVAL"],
  ISSUED: ["REVERSED"],
  REJECTED: ["DRAFT"],
  VOIDED: [],
  REVERSED: [],
};

export function canTransitionNote(from: string, to: NoteStatus): boolean {
  const allowed = TRANSITIONS[from as NoteStatus];
  if (!allowed) return false;
  return allowed.includes(to);
}

export function assertNoteTransition(from: string, to: NoteStatus): void {
  if (!canTransitionNote(from, to)) {
    throw new Error(`Invalid note status transition: ${from} → ${to}`);
  }
}

export function isNoteEditable(status: string): boolean {
  return status === "DRAFT" || status === "PENDING_APPROVAL";
}
