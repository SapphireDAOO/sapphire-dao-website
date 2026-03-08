"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useInvoiceNotes, ThreadNote } from "@/hooks/useInvoiceNotes";

const NOTES_PAGE_SIZE = 3;

const getActionLabel = (note: ThreadNote) => {
  if (note.opened) return "close";
  if (!note.hasOpenState) return "open";
  return "re-open";
};

export function NotesThread({
  orderId,
  onExpand,
  shareLabel,
}: {
  orderId: bigint;
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
  } = useInvoiceNotes(orderId, { enabled: true });

  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [share, setShare] = useState(false);
  const [notePage, setNotePage] = useState(0);

  const pagedNotes = notes.slice(
    notePage * NOTES_PAGE_SIZE,
    (notePage + 1) * NOTES_PAGE_SIZE,
  );
  const hasNextNotePage = (notePage + 1) * NOTES_PAGE_SIZE < notes.length;
  const hasPrevNotePage = notePage > 0;

  const handleCreateClick = useCallback(() => {
    onExpand();
    setIsComposerOpen(true);
  }, [onExpand]);

  const handleSave = useCallback(async () => {
    const saved = await createNote(draft, share);
    if (saved) {
      setDraft("");
      setShare(false);
      setIsComposerOpen(false);
      setNotePage(0);
    }
  }, [createNote, draft, share]);

  const handleCancel = useCallback(() => {
    setDraft("");
    setShare(false);
    setIsComposerOpen(false);
  }, []);

  const renderNote = (note: ThreadNote) => {
    const isUpdating = pendingNoteIds[note.noteId];
    const actionLabel = isUpdating
      ? "saving..."
      : note.isPending
      ? "pending"
      : getActionLabel(note);

    return (
      <Card key={note.id} className="transition-shadow hover:shadow-sm">
        <CardHeader className="py-2 px-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-semibold text-gray-700 truncate">
                {note.isAuthor ? "Created Note" : "Shared Note"}
              </span>
              <Badge
                className={
                  note.share
                    ? "bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0 cursor-default select-none hover:bg-blue-100"
                    : "bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0 cursor-default select-none hover:bg-gray-100"
                }
              >
                {note.share ? "Shared" : "Private"}
              </Badge>
            </div>
            <button
              type="button"
              className="text-[11px] text-blue-600 hover:underline disabled:text-gray-400 disabled:hover:no-underline shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                if (note.isPending || isUpdating) return;
                void setNoteOpen(note.noteId, !note.opened);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              disabled={note.isPending || isUpdating}
            >
              {actionLabel}
            </button>
          </div>

          <p className="text-[10px] text-gray-400 mt-0.5">{note.createdAtLabel}</p>

          {note.opened && (
            <p className="mt-1.5 text-[11px] text-gray-700 leading-relaxed">
              {note.message}
            </p>
          )}
        </CardHeader>
      </Card>
    );
  };

  return (
    <div
      className="mt-3 space-y-2"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">
          Notes{notes.length > 0 ? ` (${notes.length})` : ""}
        </span>
        <Button size="sm" variant="ghost" onClick={handleCreateClick}>
          Create Note
        </Button>
      </div>

      {isLoading ? (
        <p className="text-[11px] text-gray-400">Loading notes...</p>
      ) : notes.length === 0 ? (
        <p className="text-[11px] text-gray-400">No notes yet.</p>
      ) : (
        <>
          <div className="space-y-1.5">{pagedNotes.map(renderNote)}</div>

          {(hasPrevNotePage || hasNextNotePage) && (
            <div className="flex items-center justify-between pt-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                disabled={!hasPrevNotePage}
                onClick={(e) => {
                  e.stopPropagation();
                  setNotePage((p) => Math.max(0, p - 1));
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <ChevronLeft className="h-3 w-3 mr-0.5" />
                Prev
              </Button>
              <span className="text-[10px] text-gray-400">
                {notePage + 1} / {Math.ceil(notes.length / NOTES_PAGE_SIZE)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                disabled={!hasNextNotePage}
                onClick={(e) => {
                  e.stopPropagation();
                  setNotePage((p) => p + 1);
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                Next
                <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </div>
          )}
        </>
      )}

      {isComposerOpen && (
        <div
          className="space-y-2 rounded-md border border-gray-200 bg-white p-2"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a note"
            className="text-sm"
          />
          <label className="flex items-center gap-2 text-[11px] text-gray-600">
            <input
              type="checkbox"
              checked={share}
              onChange={(e) => setShare(e.target.checked)}
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
