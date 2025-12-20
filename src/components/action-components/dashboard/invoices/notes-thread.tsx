"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useInvoiceNotes, ThreadNote } from "@/hooks/useInvoiceNotes";

const getActionLabel = (note: ThreadNote) => {
  if (note.opened) return "close";
  if (!note.hasOpenState) return "open";
  return "re-open";
};

export function NotesThread({
  orderId,
  isExpanded,
  onExpand,
  shareLabel,
}: {
  orderId: bigint;
  isExpanded: boolean;
  onExpand: () => void;
  shareLabel: string;
}) {
  const {
    notes,
    isLoading,
    isCreating,
    pendingNoteIds,
    createNote,
    setNoteOpen,
  } = useInvoiceNotes(orderId);

  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [share, setShare] = useState(false);

  const ensureExpanded = useCallback(() => {
    if (!isExpanded) onExpand();
  }, [isExpanded, onExpand]);

  const handleCreateClick = useCallback(() => {
    ensureExpanded();
    setIsComposerOpen(true);
  }, [ensureExpanded]);

  const handleSave = useCallback(async () => {
    const saved = await createNote(draft, share);
    if (saved) {
      setDraft("");
      setShare(false);
      setIsComposerOpen(false);
    }
  }, [createNote, draft, share]);

  const handleCancel = useCallback(() => {
    setDraft("");
    setShare(false);
    setIsComposerOpen(false);
  }, []);

  const createdNotes = notes.filter(
    (note) => note.isAuthor && !note.hasOpenState
  );
  const openNotes = notes.filter((note) => !note.isAuthor || note.hasOpenState);

  const renderNotes = (list: ThreadNote[]) =>
    list.map((note) => {
      const isUpdating = pendingNoteIds[note.noteId];
      const actionLabel = isUpdating
        ? "saving..."
        : note.isPending
        ? "pending"
        : getActionLabel(note);

      return (
        <div
          key={note.id}
          className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-700">
              {note.isAuthor ? "Created Note" : "Shared Note"}{" "}
              {note.createdAtLabel}
            </span>
            <button
              type="button"
              className="text-[11px] text-blue-600 hover:underline disabled:text-gray-400 disabled:hover:no-underline"
              onClick={() => {
                if (note.isPending || isUpdating) return;
                ensureExpanded();
                void setNoteOpen(note.noteId, !note.opened);
              }}
              disabled={note.isPending || isUpdating}
            >
              {actionLabel}
            </button>
          </div>

          {isExpanded && note.opened && (
            <p className="mt-2 text-[11px] text-gray-600">
              &quot;{note.message}&quot;
            </p>
          )}
        </div>
      );
    });

  return (
    <div
      className="mt-3 space-y-2"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">Notes</span>
        <Button size="sm" variant="ghost" onClick={handleCreateClick}>
          Create Note
        </Button>
      </div>

      {isLoading ? (
        <p className="text-[11px] text-gray-400">Loading notes...</p>
      ) : notes.length === 0 ? (
        <p className="text-[11px] text-gray-400">No notes yet.</p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Open Notes
            </span>
            {openNotes.length > 0 ? (
              renderNotes(openNotes)
            ) : (
              <p className="text-[11px] text-gray-400">
                No open notes yet.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Created Notes
            </span>
            {createdNotes.length > 0 ? (
              renderNotes(createdNotes)
            ) : (
              <p className="text-[11px] text-gray-400">
                No created notes yet.
              </p>
            )}
          </div>
        </div>
      )}

      {isExpanded && isComposerOpen && (
        <div className="space-y-2 rounded-md border border-gray-200 bg-white p-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a note"
            className="text-sm"
          />
          <label className="flex items-center gap-2 text-[11px] text-gray-600">
            <input
              type="checkbox"
              checked={share}
              onChange={(event) => setShare(event.target.checked)}
              className="h-3.5 w-3.5"
            />
            <span>{shareLabel}</span>
          </label>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isCreating || !draft.trim()}
            >
              {isCreating ? "Saving..." : "Save"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={isCreating}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
