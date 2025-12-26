import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { toast } from "sonner";
import { notesClient } from "@/services/graphql/notes-client";
import { NOTES_BY_ORDER_QUERY } from "@/services/graphql/queries";
import {
  createNote as createNoteRequest,
  setNoteOpenState,
} from "@/services/notes";
import { decryptNoteBlob, unixToGMT } from "@/utils";
import {
  ETHEREUM_SEPOLIA,
  NOTES_CONTRACT,
  NOTES_SIGNER_ADDRESS,
} from "@/constants";
import { Notes } from "@/abis/Notes";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

type RawNote = {
  id: string;
  orderId: string;
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

export const useInvoiceNotes = (orderId?: bigint | string | number) => {
  const { address, chain } = useAccount();
  const chainId = chain?.id || ETHEREUM_SEPOLIA;
  const publicClient = usePublicClient({ chainId });

  const [notes, setNotes] = useState<ThreadNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingNoteIds, setPendingNoteIds] = useState<Record<string, boolean>>(
    {}
  );

  const notesRef = useRef<ThreadNote[]>([]);
  const blockCacheRef = useRef<Map<string, string>>(new Map());
  const configWarnedRef = useRef(false);
  const invalidOrderIdRef = useRef(false);

  const normalizedOrderId = useMemo(() => {
    if (orderId === undefined || orderId === null) return undefined;
    if (typeof orderId === "bigint") return orderId;
    if (typeof orderId === "number") {
      if (!Number.isFinite(orderId)) return undefined;
      return BigInt(Math.trunc(orderId));
    }

    const trimmed = orderId.trim();
    if (!trimmed) return undefined;

    try {
      return BigInt(trimmed);
    } catch {
      return undefined;
    }
  }, [orderId]);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    if (!publicClient || normalizedOrderId === undefined) return;

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
                orderId?: bigint;
                noteId?: bigint;
                author?: string;
                share?: boolean;
                encryptedContent?: string;
              }
            | undefined;

          if (args?.orderId == null || args?.noteId == null) return;
          if (args.orderId.toString() !== normalizedOrderId.toString()) return;

          const share = Boolean(args.share);
          const author = (args.author || "").toLowerCase();
          const isAuthor = Boolean(address && author === address.toLowerCase());

          if (!share && !isAuthor) return;

          const noteId = args.noteId.toString();
          const message =
            decryptNoteBlob(args.encryptedContent) || "Encrypted note";
          const txHash = log.transactionHash;
          const authorAddress = args.author || "";

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
                id: `${normalizedOrderId.toString()}-${noteId}`,
                noteId,
                author: authorAddress || pending.author,
                share,
                message,
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
              id: `${normalizedOrderId.toString()}-${noteId}`,
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
                orderId?: bigint;
                noteId?: bigint;
                user?: string;
                opened?: boolean;
              }
            | undefined;

          if (
            args?.orderId == null ||
            args?.noteId == null ||
            args?.user == null
          )
            return;
          if (args.orderId.toString() !== normalizedOrderId.toString()) return;
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
  }, [address, chainId, normalizedOrderId, publicClient]);

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
    if (normalizedOrderId === undefined) {
      setNotes([]);
      if (
        orderId !== undefined &&
        orderId !== null &&
        !invalidOrderIdRef.current
      ) {
        console.warn("Invalid orderId for notes:", orderId);
        invalidOrderIdRef.current = true;
      }
      return;
    }

    invalidOrderIdRef.current = false;
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
          orderId: normalizedOrderId.toString(),
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

      const mapped = rawNotes
        .filter((note) => {
          if (note.share) return true;
          if (!address) return false;
          return note.author?.toLowerCase() === address.toLowerCase();
        })
        .map((note) => {
          const isAuthor =
            address?.toLowerCase() === note.author?.toLowerCase();
          const message =
            decryptNoteBlob(note.encryptedContent) || "Encrypted note";
          const createdAtLabel = note.createdAtBlock
            ? blockCacheRef.current.get(note.createdAtBlock) ||
              `Block ${note.createdAtBlock}`
            : "-";

          const previousOpened = openStateMap.get(note.noteId);
          const opened = previousOpened ?? false;
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

      setNotes(mapped);
    } catch (error) {
      console.error("Failed to fetch notes", error);
      toast.error("Failed to load notes.");
    } finally {
      setIsLoading(false);
    }
  }, [address, chainId, hydrateBlockLabels, normalizedOrderId, orderId]);

  useEffect(() => {
    void fetchNotes();
  }, [fetchNotes]);

  const refresh = useCallback(async () => {
    await fetchNotes();
  }, [fetchNotes]);

  const createNote = useCallback(
    async (content: string, share: boolean) => {
      if (normalizedOrderId === undefined) return false;
      if (!address) {
        toast.error("Connect your wallet to add notes.");
        return false;
      }

      const trimmed = content.trim();
      if (!trimmed) {
        toast.error("Note cannot be empty.");
        return false;
      }

      setIsCreating(true);

      try {
        const result = await createNoteRequest({
          orderId: normalizedOrderId.toString(),
          author: address,
          content: trimmed,
          share,
        });

        const noteId = result.noteId?.toString?.() ?? result.noteId;
        const resolvedNoteId =
          noteId || `local-${Date.now().toString()}`;
        const resolvedTxHash =
          typeof result.txHash === "string"
            ? result.txHash.toLowerCase()
            : undefined;
          const optimistic: ThreadNote = {
            id: result.noteId
              ? `${normalizedOrderId.toString()}-${resolvedNoteId}`
              : `local-${resolvedNoteId}`,
            noteId: resolvedNoteId,
            author: address,
            share,
            message: trimmed,
            createdAtLabel: formatNowLabel(),
            opened: false,
            hasOpenState: true,
            isAuthor: true,
            isPending: !result.noteId,
            txHash: result.txHash,
          };

        setNotes((prev) => {
          if (
            prev.some(
              (note) =>
                note.noteId === resolvedNoteId ||
                (resolvedTxHash &&
                  note.txHash?.toLowerCase() === resolvedTxHash)
            )
          ) {
            return prev;
          }
          return [optimistic, ...prev];
        });
        return true;
      } catch (error) {
        console.error("Failed to create note", error);
        toast.error("Unable to save note.");
        return false;
      } finally {
        setIsCreating(false);
      }
    },
    [address, normalizedOrderId]
  );

  const setNoteOpen = useCallback(
    async (noteId: string, open: boolean) => {
      if (normalizedOrderId === undefined) return false;

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
          orderId: normalizedOrderId.toString(),
          noteId,
          open: true,
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
    [normalizedOrderId]
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
