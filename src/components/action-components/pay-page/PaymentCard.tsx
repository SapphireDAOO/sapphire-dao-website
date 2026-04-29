"use client";

import { useAccount, usePublicClient } from "wagmi";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContractContext } from "@/context/contract-context";
import { CircleCheckBig, Loader2 } from "lucide-react";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { PaymentCardProps } from "@/model/model";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatEther, parseEther, type AbiEvent } from "viem";
import { useGetInvoiceData } from "@/hooks/useGetInvoiceData";
import { useInvoiceNotes, ThreadNote } from "@/hooks/useInvoiceNotes";
import { SIMPLE_PAYMENT_PROCESSOR } from "@/constants";
import { paymentProcessor } from "@/abis/PaymentProcessor";
import { BASE_SEPOLIA } from "@/constants";
import { formatAddress } from "@/utils";
import { Textarea } from "@/components/ui/textarea";

type InvoiceLike = {
  id?: string | number | bigint;
  price?: string | number | bigint;
  amount?: string | number | bigint;
  invoiceId?: string | number | bigint;
  invoiceNonce?: string | number | bigint;
  status?: string | number;
  seller?: string;
  note?: string;
  notes?: { message?: string }[];
};

const paymentStatusFromEvent = {
  InvoicePaid: "PAID",
  InvoiceAccepted: "ACCEPTED",
  InvoiceRejected: "REFUNDED",
  InvoiceRefunded: "REFUNDED",
  InvoiceReleased: "RELEASED",
  InvoiceCanceled: "CANCELED",
} as const;

const paymentStatusEventNames = new Set(Object.keys(paymentStatusFromEvent));

const paymentStatusEvents = (
  paymentProcessor as readonly { type: string; name?: string }[]
).filter(
  (item): item is AbiEvent =>
    item.type === "event" &&
    typeof item.name === "string" &&
    paymentStatusEventNames.has(item.name),
);

const getInvoiceSeller = (invoice: unknown) => {
  const item = invoice as
    | { seller?: unknown; [index: number]: unknown }
    | undefined;
  if (typeof item?.seller === "string" && item.seller) return item.seller;

  // ISimplePaymentProcessor.Invoice tuple index 8 is seller.
  const tupleSeller = item?.[8];
  return typeof tupleSeller === "string" && tupleSeller ? tupleSeller : undefined;
};

