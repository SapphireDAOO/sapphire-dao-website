"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { formatEther, parseEther, type Hash } from "viem";
import {
  ContractActionsContext,
  ContractLoadingContext,
  InvoiceStateContext,
} from "@/context/contract-context";
import { BASE_SEPOLIA, MAX_NOTE_LENGTH, ZERO_ADDRESS } from "@/constants";
import type { TokenData } from "@/model/model";
import { formatDurationSeconds } from "@/utils";
import { useGetInvoiceData } from "@/hooks/useGetInvoiceData";
import { useInvoiceNotes, ThreadNote } from "@/hooks/useInvoiceNotes";
import { fetchNotePublicKey, useNoteKeys } from "@/hooks/useNoteKeys";
import { useViemBalance } from "@/hooks/useViemBalance";
import { useUsdPrice } from "@/hooks/useUsdPrice";
import { sealNote } from "@/lib/noteCrypto";
import { Textarea } from "@/components/ui/textarea";
import { NoteLength } from "@/components/NoteLength";
import { MessagingKey } from "@/components/action-components/notes/MessagingKey";
import {
  BackLink,
  CheckoutHeader,
} from "@/components/action-components/checkout/CheckoutHeader";
import {
  PaymentShell,
  TextLink,
} from "@/components/action-components/checkout/CheckoutLayout";
import PaymentSteps from "@/components/action-components/checkout/PaymentSteps";

const ETH: TokenData = { id: ZERO_ADDRESS, name: "ETH", decimals: 18 };
const REDIRECT_SECONDS = 5;

export const dashboardLinks = (
  <BackLink href="/dashboard?tab=buyer" label="Dashboard" />
);

type InvoiceLike = {
  id?: string | number | bigint;
  price?: string | number | bigint;
  amount?: string | number | bigint;
  invoiceNonce?: string | number | bigint;
  status?: string | number;
  holdPeriod?: string | number | bigint | null;
};

const getInvoiceSeller = (invoice: unknown) => {
  const item = invoice as
    { seller?: unknown; [index: number]: unknown } | undefined;
  if (typeof item?.seller === "string" && item.seller) return item.seller;

  // ISimplePaymentProcessor.Invoice tuple index 10 is seller.
  const tupleSeller = item?.[10];
  return typeof tupleSeller === "string" && tupleSeller
    ? tupleSeller
    : undefined;
};

// Read from the contract the price is wei; the app's
// own invoice records hold it as an ETH string.
const toWei = (price: InvoiceLike["price"]): bigint | undefined => {
  try {
    if (typeof price === "bigint") return price;
    if (typeof price === "string" || typeof price === "number") {
      return parseEther(price.toString());
    }
  } catch {
    // Unparseable: treated as missing.
  }
  return undefined;
};

const RedirectNotice = ({ seconds }: { seconds?: number }) => (
  <p
    role="status"
    className="flex items-center gap-2 rounded-xl bg-white/70 p-3 font-medium text-stone-900"
  >
    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-900" />
    Redirecting to your dashboard
    {seconds !== undefined ? ` in ${seconds}s` : ""}…
  </p>
);

