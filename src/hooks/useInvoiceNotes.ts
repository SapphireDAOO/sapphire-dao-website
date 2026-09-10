import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { toast } from "sonner";
import { notesClient } from "@/services/graphql/notes-client";
import { NOTES_BY_ORDER_QUERY } from "@/services/graphql/queries";
import {
  getPendingNotesForOrder,
  removePendingNotesByIds,
  createNote as createNoteRequest,
  setNoteOpenState,
} from "@/services/notes";
import { openNote, sealNote } from "@/lib/noteCrypto";
import { useNoteKeys, fetchNotePublicKey } from "@/hooks/useNoteKeys";
import { unixToGMT } from "@/utils";
import {
  BASE_SEPOLIA,
  NOTES_CONTRACT,
  NOTES_SIGNER_ADDRESS,
} from "@/constants";
import { Notes } from "@/abis/Notes";
import type { Address, Hex } from "viem";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const NOTE_REFRESH_DELAY_MS = 5_000;
// Shown until (or unless) the server-side decrypt resolves a note's content.
const ENCRYPTED_NOTE_PLACEHOLDER = "Encrypted note";

const isNumericNoteId = (noteId: string) => {
  try {
    BigInt(noteId);
    return true;
  } catch {
    return false;
  }
};

type RawNote = {
  id: string;
  invoiceId: string;
  noteId: string;
  author: string;
  share: boolean;
  encryptedContent: string;
  createdAtBlock?: string;
  createdAtTx?: string;
};

type RawNoteOpenState = {
  noteId: string;
  opened: boolean;
};

export type ThreadNote = {
  id: string;
  noteId: string;
  author: string;
  share: boolean;
  message: string;
  createdAtLabel: string;
  opened: boolean;
  hasOpenState: boolean;
  isAuthor: boolean;
  isPending: boolean;
  txHash?: string;
};

const formatNowLabel = () => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return unixToGMT(nowSeconds) || new Date().toLocaleString();
};