const PaymentCard = ({ data }: PaymentCardProps) => {
  const { address, chain } = useAccount();
  const publicClient = usePublicClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [userIsCreator, setUserIsCreator] = useState(false);
  const [creatorChecked, setCreatorChecked] = useState(false);

  const [countdown, setCountdown] = useState(3);
  const [paymentNote, setPaymentNote] = useState("");
  const [shareNote, setShareNote] = useState(false);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const paymentSubmittedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const invoiceId = data?.invoiceId !== undefined
    ? BigInt(data.invoiceId)
    : undefined;
  const { data: fetchedInvoice } = useGetInvoiceData(invoiceId);
  const { notes: invoiceNotes } = useInvoiceNotes(invoiceId);
  const contractAddress = SIMPLE_PAYMENT_PROCESSOR[chain?.id || BASE_SEPOLIA];

  const {
    invoiceData,
    makeInvoicePayment,
    isLoading,
    refetchInvoiceData,
  } = useContext(ContractContext);

  const liveInvoice = useMemo(() => {
    if (!invoiceId) return undefined;
    return invoiceData.find(
      (inv) => inv.invoiceId?.toString() === invoiceId.toString(),
    );
  }, [invoiceData, invoiceId]);

  const resolvedInvoice = liveInvoice ?? fetchedInvoice;
  const invoiceLike = resolvedInvoice as InvoiceLike | undefined;
  const invoiceSeller = useMemo(
    () => getInvoiceSeller(liveInvoice) ?? getInvoiceSeller(fetchedInvoice),
    [fetchedInvoice, liveInvoice],
  );

  const displayinvoiceId = useMemo(() => {
    const fetched = fetchedInvoice as
      | ({ invoiceNonce?: string | number | bigint; invoiceId?: string | number | bigint } & {
          [index: number]: unknown;
        })
      | undefined;
    const live = liveInvoice as InvoiceLike | undefined;

    // Prefer nonce directly from chain response for accuracy.
    const nonceFromChain = fetched?.invoiceNonce ?? fetched?.invoiceId;
    if (nonceFromChain !== undefined && nonceFromChain !== null) {
      return nonceFromChain;
    }

    // Viem tuple fallback: index 0 is invoice nonce in current ABI.
    if (fetched && fetched[0] !== undefined && fetched[0] !== null) {
      return fetched[0] as string | number | bigint;
    }

    // Subgraph/app cache fallback.
    return (
      live?.invoiceNonce ??
      live?.invoiceId ??
      invoiceLike?.invoiceNonce ??
      invoiceLike?.invoiceId ??
      invoiceLike?.id ??
      invoiceLike?.invoiceId ??
      ""
    );
  }, [fetchedInvoice, liveInvoice, invoiceLike]);

  const displayPriceEth =
    invoiceLike?.price ?? invoiceLike?.amount ?? null;
  const statusValue = invoiceLike?.status;
  const normalizedStatus =
    statusValue === undefined || statusValue === null
      ? undefined
      : String(statusValue).toUpperCase();

  const [liveStatus, setLiveStatus] = useState<string | undefined>(
    normalizedStatus,
  );

  const sharedCreatorNote = useMemo(() => {
    if (!invoiceNotes.length) return undefined;

    const sharedNotes = invoiceNotes.filter((note) => note.share);
    if (!sharedNotes.length) return undefined;

    const creator = invoiceSeller?.toLowerCase();
    if (!creator) return undefined;

    const creatorNotes = sharedNotes.filter(
      (note) => note.author?.toLowerCase() === creator,
    );

    if (!creatorNotes.length) return undefined;

    return creatorNotes.reduce<ThreadNote | undefined>((earliest, note) => {
      if (!earliest) return note;
      try {
        const earliestId = BigInt(earliest.noteId);
        const currentId = BigInt(note.noteId);
        return currentId < earliestId ? note : earliest;
      } catch {
        return earliest;
      }
    }, undefined);
  }, [invoiceNotes, invoiceSeller]);

  useEffect(() => {
    setLiveStatus(normalizedStatus);
  }, [normalizedStatus]);

  useEffect(() => {
    if (!publicClient || !invoiceId) return;

    const activeChainId = chain?.id || BASE_SEPOLIA;
    const processorAddress = SIMPLE_PAYMENT_PROCESSOR[activeChainId];
    if (!processorAddress) return;

    const unwatch = publicClient.watchEvent({
      address: processorAddress,
      events: paymentStatusEvents,
      onLogs: (logs) => {
        for (const log of logs) {
          const name = log.eventName as
            | keyof typeof paymentStatusFromEvent
            | undefined;
          const nextStatus = name ? paymentStatusFromEvent[name] : undefined;
          if (!nextStatus) continue;

          const args = log.args as
            | { invoiceId?: bigint; invoiceNonce?: bigint }
            | undefined;
          const id = (args?.invoiceId ?? args?.invoiceNonce)?.toString();
          if (id !== invoiceId.toString()) continue;
          setLiveStatus(nextStatus);
        }
      },
    });

    return () => {
      unwatch();
    };
  }, [publicClient, invoiceId, chain?.id]);

  const canPay =
    liveStatus === "AWAITING PAYMENT" ||
    liveStatus === "CREATED" ||
    liveStatus === "1" ||
    liveStatus === undefined;

  useEffect(() => {
    if (!address || !invoiceId) {
      setUserIsCreator(false);
      setCreatorChecked(false);
      return;
    }

    if (!invoiceSeller) {
      setUserIsCreator(false);
      setCreatorChecked(false);
      return;
    }

    setUserIsCreator(address.toLowerCase() === invoiceSeller.toLowerCase());
    setCreatorChecked(true);
  }, [address, invoiceId, invoiceSeller]);

  useEffect(() => {
    if (!invoiceId || canPay || open) return;
    if (
      !creatorChecked ||
      isLoading === "makeInvoicePayment" ||
      paymentSubmittedRef.current
    ) {
      return;
    }

    const nextTab = userIsCreator ? "seller" : "buyer";

    const redirect = async () => {
      await refetchInvoiceData?.();
      router.push(`/dashboard?tab=${nextTab}`);
    };

    void redirect();
  }, [
    invoiceId,
    canPay,
    open,
    creatorChecked,
    isLoading,
    userIsCreator,
    refetchInvoiceData,
    router,
  ]);

  const handlePayment = async () => {
    const priceEth = (() => {
      const priceVal = invoiceLike?.price;
      if (typeof priceVal === "bigint") return formatEther(priceVal);
      if (typeof priceVal === "string") return priceVal;
      if (typeof priceVal === "number") return priceVal.toString();
      return undefined;
    })();

    if (!priceEth || !invoiceId) {
      toast.error("Invoice is missing price or order ID.");
      return;
    }

    let priceWei: bigint;
    try {
      priceWei = parseEther(priceEth);
    } catch {
      toast.error("Invalid invoice amount.");
      return;
    }

    try {
      paymentSubmittedRef.current = true;
      const paid = await makeInvoicePayment(
        priceWei,
        invoiceId,
        paymentNote.trim(),
        shareNote,
      );

      if (paid) {
        setOpen(true);

        setCountdown(3);

        countdownIntervalRef.current = setInterval(() => {
          setCountdown((prev) => {
            const next = prev - 1;

            if (next <= 0) {
              clearInterval(countdownIntervalRef.current!);
              countdownIntervalRef.current = null;
              router.push("/dashboard?tab=buyer");
            }

            return next;
          });
        }, 1000);
      } else {
        paymentSubmittedRef.current = false;
      }
    } catch (err) {
      paymentSubmittedRef.current = false;
      console.error("Payment failed:", err);
      toast.error("Payment failed. Please try again.");
    }
  };

  return (
    <>
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Please Pay Invoice</CardTitle>
          <CardDescription>
            This invoice is bounded to the blockchain by contract{" "}
            {contractAddress ? (
              <a
                href={`https://sepolia.basescan.org/address/${contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                {formatAddress(contractAddress)}
              </a>
            ) : (
              "—"
            )}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-2">
              <Label htmlFor="id">Invoice ID</Label>
              <Input
                id="id"
                value={displayinvoiceId?.toString() ?? "Loading..."}
                disabled
              />
            </div>

            <div className="flex flex-col space-y-2 mt-3">
              <Label htmlFor="price">Requested Amount</Label>
              <Input
                id="price"
                value={(() => {
                  if (!displayPriceEth) return "Loading...";
                  if (typeof displayPriceEth === "bigint") {
                    return `${formatEther(displayPriceEth)} ETH`;
                  }
                  if (
                    typeof displayPriceEth === "string" ||
                    typeof displayPriceEth === "number"
                  ) {
                    return `${displayPriceEth} ETH`;
                  }
                  return "Loading...";
                })()}
                disabled
              />
            </div>

            {sharedCreatorNote && (
              <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-semibold text-gray-600">
                  Invoice note from creator
                </p>
                <p className="mt-1 text-sm text-gray-700">
                  {sharedCreatorNote.message}
                </p>
              </div>
            )}

            <div className="flex flex-col space-y-2 mt-3">
              <Label htmlFor="paymentNote">Payment Note (optional)</Label>
              <Textarea
                id="paymentNote"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="Add a note about this payment"
                className="min-h-24"
              />
              <label className="flex items-center gap-2 text-[11px] text-gray-600">
                <input
                  type="checkbox"
                  checked={shareNote}
                  onChange={(e) => setShareNote(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                <span>
                  Share with the invoice creator (leave unchecked to keep it
                  private)
                </span>
              </label>
            </div>
          </div>
        </CardContent>

        <CardFooter>
          {address ? (
            <Button
              onClick={handlePayment}
              className="w-full"
              disabled={
                !canPay ||
                userIsCreator ||
                !invoiceId ||
                isLoading === "makeInvoicePayment"
              }
            >
              {isLoading === "makeInvoicePayment" ? (
                <>
                  <span>Processing...</span>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                </>
              ) : !canPay ? (
                "RESOLVED"
              ) : (
                "Make Payment"
              )}
            </Button>
          ) : (
            <ConnectButton chainStatus="icon" showBalance={false} />
          )}
          {isLoading === "makeInvoicePayment" && (
            <p className="mt-3 w-full text-center text-xs text-gray-500">
              Payment is processing. Keep this tab open—this may take up to a
              minute.
            </p>
          )}
        </CardFooter>
      </Card>

      {/* Popup */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-8 text-center shadow-lg">
            <DialogTitle className="text-2xl font-bold text-green-700">
              Payment Successful
            </DialogTitle>

            <div className="my-6">
              <CircleCheckBig
                size={80}
                color="#22c55e"
                strokeWidth={2.5}
                className="mx-auto animate-pulse"
              />
            </div>

            <p className="text-gray-600 mb-2">
              Your payment has been processed successfully.
            </p>

            {/* NEW Countdown display */}
            <p className="text-sm text-gray-500">
              Redirecting to <span className="font-medium">Dashboard</span> in{" "}
              <span className="font-bold">{countdown}</span>s...
            </p>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  );
};

export default PaymentCard;