const PayFlow = ({ invoiceId }: { invoiceId: bigint }) => {
  const { address } = useAccount();
  const chainId = useChainId() || BASE_SEPOLIA;
  const publicClient = usePublicClient();
  const router = useRouter();

  const { makeInvoicePayment, watchInvoiceEvents, watchInvoiceStatus } =
    useContext(ContractActionsContext);
  const isLoading = useContext(ContractLoadingContext);
  const { invoiceData } = useContext(InvoiceStateContext);

  const { data: fetchedInvoice } = useGetInvoiceData(invoiceId);
  const { notes: invoiceNotes } = useInvoiceNotes(invoiceId);
  const noteKeys = useNoteKeys();
  // Followed live only while the wallet is short, so the
  // page can move on when the funds arrive.
  const [isShort, setIsShort] = useState(false);
  const { data: balance } = useViemBalance({
    address,
    chainId,
    watchBlock: isShort,
    refetchOnWindowFocus: true,
  });
  const { data: usdPerEth, dataUpdatedAt: rateUpdatedAt } = useUsdPrice("ETH");

  const [paymentNote, setPaymentNote] = useState("");
  const [shareNote, setShareNote] = useState(false);
  const [paid, setPaid] = useState(false);
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);
  const paymentSubmittedRef = useRef(false);

  useEffect(() => watchInvoiceEvents?.("simple"), [watchInvoiceEvents]);

  const liveInvoice = useMemo(
    () =>
      invoiceData.find(
        (inv) => inv.invoiceId?.toString() === invoiceId.toString(),
      ),
    [invoiceData, invoiceId],
  );

  const invoiceLike = (liveInvoice ?? fetchedInvoice) as
    InvoiceLike | undefined;
  const invoiceSeller =
    getInvoiceSeller(liveInvoice) ?? getInvoiceSeller(fetchedInvoice);
  const amount = toWei(invoiceLike?.price);

  useEffect(
    () =>
      setIsShort(
        amount !== undefined && balance !== undefined && balance < amount,
      ),
    [amount, balance],
  );

  const reference = useMemo(() => {
    const fetched = fetchedInvoice as
      | ({ invoiceNonce?: string | number | bigint } & {
          [index: number]: unknown;
        })
      | undefined;
    // Tuple fallback: index 0 is invoiceNonce. The app's Invoice.id holds the nonce.
    const nonce =
      fetched?.invoiceNonce ??
      (fetched?.[0] as string | number | bigint | undefined) ??
      invoiceLike?.invoiceNonce ??
      invoiceLike?.id;
    return nonce === undefined || nonce === null ? undefined : String(nonce);
  }, [fetchedInvoice, invoiceLike]);

  const holdPeriodSeconds = useMemo(() => {
    // holdPeriod is the field's pre-rename name.
    const fetched = fetchedInvoice as
      | { escrowHoldPeriod?: number | bigint; holdPeriod?: number | bigint }
      | undefined;
    const raw =
      fetched?.escrowHoldPeriod ??
      fetched?.holdPeriod ??
      invoiceLike?.holdPeriod;
    if (raw === undefined || raw === null) return undefined;
    const seconds = Number(raw);
    return Number.isFinite(seconds) ? seconds : undefined;
  }, [fetchedInvoice, invoiceLike]);

  const sharedCreatorNote = useMemo(() => {
    const creator = invoiceSeller?.toLowerCase();
    if (!creator) return undefined;

    return invoiceNotes
      .filter((note) => note.share && note.author?.toLowerCase() === creator)
      .reduce<ThreadNote | undefined>((earliest, note) => {
        if (!earliest) return note;
        try {
          return BigInt(note.noteId) < BigInt(earliest.noteId)
            ? note
            : earliest;
        } catch {
          return earliest;
        }
      }, undefined);
  }, [invoiceNotes, invoiceSeller]);

  const statusValue = invoiceLike?.status;
  const normalizedStatus =
    statusValue === undefined || statusValue === null
      ? undefined
      : String(statusValue).toUpperCase();
  const [liveStatus, setLiveStatus] = useState(normalizedStatus);

  useEffect(() => setLiveStatus(normalizedStatus), [normalizedStatus]);
  useEffect(
    () => watchInvoiceStatus?.(invoiceId, (status) => setLiveStatus(status)),
    [invoiceId, watchInvoiceStatus],
  );

  const canPay =
    liveStatus === "AWAITING PAYMENT" ||
    liveStatus === "CREATED" ||
    liveStatus === "1" ||
    liveStatus === undefined;

  const userIsCreator = Boolean(
    address &&
    invoiceSeller &&
    address.toLowerCase() === invoiceSeller.toLowerCase(),
  );

  // A settled invoice has nothing to pay; its parties follow it on the dashboard.
  const redirectsWhenSettled = Boolean(address && invoiceSeller);
  useEffect(() => {
    if (canPay || paid || !redirectsWhenSettled) return;
    if (isLoading === "makeInvoicePayment" || paymentSubmittedRef.current) {
      return;
    }
    router.push(`/dashboard?tab=${userIsCreator ? "seller" : "buyer"}`);
  }, [canPay, paid, redirectsWhenSettled, isLoading, userIsCreator, router]);

  useEffect(() => {
    if (!paid) return;
    if (countdown <= 0) {
      router.push("/dashboard?tab=buyer");
      return;
    }
    const timer = setTimeout(() => setCountdown((left) => left - 1), 1_000);
    return () => clearTimeout(timer);
  }, [paid, countdown, router]);

  const pay = async (onSubmitted: (hash: Hash) => void) => {
    if (amount === undefined) {
      toast.error("Invoice is missing its price.");
      return false;
    }

    try {
      let storageRef = "0x";
      const trimmedNote = paymentNote.trim();
      if (trimmedNote) {
        const keys = noteKeys.keys ?? (await noteKeys.unlock());
        if (!keys) {
          toast.error("Enable messaging to attach a note.");
          return false;
        }

        const readers = [keys.publicKey];
        if (shareNote && invoiceSeller) {
          const sellerKey = await fetchNotePublicKey(
            publicClient as never,
            chainId,
            invoiceSeller as `0x${string}`,
          );
          if (!sellerKey) {
            toast.error(
              "The invoice creator has not published a messaging key, so they could not read this note.",
            );
            return false;
          }
          readers.push(sellerKey);
        }
        storageRef = sealNote(trimmedNote, readers);
      }

      paymentSubmittedRef.current = true;
      const success = await makeInvoicePayment(
        amount,
        invoiceId,
        storageRef,
        shareNote,
        onSubmitted,
      );
      if (success) setPaid(true);
      else paymentSubmittedRef.current = false;
      return success;
    } catch (err) {
      paymentSubmittedRef.current = false;
      console.error("Payment failed:", err);
      toast.error("Payment failed. Please try again.");
      return false;
    }
  };

  const blocked = userIsCreator
    ? {
        title: "This is your own invoice",
        body: (
          <p>
            You can&apos;t pay an invoice you created. Share its payment link
            with your buyer.
          </p>
        ),
        status: "Created by you",
      }
    : !canPay && !paymentSubmittedRef.current
      ? {
          title: "This invoice can't be paid",
          body: (
            <>
              <p>It has already been paid or is closed.</p>
              {redirectsWhenSettled ? (
                <RedirectNotice />
              ) : (
                <p>You can follow it from your dashboard.</p>
              )}
            </>
          ),
          status: liveStatus
            ? `Invoice ${liveStatus.toLowerCase()}`
            : "Not payable",
        }
      : undefined;

  const holdNote =
    holdPeriodSeconds === undefined
      ? undefined
      : holdPeriodSeconds > 0
        ? `Held in escrow for ${formatDurationSeconds(holdPeriodSeconds)} once the seller accepts, then released to them.`
        : "No hold period: your payment goes to the seller as soon as they accept it.";

  return (
    <PaymentShell>
      <CheckoutHeader
        links={dashboardLinks}
        amountDue={{
          priceUsd:
            amount !== undefined && typeof usdPerEth === "number"
              ? Number(formatEther(amount)) * usdPerEth
              : undefined,
          billedInUsd: false,
          reference,
          amount,
          token: ETH,
          rateUpdatedAt,
        }}
      />
      <main>
        <PaymentSteps
          symbol={ETH.name}
          decimals={ETH.decimals}
          isNative
          amount={amount}
          balance={balance}
          blocked={blocked}
          paying={isLoading === "makeInvoicePayment"}
          onPay={pay}
          payDetails={
            <>
              {holdNote && (
                <p className="border-l-2 border-blue-900 pl-3">{holdNote}</p>
              )}
              {sharedCreatorNote && (
                <div className="rounded-xl bg-white/70 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                    Note from the seller
                  </p>
                  <p className="mt-1 text-stone-800">
                    {sharedCreatorNote.message}
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <label
                  htmlFor="paymentNote"
                  className="block font-medium text-stone-900"
                >
                  Add a note <span className="text-stone-400">(optional)</span>
                </label>
                <MessagingKey />
                <Textarea
                  id="paymentNote"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="A note about this payment"
                  className="min-h-20 border-stone-300 bg-white/70 text-xs sm:text-sm"
                  maxLength={MAX_NOTE_LENGTH}
                />
                <NoteLength value={paymentNote} />
                <label className="flex items-start gap-2 text-[11px] text-stone-500 sm:text-xs">
                  <input
                    type="checkbox"
                    checked={shareNote}
                    onChange={(e) => setShareNote(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  />
                  <span>
                    Share it with the seller. Unchecked, only you can read it.
                  </span>
                </label>
              </div>
            </>
          }
          paidDetails={
            <>
              {holdNote && <p>{holdNote}</p>}
              <RedirectNotice seconds={countdown} />
            </>
          }
          exitLinks={
            <TextLink
              href={`/dashboard?tab=${userIsCreator ? "seller" : "buyer"}`}
            >
              Go to dashboard
            </TextLink>
          }
        />
      </main>
    </PaymentShell>
  );
};

export default PayFlow;
