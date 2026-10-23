"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNoteKeys } from "@/hooks/useNoteKeys";
import { formatAddress } from "@/utils";
import { signsInAnotherApp } from "@/lib/walletApp";

export const MessagingKey = () => {
  const {
    isBusy,
    keys,
    publicKey,
    registeredKey,
    keyMismatch,
    enable,
    register,
  } = useNoteKeys();

  const [isWorking, setIsWorking] = useState(false);
  const busy = isBusy || isWorking;

  // Creating the key is a signature and publishing it a transaction. One click
  // does both, except where the second prompt would reopen a phone's wallet
  // app without a tap; there each gets its own button.
  const [twoStep, setTwoStep] = useState(false);
  useEffect(() => setTwoStep(signsInAnotherApp()), []);
  const showCreate = twoStep && !keys;

  const handleCreate = useCallback(async () => {
    setIsWorking(true);
    try {
      const ok = await enable();
      if (!ok) toast.error("Could not create your messaging key.");
    } finally {
      setIsWorking(false);
    }
  }, [enable]);

  const handlePublish = useCallback(async () => {
    setIsWorking(true);
    try {
      if (!keys && !(await enable())) {
        toast.error("Could not create your messaging key.");
        return;
      }
      const { ok, reason } = await register();
      if (ok) {
        toast.success(
          "Your messaging key is published. Others can now send you notes.",
        );
        return;
      }
      toast.error(reason ?? "Could not publish your messaging key.", {
        duration: reason ? 8000 : undefined,
      });
    } finally {
      setIsWorking(false);
    }
  }, [enable, keys, register]);

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
        {keys
          ? "Publish your key so others can send you notes. One transaction, once per account."
          : showCreate
            ? "Notes are encrypted to you. Create your key, then publish it so others can write to you."
            : "Publish your messaging key so others can send you notes. One signature creates it, then one transaction publishes it."}
      </p>

      <Button
        size="sm"
        onClick={showCreate ? handleCreate : handlePublish}
        disabled={busy || Boolean(registeredKey)}
        aria-busy={busy}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : showCreate ? (
          "Create key"
        ) : (
          "Publish key"
        )}
      </Button>

      {publicKey && !registeredKey && (
        <span className="w-full font-mono text-[10px] text-muted-foreground">
          {formatAddress(publicKey)}
        </span>
      )}
    </div>
  );
};
