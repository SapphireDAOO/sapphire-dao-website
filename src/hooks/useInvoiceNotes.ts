import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, usePublicClient, useSignMessage } from "wagmi";
import { toast } from "sonner";
import { notesClient } from "@/services/graphql/notes-client";
import { NOTES_BY_ORDER_QUERY } from "@/services/graphql/queries";
import {
  getPendingNotesForOrder,
  removePendingNote,
  removePendingNotesByIds,
  createNote as createNoteRequest,
  setNoteOpenState,
  decryptNoteContents,
  getCachedNoteReadAuth,
  setCachedNoteReadAuth,
  noteReadAuthMessage,
  type NoteReadAuth,
} from "@/services/notes";
import { unixToGMT } from "@/utils";
import {
  BASE_SEPOLIA,
  NOTES_CONTRACT,
  NOTES_SIGNER_ADDRESS,
} from "@/constants";
import { Notes } from "@/abis/Notes";

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
  options?: { enabled?: boolean }
) => {
  const isEnabled = options?.enabled ?? true;
  const { address, chain } = useAccount();
  const chainId = chain?.id || BASE_SEPOLIA;
  const publicClient = usePublicClient({ chainId });

  const { signMessageAsync } = useSignMessage();

  const [notes, setNotes] = useState<ThreadNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingNoteIds, setPendingNoteIds] = useState<Record<string, boolean>>(
    {}
  );

  const notesRef = useRef<ThreadNote[]>([]);
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

  // Read-auth signature for decrypting the viewer's private notes. Notes are
  // decrypted server-side (the key never ships to the browser); shared notes
  // need no auth, private ones require the author to sign once per session.
  const readAuthRef = useRef<NoteReadAuth | null>(null);
  const readAuthDeclinedRef = useRef(false);

  useEffect(() => {
    readAuthRef.current = null;
    readAuthDeclinedRef.current = false;
  }, [address, normalizedinvoiceId]);

  const ensureReadAuth = useCallback(
    async (promptIfMissing: boolean): Promise<NoteReadAuth | null> => {
      if (!address || normalizedinvoiceId === undefined) return null;
      const invoiceKey = normalizedinvoiceId.toString();

      const cached =
        readAuthRef.current ?? getCachedNoteReadAuth(address, invoiceKey);
      if (cached) {
        readAuthRef.current = cached;
        return cached;
      }

      if (!promptIfMissing || readAuthDeclinedRef.current) return null;

      const timestamp = Math.floor(Date.now() / 1000);
      try {
        const signature = await signMessageAsync({
          message: noteReadAuthMessage(invoiceKey, address, timestamp),
        });
        const auth: NoteReadAuth = { signature, timestamp };
        readAuthRef.current = auth;
        setCachedNoteReadAuth(address, invoiceKey, auth);
        return auth;
      } catch {
        // Rejected — leave private notes locked and don't nag again this session.
        readAuthDeclinedRef.current = true;
        return null;
      }
    },
    [address, normalizedinvoiceId, signMessageAsync],
  );

  const decryptMessages = useCallback(
    async (
      requests: { noteId: string; share: boolean; isAuthor: boolean }[],
      options?: { allowPrompt?: boolean },
    ): Promise<Map<string, string | null>> => {
      const decryptable = requests.filter((request) =>
        isNumericNoteId(request.noteId),
      );
      if (normalizedinvoiceId === undefined || decryptable.length === 0) {
        return new Map();
      }

      // Only private notes authored by the viewer need the signature; the
      // filters upstream never surface other users' private notes.
      const needsAuth = decryptable.some(
        (request) => !request.share && request.isAuthor,
      );
      const auth = needsAuth
        ? await ensureReadAuth(options?.allowPrompt ?? true)
        : null;

      try {
        return await decryptNoteContents({
          invoiceId: normalizedinvoiceId.toString(),
          noteIds: decryptable.map((request) => request.noteId),
          viewer: address,
          auth,
        });
      } catch (error) {
        console.error("Failed to decrypt notes", error);
        return new Map();
      }
    },
    [address, ensureReadAuth, normalizedinvoiceId],
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
            opened: false,
            hasOpenState: isAuthor,
            isAuthor,
            isPending: true,
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

  useEffect(() => {
    if (!isEnabled) return;
    if (!publicClient || normalizedinvoiceId === undefined) return;

    const contractAddress = NOTES_CONTRACT[chainId];
    if (!contractAddress) return;

    const viewer = (address || ZERO_ADDRESS).toLowerCase();
    const openStateUser = (NOTES_SIGNER_ADDRESS || viewer).toLowerCase();

    const unwatchCreated = publicClient.watchContractEvent({
      address: contractAddress,
      abi: Notes,
      eventName: "NoteCreated",
      onLogs: (logs) => {
        logs.forEach((log) => {
          const args = log.args as
            | {
                invoiceId?: bigint;
                invoiceNonce?: bigint;
                noteId?: bigint;
                author?: string;
                share?: boolean;
                encryptedContent?: string;
              }
            | undefined;

          const invoiceId = args?.invoiceId ?? args?.invoiceNonce;
          if (invoiceId == null || args?.noteId == null) return;
          if (invoiceId.toString() !== normalizedinvoiceId.toString()) return;

          const share = Boolean(args.share);
          const author = (args.author || "").toLowerCase();
          const isAuthor = Boolean(address && author === address.toLowerCase());

          if (!share && !isAuthor) return;

          const noteId = args.noteId.toString();
          // Decryption happens server-side; insert with a placeholder (or the
          // pending note's plaintext below) and patch the message once the
          // decrypt call resolves after this handler.
          const message = ENCRYPTED_NOTE_PLACEHOLDER;
          const txHash = log.transactionHash;
          const authorAddress = args.author || "";
          removePendingNote({
            invoiceId: normalizedinvoiceId.toString(),
            noteId,
            txHash,
          });

          setNotes((prev) => {
            if (prev.some((note) => note.noteId === noteId)) return prev;

            let pendingIndex = -1;

            if (txHash) {
              pendingIndex = prev.findIndex(
                (note) =>
                  note.isPending &&
                  note.txHash?.toLowerCase() === txHash.toLowerCase()
              );
            }

            if (pendingIndex < 0) {
              pendingIndex = prev.findIndex(
                (note) =>
                  note.isPending &&
                  note.share === share &&
                  note.author?.toLowerCase() === author &&
                  note.message === message
              );
            }

            if (pendingIndex < 0) {
              const pendingByAuthor = prev.filter(
                (note) =>
                  note.isPending &&
                  note.share === share &&
                  note.author?.toLowerCase() === author
              );
              if (pendingByAuthor.length === 1) {
                pendingIndex = prev.indexOf(pendingByAuthor[0]);
              }
            }

            if (pendingIndex >= 0) {
              const pending = prev[pendingIndex];
              const updated: ThreadNote = {
                ...pending,
                id: `${normalizedinvoiceId.toString()}-${noteId}`,
                noteId,
                author: authorAddress || pending.author,
                share,
                // The optimistic pending note already holds the plaintext the
                // user typed — keep it instead of the placeholder.
                message: pending.message || message,
                createdAtLabel: pending.createdAtLabel || formatNowLabel(),
                opened: pending.opened,
                hasOpenState: pending.hasOpenState || isAuthor,
                isAuthor,
                isPending: false,
                txHash: txHash || pending.txHash,
              };

              const next = [...prev];
              next[pendingIndex] = updated;
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
            }

            const nextNote: ThreadNote = {
              id: `${normalizedinvoiceId.toString()}-${noteId}`,
              noteId,
              author: authorAddress,
              share,
              message,
              createdAtLabel: formatNowLabel(),
              opened: false,
              hasOpenState: isAuthor,
              isAuthor,
              isPending: false,
              txHash,
            };

            return [nextNote, ...prev].sort((a, b) => {
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

          // Resolve the real content in the background. Never prompts for a
          // signature from an event — a cached read-auth is used if present,
          // otherwise the author's private note stays locked until the next
          // explicit fetch.
          void decryptMessages([{ noteId, share, isAuthor }], {
            allowPrompt: false,
          }).then((decrypted) => {
            const content = decrypted.get(noteId);
            if (!content) return;
            setNotes((prev) =>
              prev.map((note) =>
                note.noteId === noteId &&
                note.message === ENCRYPTED_NOTE_PLACEHOLDER
                  ? { ...note, message: content }
                  : note,
              ),
            );
          });
        });
      },
    });

    const unwatchState = publicClient.watchContractEvent({
      address: contractAddress,
      abi: Notes,
      eventName: "NoteStateChanged",
      onLogs: (logs) => {
        logs.forEach((log) => {
          const args = log.args as
            | {
                invoiceId?: bigint;
                invoiceNonce?: bigint;
                noteId?: bigint;
                user?: string;
                opened?: boolean;
              }
            | undefined;

          const invoiceId = args?.invoiceId ?? args?.invoiceNonce;
          if (
            invoiceId == null ||
            args?.noteId == null ||
            args?.user == null
          )
            return;
          if (invoiceId.toString() !== normalizedinvoiceId.toString()) return;
          if (args.user.toLowerCase() !== openStateUser) return;

          const noteId = args.noteId.toString();
          const opened = Boolean(args.opened);

          setNotes((prev) =>
            prev.map((note) =>
              note.noteId === noteId
                ? {
                    ...note,
                    opened,
                    hasOpenState: note.hasOpenState || opened,
                  }
                : note
            )
          );
        });
      },
    });

    return () => {
      unwatchCreated?.();
      unwatchState?.();
    };
  }, [
    address,
    chainId,
    normalizedinvoiceId,
    publicClient,
    isEnabled,
    decryptMessages,
  ]);

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

      const rawNotes = (data?.notes || []) as RawNote[];
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

      const visibleNotes = rawNotes.filter((note) => {
        if (note.share) return true;
        if (!address) return false;
        return note.author?.toLowerCase() === address.toLowerCase();
      });

      // Server-side decrypt for everything we are about to show: shared notes
      // need no auth; the viewer's own private notes ride on the (possibly
      // prompted) read-auth signature.
      const decrypted = await decryptMessages(
        visibleNotes.map((note) => ({
          noteId: note.noteId,
          share: note.share,
          isAuthor: address?.toLowerCase() === note.author?.toLowerCase(),
        })),
      );

      const mapped = visibleNotes
        .map((note) => {
          const isAuthor =
            address?.toLowerCase() === note.author?.toLowerCase();
          const message =
            decrypted.get(note.noteId) || ENCRYPTED_NOTE_PLACEHOLDER;
          const createdAtLabel = note.createdAtBlock
            ? blockCacheRef.current.get(note.createdAtBlock) ||
              `Block ${note.createdAtBlock}`
            : "-";

          const previousOpened = openStateMap.get(note.noteId);
          // Consider a note "opened" if the user previously set its state (persisted)
          // This prevents previously-read notes from re-appearing as "new" on each page load
          const opened = previousOpened ?? stateSet.has(note.noteId) ?? false;
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
          } as ThreadNote;
        })
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

      removePendingNotesByIds(
        normalizedinvoiceId.toString(),
        mapped.map((note) => note.noteId)
      );
      // Preserve any in-memory notes (pending OR confirmed) not yet indexed by
      // the subgraph. This prevents optimistic notes from disappearing on the
      // scheduled refresh when the subgraph hasn't caught up yet.
      setNotes((prev) => {
        const mappedIds = new Set(mapped.map((m) => m.noteId));
        const notYetIndexed = prev.filter((n) => !mappedIds.has(n.noteId));
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
        opened: false,
        hasOpenState: true,
        isAuthor: true,
        isPending: true,
        txHash: undefined,
      };
      setNotes((prev) => [optimistic, ...prev]);

      setIsCreating(true);

      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const message = `Sapphire DAO: Create note for order ${normalizedinvoiceId.toString()}\nAuthor: ${address}\nContent: ${trimmed}\nShare: ${share}\nTimestamp: ${timestamp}`;

        let signature: string;
        try {
          signature = await signMessageAsync({ message });
        } catch {
          toast.error("Signature rejected. Note not saved.");
          setNotes((prev) => prev.filter((n) => n.noteId !== localId));
          return false;
        }

        const result = await createNoteRequest({
          invoiceId: normalizedinvoiceId.toString(),
          author: address,
          content: trimmed,
          share,
          signature,
          timestamp,
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
              isPending: !noteId,
              txHash: result.txHash,
            };
          })
        );

        scheduleRefresh();
        return true;
      } catch (error) {
        console.error("Failed to create note", error);
        toast.error("Unable to save note.");
        // Roll back the optimistic note on failure
        setNotes((prev) => prev.filter((n) => n.noteId !== localId));
        return false;
      } finally {
        setIsCreating(false);
      }
    },
    [address, normalizedinvoiceId, scheduleRefresh, signMessageAsync, isEnabled]
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
        const timestamp = Math.floor(Date.now() / 1000);
        const message = `Sapphire DAO: Set note state for order ${normalizedinvoiceId.toString()}\nNoteId: ${noteId}\nOpen: ${open}\nAuthor: ${address}\nTimestamp: ${timestamp}`;

        let signature: string;
        try {
          signature = await signMessageAsync({ message });
        } catch {
          toast.error("Signature rejected. Note state not updated.");
          setNotes(previous);
          return false;
        }

        await setNoteOpenState({
          invoiceId: normalizedinvoiceId.toString(),
          noteId,
          open: true,
          author: address,
          signature,
          timestamp,
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
    [address, normalizedinvoiceId, signMessageAsync, isEnabled]
  );

  return {
    notes,
    isLoading,
    isCreating,
    pendingNoteIds,
    createNote,
    setNoteOpen,
    refresh,
  };
};
