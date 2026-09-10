"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNoteKeys } from "@/hooks/useNoteKeys";
import { formatAddress } from "@/utils";

/**
 * Publishing this account's note public key, which is what lets anyone else
 * seal a note that only this account can open.
 *
 * Registration is a one-time on-chain write: the contract stores one key per
 * account and rejects a second, so the button gives way to a status line once
 * the key is published rather than offering an action that would revert.
 */
export const MessagingKey = () => {
  const {
    enabled,
    isBusy,
    keys,
    publicKey,
    registeredKey,
    needsRegistration,
    keyMismatch,
    enable,
    register,
  } = useNoteKeys();

  const [isWorking, setIsWorking] = useState(false);
  const busy = isBusy || isWorking;

  const handleEnable = useCallback(async () => {
    setIsWorking(true);
    try {
      const ok = await enable();
      if (!ok) toast.error("Could not unlock your messaging key.");
    } finally {
      setIsWorking(false);
    }
  }, [enable]);

  const handleRegister = useCallback(async () => {
    setIsWorking(true);
    try {
      const { ok, reason } = await register();
      if (ok) {
        toast.success(
          "Your messaging key is published. Others can now send you notes.",
        );
        return;
      }
      // The contract's reason is the actionable part; without it this is just
      // "it failed".
      toast.error(reason ?? "Could not publish your messaging key.", {
        duration: reason ? 8000 : undefined,
      });
    } finally {
      setIsWorking(false);
    }
  }, [register]);

  if (registeredKey && !keyMismatch) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        <span>Messaging key published</span>
        <span className="font-mono text-muted-foreground">
          {formatAddress(registeredKey)}
        </span>
      </div>
    );
  }

  if (keyMismatch) {
    return (
      <div className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          The key published for this account is not the one your signature
          derives, so notes sealed to it cannot be opened here. That usually
          means it was registered from a different wallet, or that this wallet
          does not sign deterministically.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-2">
      <KeyRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1 text-[11px] text-muted-foreground">
        {enabled && keys
          ? "Publish your key so the other party can send you notes. One transaction, once per account."
          : "Notes are encrypted to you. Enable messaging to derive your key, then publish it so others can write to you."}
      </p>

      {enabled && keys ? (
        <Button
          size="sm"
          onClick={handleRegister}
          disabled={busy || !needsRegistration}
          aria-busy={busy}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publish key"}
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={handleEnable}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Enable messaging"
          )}
        </Button>
      )}

      {publicKey && !registeredKey && (
        <span className="w-full font-mono text-[10px] text-muted-foreground">
          {formatAddress(publicKey)}
        </span>
      )}
    </div>
  );
};
