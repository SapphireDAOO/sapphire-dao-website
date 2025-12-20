export type CreateNotePayload = {
  orderId: string;
  author: string;
  content: string;
  share: boolean;
};

export type SetNoteStatePayload = {
  orderId: string;
  noteId: string;
  open: boolean;
};

export type NotesApiResponse = {
  success: boolean;
  error?: string;
  txHash?: string;
  noteId?: string;
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

export const createNote = async (payload: CreateNotePayload) =>
  postNotesAction({ action: "create", ...payload });

export const setNoteOpenState = async (payload: SetNoteStatePayload) =>
  postNotesAction({ action: "setOpened", ...payload });
