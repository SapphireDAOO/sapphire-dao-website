export type CreateNotePayload = {
  invoiceId: string;
  author: string;
  content: string;
  share: boolean;
  signature: string;
  timestamp: number;
};

export type SetNoteStatePayload = {
  invoiceId: string;
  noteId: string;
  open: boolean;
  author: string;
  signature: string;
  timestamp: number;
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

const getStorage = () =>
  typeof window === "undefined" ? null : window.sessionStorage;

const readPendingNotes = (): PendingNote[] => {
  const storage = getStorage();
  if (!storage) return [];
  const raw = storage.getItem(PENDING_NOTES_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingNote[]) : [];
  } catch {
    return [];
  }
};

const writePendingNotes = (notes: PendingNote[]) => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(PENDING_NOTES_KEY, JSON.stringify(notes));
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

export const removePendingNotesByIds = (invoiceId: string, noteIds: string[]) => {
  const storage = getStorage();
  if (!storage || noteIds.length === 0) return;

  const idSet = new Set(noteIds);
  const existing = readPendingNotes();
  const filtered = existing.filter(
    (note) => note.invoiceId !== invoiceId || !note.noteId || !idSet.has(note.noteId)
  );

  writePendingNotes(filtered);
};

const postNotesAction = async (payload: Record<string, unknown>) => {
  const response = await fetch("/api/notes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = (await response.json()) as NotesApiResponse;
  if (!response.ok || !data.success) {
    const message = data.error || "Notes request failed";
    throw new Error(message);
  }

  return data;
};

export type NoteReadAuth = {
  signature: string;
  timestamp: number;
};

export type DecryptNotesPayload = {
  invoiceId: string;
  noteIds: string[];
  viewer?: string;
  auth?: NoteReadAuth | null;
};

// Server-side read-auth signatures stay valid for 24h; refresh a little early
// so an in-flight request never straddles the expiry.
const READ_AUTH_TTL_SECONDS = 23 * 60 * 60;
const READ_AUTH_STORAGE_PREFIX = "sapphire.noteReadAuth";

const readAuthStorageKey = (viewer: string, invoiceId: string) =>
  `${READ_AUTH_STORAGE_PREFIX}:${viewer.toLowerCase()}:${invoiceId}`;

export const noteReadAuthMessage = (
  invoiceId: string,
  viewer: string,
  timestamp: number,
) =>
  `Sapphire DAO: Read notes for order ${invoiceId}\nViewer: ${viewer}\nTimestamp: ${timestamp}`;

export const getCachedNoteReadAuth = (
  viewer: string,
  invoiceId: string,
): NoteReadAuth | null => {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(readAuthStorageKey(viewer, invoiceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NoteReadAuth;
    if (
      typeof parsed?.signature !== "string" ||
      typeof parsed?.timestamp !== "number"
    ) {
      return null;
    }
    const ageSeconds = Math.floor(Date.now() / 1000) - parsed.timestamp;
    if (ageSeconds < 0 || ageSeconds > READ_AUTH_TTL_SECONDS) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const setCachedNoteReadAuth = (
  viewer: string,
  invoiceId: string,
  auth: NoteReadAuth,
) => {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(readAuthStorageKey(viewer, invoiceId), JSON.stringify(auth));
  } catch {
    // ignore storage errors
  }
};

/**
 * Encrypt note content with the server-held key (the key never ships to the
 * browser). Used for the storageRef note embedded in create/pay transactions.
 */
export const encryptNoteContent = async (
  content: string,
): Promise<`0x${string}`> => {
  const data = await postNotesAction({ action: "encrypt", content });
  const payload = (data as { payload?: string }).payload;
  if (typeof payload !== "string" || !payload.startsWith("0x")) {
    throw new Error("Encryption service returned an invalid payload");
  }
  return payload as `0x${string}`;
};

/**
 * Decrypt notes server-side by (invoiceId, noteId). Shared notes decrypt for
 * anyone; private notes require the author's read-auth signature. Returns a
 * map of noteId → plaintext (null when not readable by this viewer).
 */
export const decryptNoteContents = async ({
  invoiceId,
  noteIds,
  viewer,
  auth,
}: DecryptNotesPayload): Promise<Map<string, string | null>> => {
  const result = new Map<string, string | null>();
  if (noteIds.length === 0) return result;

  const data = await postNotesAction({
    action: "decrypt",
    invoiceId,
    noteIds,
    viewer,
    signature: auth?.signature,
    timestamp: auth?.timestamp,
  });

  const notes = (data as {
    notes?: { noteId: string; content: string | null }[];
  }).notes;

  for (const note of notes ?? []) {
    result.set(note.noteId, note.content);
  }
  return result;
};

export const createNote = async (payload: CreateNotePayload) =>
  postNotesAction({ action: "create", ...payload }).then((result) => {
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

export const setNoteOpenState = async (payload: SetNoteStatePayload) =>
  postNotesAction({ action: "setOpened", ...payload });