export const useInvoiceNotes = (
  invoiceId?: bigint | string | number,
  options?: {
    enabled?: boolean;
    /** The other party on the invoice, so a shared note can be sealed to them. */
    counterparty?: Address;
  }
) => {
  const isEnabled = options?.enabled ?? true;
  const counterparty = options?.counterparty;
  const { address, chain } = useAccount();
  const chainId = chain?.id || BASE_SEPOLIA;
  const publicClient = usePublicClient({ chainId });

  const [notes, setNotes] = useState<ThreadNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  // Notes that exist on chain but will not open with this key. Hiding them
  // silently makes a key mismatch look like "there are no notes", which is the
  // one thing the reader must not conclude.
  const [unreadableCount, setUnreadableCount] = useState(0);
  const [pendingNoteIds, setPendingNoteIds] = useState<Record<string, boolean>>(
    {}
  );

  const noteKeys = useNoteKeys();

  const notesRef = useRef<ThreadNote[]>([]);
  // Sealed bodies straight from the subgraph, kept so decryption can happen
  // locally without re-querying.
  const ciphertextRef = useRef<Map<string, Hex>>(new Map());
  const blockCacheRef = useRef<Map<string, string>>(new Map());
  const configWarnedRef = useRef(false);
  const invalidinvoiceIdRef = useRef(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizedinvoiceId = useMemo(() => {
    if (invoiceId === undefined || invoiceId === null) return undefined;
    if (typeof invoiceId === "bigint") return invoiceId;
    if (typeof invoiceId === "number") {
      if (!Number.isFinite(invoiceId)) return undefined;
      return BigInt(Math.trunc(invoiceId));
    }

    const trimmed = invoiceId.trim();
    if (!trimmed) return undefined;

    try {
      return BigInt(trimmed);
    } catch {
      return undefined;
    }
  }, [invoiceId]);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  // Decryption is local: the note body is sealed to this account's note key,
  // so opening it needs no request and no second signature. A note this key
  // is not a reader of simply stays closed.
  const decryptMessages = useCallback(
    async (
      requests: { noteId: string; share: boolean; isAuthor: boolean }[],
    ): Promise<Map<string, string | null>> => {
      const result = new Map<string, string | null>();
      const readable = requests.filter((request) =>
        isNumericNoteId(request.noteId),
      );
      if (readable.length === 0) return result;

      // Never prompts. Notes stay sealed until the reader asks for them, so
      // the signature is a deliberate act rather than something that fires
      // whenever a card scrolls into view.
      const keys = noteKeys.keys;
      if (!keys) return result;

      for (const request of readable) {
        const payload = ciphertextRef.current.get(request.noteId);
        if (!payload) continue;
        result.set(request.noteId, openNote(payload, keys.privateKey));
      }
      return result;
    },
    [noteKeys],
  );

  useEffect(() => {
    if (!isEnabled) return;
    if (normalizedinvoiceId === undefined) return;
    const pending = getPendingNotesForOrder(normalizedinvoiceId.toString());
    if (pending.length === 0) return;

    setNotes((prev) => {
      let next = [...prev];
      pending.forEach((note) => {
        const hasDuplicate = next.some((existing) => {
          if (note.noteId && existing.noteId === note.noteId) return true;
          if (
            note.txHash &&
            existing.txHash?.toLowerCase() === note.txHash.toLowerCase()
          ) {
            return true;
          }
          return (
            existing.isPending &&
            existing.author?.toLowerCase() === note.author.toLowerCase() &&
            existing.message === note.message &&
            existing.share === note.share
          );
        });
        if (hasDuplicate) return;

        const createdAtLabel = note.createdAt
          ? unixToGMT(note.createdAt) || formatNowLabel()
          : formatNowLabel();
        const isAuthor = Boolean(
          address && address.toLowerCase() === note.author.toLowerCase()
        );

        next = [
          {
            id: note.noteId
              ? `${note.invoiceId}-${note.noteId}`
              : `local-${note.invoiceId}-${Date.now().toString()}`,
            noteId: note.noteId || `local-${Date.now().toString()}`,
            author: note.author,
            share: note.share,
            message: note.message,
            createdAtLabel,
            // Its own author wrote it, so it is not something they need to
            // open; and the plaintext is in hand, so it is a real row rather
            // than a placeholder waiting on the indexer.
            opened: isAuthor,
            hasOpenState: isAuthor,
            isAuthor,
            isPending: false,
            txHash: note.txHash,
          },
          ...next,
        ];
      });

      return next.sort((a, b) => {
        try {
          const aKey = BigInt(a.noteId);
          const bKey = BigInt(b.noteId);
          if (aKey === bKey) return 0;
          return aKey > bKey ? -1 : 1;
        } catch {
          return 0;
        }
      });
    });
  }, [address, normalizedinvoiceId, isEnabled]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isEnabled && refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  }, [isEnabled]);


  const hydrateBlockLabels = useCallback(
    async (blockNumbers: string[]) => {
      if (!blockNumbers.length) return;

      const uniqueBlocks = Array.from(new Set(blockNumbers));
      const missingBlocks = uniqueBlocks.filter(
        (blockNumber) => !blockCacheRef.current.has(blockNumber)
      );

      if (!missingBlocks.length) return;

      if (!publicClient) {
        missingBlocks.forEach((blockNumber) => {
          blockCacheRef.current.set(blockNumber, `Block ${blockNumber}`);
        });
        return;
      }

      const results = await Promise.all(
        missingBlocks.map(async (blockNumber) => {
          try {
            const block = await publicClient.getBlock({
              blockNumber: BigInt(blockNumber),
            });
            const label = unixToGMT(Number(block.timestamp));
            return { blockNumber, label: label || `Block ${blockNumber}` };
          } catch {
            return { blockNumber, label: `Block ${blockNumber}` };
          }
        })
      );

      results.forEach(({ blockNumber, label }) => {
        blockCacheRef.current.set(blockNumber, label);
      });
    },
    [publicClient]
  );

  const fetchNotes = useCallback(async () => {
    if (!isEnabled) return;

    if (normalizedinvoiceId === undefined) {
      setNotes([]);
      if (
        invoiceId !== undefined &&
        invoiceId !== null &&
        !invalidinvoiceIdRef.current
      ) {
        console.warn("Invalid invoiceId for notes:", invoiceId);
        invalidinvoiceIdRef.current = true;
      }
      return;
    }

    invalidinvoiceIdRef.current = false;
    setIsLoading(true);

    try {
      const graphClient = notesClient(chainId);
      if (!graphClient) {
        if (!configWarnedRef.current) {
          console.warn("Notes subgraph is not configured.");
          toast.error(
            "Notes subgraph not configured."
          );
          configWarnedRef.current = true;
        }
        setNotes([]);
        return;
      }

      const viewer = (address || ZERO_ADDRESS).toLowerCase();
      const openStateUser = (
        NOTES_SIGNER_ADDRESS || viewer
      ).toLowerCase();
      const { data, error } = await graphClient
        .query(NOTES_BY_ORDER_QUERY, {
          invoiceId: normalizedinvoiceId.toString(),
          user: openStateUser,
        })
        .toPromise();

      if (error) {
        const message = error.message || "Notes subgraph error";
        if (
          message.includes("has no field `notes`") ||
          message.includes("has no field `noteOpenStates`")
        ) {
          if (!configWarnedRef.current) {
            console.warn("Notes subgraph schema mismatch:", message);
            toast.error(
              "Notes subgraph missing notes fields."
            );
            configWarnedRef.current = true;
          }
          setNotes([]);
          return;
        }
        throw new Error(message);
      }

      // `id` is "<invoiceId>-<noteId>", so the note id survives even when the
      // field itself is not selected or is missing from an older deployment.
      const rawNotes = ((data?.notes || []) as RawNote[]).map((note) => ({
        ...note,
        noteId: note.noteId ?? note.id?.split("-").pop() ?? "",
      }));

      // Decryption is local, so the sealed bodies have to be kept as they
      // arrive; without this there is nothing to open and every note renders
      // empty.
      for (const note of rawNotes) {
        if (note.noteId && note.encryptedContent) {
          ciphertextRef.current.set(note.noteId, note.encryptedContent as Hex);
        }
      }
      const rawStates = (data?.noteOpenStates || []) as RawNoteOpenState[];

      const stateSet = new Set(rawStates.map((state) => state.noteId));
      const openStateMap = new Map(
        notesRef.current.map((note) => [note.noteId, note.opened])
      );
      const hasOpenedMap = new Map(
        notesRef.current.map((note) => [note.noteId, note.hasOpenState])
      );

      await hydrateBlockLabels(
        rawNotes.map((note) => note.createdAtBlock).filter(Boolean) as string[]
      );

      // A private note never appears outside its author's view. This asks for
      // positive proof before listing one - shared, or provably authored by
      // the reader - so a note whose `share`/`author` the subgraph did not
      // return is withheld rather than shown on the chance that it is public.
      // It also keeps other people's private notes out of the "could not be
      // opened" count below, where they would look like a key problem.
      const reader = address?.toLowerCase();
      const visibleNotes = rawNotes.filter((note) => {
        if (!note.noteId) return false;
        if (note.share === true) return true;
        return Boolean(reader) && note.author?.toLowerCase() === reader;
      });

      const decrypted = await decryptMessages(
        visibleNotes.map((note) => ({
          noteId: note.noteId,
          share: note.share,
          isAuthor: address?.toLowerCase() === note.author?.toLowerCase(),
        })),
      );

      let unreadable = 0;
      const mapped = visibleNotes
        .map((note) => {
          const isAuthor =
            address?.toLowerCase() === note.author?.toLowerCase();
          // A note that will not open with this key was not written for this
          // reader, so it is dropped rather than shown as an unreadable row.
          // While the key is still locked nothing can be judged, so the
          // placeholder stands in instead of hiding the whole thread.
          const openedMessage = decrypted.get(note.noteId);
          if (openedMessage == null && noteKeys.keys) {
            unreadable += 1;
            return null;
          }
          const message = openedMessage ?? ENCRYPTED_NOTE_PLACEHOLDER;
          const createdAtLabel = note.createdAtBlock
            ? blockCacheRef.current.get(note.createdAtBlock) ||
              `Block ${note.createdAtBlock}`
            : "-";

          const previousOpened = openStateMap.get(note.noteId);
          // Consider a note "opened" if the user previously set its state (persisted)
          // This prevents previously-read notes from re-appearing as "new" on each page load
          // An author has, by definition, already read their own note.
          const opened =
            isAuthor || (previousOpened ?? stateSet.has(note.noteId) ?? false);
          const hasOpenState =
            stateSet.has(note.noteId) ||
            hasOpenedMap.get(note.noteId) === true ||
            isAuthor;

          return {
            id: note.id,
            noteId: note.noteId,
            author: note.author,
            share: note.share,
            message,
            createdAtLabel,
            opened,
            hasOpenState,
            isAuthor: Boolean(isAuthor),
            isPending: false,
            txHash: note.createdAtTx,
          } as ThreadNote;
        })
        .filter((note): note is ThreadNote => note !== null)
        .sort((a, b) => {
          try {
            const aKey = BigInt(a.noteId);
            const bKey = BigInt(b.noteId);
            if (aKey === bKey) return 0;
            return aKey > bKey ? -1 : 1;
          } catch {
            return 0;
          }
        });

      setUnreadableCount(unreadable);

      removePendingNotesByIds(
        normalizedinvoiceId.toString(),
        mapped.map((note) => note.noteId),
        mapped
          .map((note) => note.txHash)
          .filter((hash): hash is string => Boolean(hash)),
      );
      // Preserve any in-memory notes (pending OR confirmed) not yet indexed by
      // the subgraph. This prevents optimistic notes from disappearing on the
      // scheduled refresh when the subgraph hasn't caught up yet.
      setNotes((prev) => {
        const mappedIds = new Set(mapped.map((m) => m.noteId));
        // An optimistic note keeps its local id, because the write endpoint
        // answers with a tx hash and no note id. Matching on the id alone
        // therefore never reconciles it, and the row sits at "pending"
        // forever beside its indexed twin. The tx hash is what they share.
        const mappedTx = new Set(
          mapped
            .map((m) => m.txHash?.toLowerCase())
            .filter((hash): hash is string => Boolean(hash)),
        );
        const notYetIndexed = prev.filter(
          (n) =>
            !mappedIds.has(n.noteId) &&
            !(n.txHash && mappedTx.has(n.txHash.toLowerCase())),
        );
        if (notYetIndexed.length === 0) return mapped;
        return [...notYetIndexed, ...mapped].sort((a, b) => {
          try {
            const aKey = BigInt(a.noteId);
            const bKey = BigInt(b.noteId);
            if (aKey === bKey) return 0;
            return aKey > bKey ? -1 : 1;
          } catch {
            return 0;
          }
        });
      });
    } catch (error) {
      console.error("Failed to fetch notes", error);
      toast.error("Failed to load notes.");
    } finally {
      setIsLoading(false);
    }
  }, [
    address,
    chainId,
    decryptMessages,
    hydrateBlockLabels,
    // Unlocking mid-session must re-run the fetch, or notes stay hidden until
    // something else happens to trigger one.
    noteKeys.keys,
    normalizedinvoiceId,
    invoiceId,
    isEnabled,
  ]);

  useEffect(() => {
    if (!isEnabled) return;
    void fetchNotes();
  }, [fetchNotes, isEnabled]);


  const refresh = useCallback(async () => {
    if (!isEnabled) return;
    await fetchNotes();
  }, [fetchNotes, isEnabled]);

  const scheduleRefresh = useCallback(() => {
    if (!isEnabled) return;
    if (refreshTimeoutRef.current) return;
    refreshTimeoutRef.current = setTimeout(() => {
      void fetchNotes();
      refreshTimeoutRef.current = null;
    }, NOTE_REFRESH_DELAY_MS);
  }, [fetchNotes, isEnabled]);

  // The subgraph is the only source the thread renders from, so these watchers
  // do not build notes out of event data - they just say "something changed"
  // and let the fetch supply it. Reading a note from the log and the subgraph
  // separately is how the two drift apart.
  useEffect(() => {
    if (!isEnabled) return;
    if (!publicClient || normalizedinvoiceId === undefined) return;

    const contractAddress = NOTES_CONTRACT[chainId];
    if (!contractAddress) return;

    const refreshOnMatch = (
      logs: { args?: { invoiceId?: bigint; invoiceNonce?: bigint } }[],
    ) => {
      const touched = logs.some((log) => {
        const id = log.args?.invoiceId ?? log.args?.invoiceNonce;
        return id != null && id.toString() === normalizedinvoiceId.toString();
      });
      if (touched) scheduleRefresh();
    };

    const unwatchCreated = publicClient.watchContractEvent({
      address: contractAddress,
      abi: Notes,
      eventName: "NoteCreated",
      onLogs: refreshOnMatch,
    });

    const unwatchState = publicClient.watchContractEvent({
      address: contractAddress,
      abi: Notes,
      eventName: "NoteStateChanged",
      onLogs: refreshOnMatch,
    });

    return () => {
      unwatchCreated?.();
      unwatchState?.();
    };
  }, [chainId, normalizedinvoiceId, publicClient, isEnabled, scheduleRefresh]);

  const createNote = useCallback(
    async (content: string, share: boolean) => {
      if (!isEnabled) return false;
      if (normalizedinvoiceId === undefined) return false;
      if (!address) {
        toast.error("Connect your wallet to add notes.");
        return false;
      }

      const trimmed = content.trim();
      if (!trimmed) {
        toast.error("Note cannot be empty.");
        return false;
      }

      // Add optimistic note immediately so the user sees it right away,
      // before the signature prompt and the API call complete.
      const localId = `local-${Date.now().toString()}`;
      const optimistic: ThreadNote = {
        id: localId,
        noteId: localId,
        author: address,
        share,
        message: trimmed,
        createdAtLabel: formatNowLabel(),
        opened: true,
        hasOpenState: true,
        isAuthor: true,
        isPending: false,
        txHash: undefined,
      };
      setNotes((prev) => [optimistic, ...prev]);

      setIsCreating(true);

      try {
        // Seal to this account and, when shared, to the counterparty. The API
        // stores the envelope as opaque bytes, so this is the only point the
        // plaintext exists outside the two readers' browsers.
        const keys = noteKeys.keys ?? (await noteKeys.unlock());
        if (!keys) {
          toast.error("Enable messaging to write notes.");
          setNotes((prev) => prev.filter((n) => n.noteId !== localId));
          return false;
        }

        const readers: Hex[] = [keys.publicKey];
        if (share && counterparty) {
          const peerKey = await fetchNotePublicKey(
            publicClient as never,
            chainId,
            counterparty,
          );
          if (!peerKey) {
            toast.error(
              "The other party has not enabled messaging yet, so they could not read this note.",
            );
            setNotes((prev) => prev.filter((n) => n.noteId !== localId));
            return false;
          }
          readers.push(peerKey);
        }

        const result = await createNoteRequest({
          invoiceId: normalizedinvoiceId.toString(),
          author: address,
          content: sealNote(trimmed, readers),
          share,
        });

        const noteId = result.noteId?.toString?.() ?? result.noteId;
        const resolvedNoteId = noteId || localId;

        // Upgrade the optimistic note with the real IDs from the server
        setNotes((prev) =>
          prev.map((n) => {
            if (n.noteId !== localId) return n;
            return {
              ...n,
              id: noteId
                ? `${normalizedinvoiceId.toString()}-${resolvedNoteId}`
                : localId,
              noteId: resolvedNoteId,
              isPending: false,
              txHash: result.txHash,
            };
          })
        );

        scheduleRefresh();
        return true;
      } catch (error) {
        // The API's message names the actual problem - the service being
        // unreachable, or the author not being a party on this invoice - and
        // "unable to save" names none of them.
        console.error("Failed to create note", error);
        toast.error(
          error instanceof Error && error.message
            ? error.message
            : "Unable to save note.",
        );
        // Roll back the optimistic note on failure
        setNotes((prev) => prev.filter((n) => n.noteId !== localId));
        return false;
      } finally {
        setIsCreating(false);
      }
    },
    [address, chainId, counterparty, noteKeys, publicClient, normalizedinvoiceId, scheduleRefresh, isEnabled]
  );

  const setNoteOpen = useCallback(
    async (noteId: string, open: boolean) => {
      if (!isEnabled) return false;
      if (normalizedinvoiceId === undefined) return false;
      if (!address) {
        toast.error("Connect your wallet to update notes.");
        return false;
      }

      const current = notesRef.current.find((note) => note.noteId === noteId);
      if (!current) return false;

      const canPersist =
        current.share &&
        !current.isPending &&
        (() => {
          try {
            BigInt(noteId);
            return true;
          } catch {
            return false;
          }
        })();
      const shouldPersistOpen = open && !current.hasOpenState && canPersist;
      const nextHasOpenState = current.hasOpenState || open;
      const previous = notesRef.current;

      setNotes((prev) =>
        prev.map((note) =>
          note.noteId === noteId
            ? { ...note, opened: open, hasOpenState: nextHasOpenState }
            : note
        )
      );

      if (!shouldPersistOpen) {
        return true;
      }

      setPendingNoteIds((prev) => ({ ...prev, [noteId]: true }));

      try {
        await setNoteOpenState({
          invoiceId: normalizedinvoiceId.toString(),
          noteId,
          author: address,
        });
        return true;
      } catch (error) {
        console.error("Failed to update note state", error);
        toast.error("Unable to update note state.");
        setNotes(previous);
        return false;
      } finally {
        setPendingNoteIds((prev) => {
          const next = { ...prev };
          delete next[noteId];
          return next;
        });
      }
    },
    [address, normalizedinvoiceId, isEnabled]
  );

  return {
    notes,
    isLoading,
    isCreating,
    pendingNoteIds,
    unreadableCount,
    /** False until the reader unlocks; every note reads as sealed until then. */
    isUnlocked: Boolean(noteKeys.keys),
    unlockNotes: noteKeys.unlock,
    createNote,
    setNoteOpen,
    refresh,
  };
};
