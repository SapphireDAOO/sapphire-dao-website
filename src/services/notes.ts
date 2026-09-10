import { CONTRACT_API_URL } from "@/constants";
import type { Hex } from "viem";

export type CreateNotePayload = {
  invoiceId: string;
  author: string;
  /** The envelope from `sealNote`, hex. Never plaintext. */
  content: Hex;
  share: boolean;
};

export type SetNoteStatePayload = {
  invoiceId: string;
  noteId: string;
  author: string;
};

export type NotesApiResponse = {
  success: boolean;
  error?: string;
  txHash?: string;
  noteId?: string;
};

export type PendingNote = {
  invoiceId: string;
  noteId?: string;
  author: string;
  share: boolean;
  message: string;
  txHash?: string;
  createdAt: number;
};

const PENDING_NOTES_KEY = "sapphire.pendingNotes";

// A just-written note is held locally only until the subgraph catches up. The
// plaintext is already in hand, so it is shown straight away rather than as a
// pending row; the window is short because anything longer starts competing
// with the indexed copy.
const PENDING_NOTE_TTL_MS = 20_000;

const getStorage = () =>
  typeof window === "undefined" ? null : window.localStorage;

const readPendingNotes = (): PendingNote[] => {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(PENDING_NOTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Expired entries are dropped on the way through, so a note the subgraph
    // never indexed cannot linger as a permanent row.
    const cutoff = Date.now() - PENDING_NOTE_TTL_MS;
    return (parsed as PendingNote[]).filter(
      (note) => typeof note?.createdAt === "number" && note.createdAt * 1000 > cutoff,
    );
  } catch {
    return [];
  }
};

const writePendingNotes = (notes: PendingNote[]) => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(PENDING_NOTES_KEY, JSON.stringify(notes));
  } catch {
    // ignore storage errors
  }
};

const isSamePendingNote = (a: PendingNote, b: PendingNote): boolean => {
  if (a.invoiceId !== b.invoiceId) return false;
  if (a.noteId && b.noteId) return a.noteId === b.noteId;
  if (a.txHash && b.txHash) {
    return a.txHash.toLowerCase() === b.txHash.toLowerCase();
  }

  return (
    a.author.toLowerCase() === b.author.toLowerCase() &&
    a.share === b.share &&
    a.message === b.message
  );
};

export const addPendingNote = (note: PendingNote) => {
  const storage = getStorage();
  if (!storage) return;

  const existing = readPendingNotes();
  if (existing.some((saved) => isSamePendingNote(saved, note))) {
    return;
  }

  writePendingNotes([note, ...existing]);
};

export const getPendingNotesForOrder = (invoiceId: string): PendingNote[] =>
  readPendingNotes().filter((note) => note.invoiceId === invoiceId);

export const removePendingNote = (params: {
  invoiceId: string;
  noteId?: string;
  txHash?: string;
}) => {
  const storage = getStorage();
  if (!storage) return;

  const { invoiceId, noteId, txHash } = params;
  const existing = readPendingNotes();
  const filtered = existing.filter((note) => {
    if (note.invoiceId !== invoiceId) return true;
    if (noteId && note.noteId) return note.noteId !== noteId;
    if (txHash && note.txHash) {
      return note.txHash.toLowerCase() !== txHash.toLowerCase();
    }
    return true;
  });

  writePendingNotes(filtered);
};

/**
 * Clears pending notes that the subgraph has now indexed.
 *
 * Matched on tx hash as well as note id: the write endpoint answers with a tx
 * hash and no id, so an entry stored without one would otherwise never be
 * cleared and would reappear as a stuck "pending" row on every reload.
 */
export const removePendingNotesByIds = (
  invoiceId: string,
  noteIds: string[],
  txHashes: string[] = [],
) => {
  const storage = getStorage();
  if (!storage || (noteIds.length === 0 && txHashes.length === 0)) return;

  const idSet = new Set(noteIds);
  const txSet = new Set(txHashes.map((hash) => hash.toLowerCase()));
  const existing = readPendingNotes();
  const filtered = existing.filter((note) => {
    if (note.invoiceId !== invoiceId) return true;
    if (note.noteId && idSet.has(note.noteId)) return false;
    if (note.txHash && txSet.has(note.txHash.toLowerCase())) return false;
    return true;
  });

  writePendingNotes(filtered);
};

const postNotes = async (
  path: "/v1/notes" | "/v1/notes/open",
  payload: Record<string, unknown>,
): Promise<NotesApiResponse> => {
  const response = await fetch(`${CONTRACT_API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = (await response.json()) as NotesApiResponse;
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Notes request failed");
  }
  return data;
};

/**
 * Writes an already-sealed note. `content` is the envelope from `sealNote`;
 * the API relays the bytes unchanged and never sees the plaintext.
 */
export const createNote = async (payload: CreateNotePayload) =>
  postNotes("/v1/notes", {
    invoiceId: payload.invoiceId,
    author: payload.author,
    content: payload.content,
    share: payload.share,
  }).then((result) => {
    try {
      addPendingNote({
        invoiceId: payload.invoiceId,
        noteId: result.noteId?.toString?.() ?? result.noteId,
        author: payload.author,
        share: payload.share,
        message: payload.content,
        txHash: result.txHash,
        createdAt: Math.floor(Date.now() / 1000),
      });
    } catch {
      // ignore storage errors
    }
    return result;
  });

/** Only opening is recorded on chain; closing stays client-side. */
export const setNoteOpenState = async (payload: SetNoteStatePayload) =>
  postNotes("/v1/notes/open", {
    invoiceId: payload.invoiceId,
    author: payload.author,
    noteId: payload.noteId,
  });
