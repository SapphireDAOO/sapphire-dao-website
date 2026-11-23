"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConnection } from "wagmi";
import type { Address } from "viem";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessagingKey } from "@/components/action-components/notes/MessagingKey";
import { NoteLength } from "@/components/NoteLength";
import { MAX_NOTE_LENGTH } from "@/constants";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  MessageSquarePlus,
} from "lucide-react";
import { toast } from "sonner";
import { WALLET_CANCELLED } from "@/lib/walletErrors";
import { useInvoiceNotes, ThreadNote } from "@/hooks/useInvoiceNotes";
import { Invoice } from "@/model/model";
import { getLastActionTime } from "@/lib/invoiceHistory";

const NOTES_PAGE_SIZE = 3;
const NOTE_LOCK_DAYS = 3;
const MS_PER_DAY = 86_400_000;

const ALWAYS_LOCKED_STATUSES = new Set(["CANCELED"]);

const TIMED_LOCK_STATUSES = new Set([
  "EXPIRED",
  "RELEASED",
  "REFUNDED",
  "REJECTED",
  "DISPUTE_SETTLED",
  "DISPUTE SETTLED",
]);

const toMs = (t: string): number => {
  const n = Number(t);
  if (!isNaN(n) && n > 1_000_000) return n * 1000; // unix seconds
  return Date.parse(t) || 0;
};

function getNoteBlockReason(invoice: Invoice): string | null {
  const status = (invoice.status ?? "").replace(/_/g, " ").toUpperCase().trim();

  if (ALWAYS_LOCKED_STATUSES.has(status)) {
    return `Notes are disabled for ${status.toLowerCase()} invoices.`;
  }

  if (TIMED_LOCK_STATUSES.has(status)) {
    const lastTime = getLastActionTime(invoice);
    if (lastTime) {
      const elapsed = Date.now() - toMs(lastTime);
      if (elapsed >= NOTE_LOCK_DAYS * MS_PER_DAY) {
        return `Notes are disabled ${NOTE_LOCK_DAYS} days after the invoice is ${status.toLowerCase()}.`;
      }
    }
  }

  return null;
}

const getActionLabel = (note: ThreadNote) => {
  if (note.opened) return "close";
  if (!note.hasOpenState) return "open";
  return "re-open";
};

export function NotesThread({
  invoiceId,
  invoice,
  onExpand,
  shareLabel,
  expanded,
}: {
  invoiceId: bigint;
  invoice: Invoice;
  onExpand: () => void;
  shareLabel: string;
  expanded: boolean;
}) {
  const { address } = useConnection();

  const counterparty = useMemo(() => {
    const viewer = address?.toLowerCase();
    const seller = invoice.seller?.toLowerCase();
    const buyer = invoice.buyer?.toLowerCase();
    if (!viewer) return undefined;
    if (seller && seller !== viewer) return seller as Address;
    if (buyer && buyer !== viewer) return buyer as Address;
    return undefined;
  }, [address, invoice.seller, invoice.buyer]);
  const noteBlockReason = getNoteBlockReason(invoice);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isNotesEnabled = isInView && expanded;

  const {
    notes,
    isLoading,
    isCreating,
    pendingNoteIds,
    unreadableCount,
    isUnlocked,
    unlockNotes,
    createNote,
    setNoteOpen,
  } = useInvoiceNotes(invoiceId, { enabled: isNotesEnabled, counterparty });

  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [share, setShare] = useState(false);
  const [notePage, setNotePage] = useState(0);
  const [isRevealing, setIsRevealing] = useState(false);

  const unreadCount = useMemo(
    () => notes.filter((n) => !n.opened && !n.isAuthor && n.share).length,
    [notes],
  );

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
      toast.success("Note submitted. It will appear once confirmed.");
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
      <div
        key={note.id}
        className="rounded-lg border border-border bg-background px-3.5 py-3"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium">
                {note.isAuthor ? "Created note" : "Shared note"}
              </span>
              <span
                className={cn(
                  "rounded border px-1.5 py-px font-mono text-[10px] uppercase tracking-wider",
                  note.share
                    ? "border-info/30 bg-info/10 text-info-foreground"
                    : "border-border bg-muted text-muted-foreground",
                )}
              >
                {note.share ? "Shared" : "Private"}
              </span>
              {!note.opened && !note.isAuthor && note.share && (
                <span
                  className="size-1.5 rounded-full bg-primary"
                  aria-label="Unread"
                />
              )}
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {note.createdAtLabel}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 text-xs font-medium text-primary hover:underline disabled:text-muted-foreground disabled:hover:no-underline"
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

        {note.opened && (
          <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed">
            {note.message}
          </p>
        )}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="space-y-2.5"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Notes ({notes.length})
          </span>
          {unreadCount > 0 && (
            <span className="rounded bg-primary px-1.5 py-px font-mono text-[10px] font-semibold uppercase text-primary-foreground">
              {unreadCount} new
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleCreateClick}
          disabled={!!noteBlockReason}
          title={noteBlockReason ?? undefined}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:text-muted-foreground disabled:hover:no-underline"
        >
          <MessageSquarePlus className="size-3.5" aria-hidden="true" />
          Create note
        </button>
      </div>

      {expanded && (
        <>
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Loading notes…</p>
          ) : notes.length === 0 ? (
            unreadableCount > 0 ? (
              <p className="text-[11px] text-warning-foreground">
                {unreadableCount} {unreadableCount === 1 ? "note" : "notes"} on
                this invoice could not be opened with your messaging key. They
                were sealed to a different key — usually one published before
                the key was re-registered.
              </p>
            ) : (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                No notes on this invoice yet.
              </p>
            )
          ) : !isUnlocked ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-3">
              <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <p className="min-w-0 flex-1 text-[11px] text-muted-foreground">
                {notes.length} {notes.length === 1 ? "note is" : "notes are"}{" "}
                encrypted. Sign to read them.
              </p>
              <Button
                size="sm"
                disabled={isRevealing}
                aria-busy={isRevealing}
                onClick={async (e) => {
                  e.stopPropagation();
                  setIsRevealing(true);
                  try {
                    const { keys, rejected } = await unlockNotes();
                    if (rejected) toast(WALLET_CANCELLED);
                    else if (!keys) toast.error("Could not unlock your notes.");
                  } finally {
                    setIsRevealing(false);
                  }
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {isRevealing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Show notes"
                )}
              </Button>
            </div>
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
                  <span className="font-mono text-[10px] text-muted-foreground">
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
        </>
      )}

      {isComposerOpen && (
        <div
          className="space-y-2 rounded-lg border border-border bg-background p-3"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <MessagingKey />
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a note"
            className="text-sm"
            maxLength={MAX_NOTE_LENGTH}
          />
          <NoteLength value={draft} />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
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
