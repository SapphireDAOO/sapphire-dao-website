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
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
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
import { formatEther, parseEther } from "viem";
import { useGetInvoiceData } from "@/hooks/useGetInvoiceData";
import { useInvoiceNotes, ThreadNote } from "@/hooks/useInvoiceNotes";
import { SIMPLE_PAYMENT_PROCESSOR } from "@/constants";
import { paymentProcessor } from "@/abis/PaymentProcessor";
import { ETHEREUM_SEPOLIA } from "@/constants";
import { Textarea } from "@/components/ui/textarea";

type InvoiceLike = {
  id?: string | number | bigint;
  price?: string | number | bigint;
  amount?: string | number | bigint;
  orderId?: string | number | bigint;
  invoiceId?: string | number | bigint;
  status?: string | number;
  seller?: string;
  note?: string;
  notes?: { message?: string }[];
};

const PaymentCard = ({ data }: PaymentCardProps) => {
  const { address, chain } = useAccount();
  const publicClient = usePublicClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [userIsCreator, setUserIsCreator] = useState(false);

  const [countdown, setCountdown] = useState(3);
  const [paymentNote, setPaymentNote] = useState("");
  const [shareNote, setShareNote] = useState(false);

  const orderId = data?.orderId;
  const { data: fetchedInvoice } = useGetInvoiceData(orderId);
  const { notes: invoiceNotes } = useInvoiceNotes(orderId);

  const { invoiceData, getInvoiceOwner, makeInvoicePayment, isLoading } =
    useContext(ContractContext);

  const liveInvoice = useMemo(() => {
    if (!orderId) return undefined;
    return invoiceData.find(
      (inv) => inv.orderId?.toString() === orderId.toString()
    );
  }, [invoiceData, orderId]);

  const resolvedInvoice = liveInvoice ?? fetchedInvoice;
  const invoiceLike = resolvedInvoice as InvoiceLike | undefined;

  const displayOrderId =
    invoiceLike?.invoiceId ?? invoiceLike?.id ?? invoiceLike?.orderId ?? "";

  const displayPriceEth =
    invoiceLike?.price ?? invoiceLike?.amount ?? data?.price ?? null;
  const statusValue = invoiceLike?.status ?? data?.status;
  const normalizedStatus =
    statusValue === undefined || statusValue === null
      ? undefined
      : String(statusValue).toUpperCase();

  const [liveStatus, setLiveStatus] = useState<string | undefined>(
    normalizedStatus
  );

  const sharedCreatorNote = useMemo(() => {
    if (!invoiceNotes.length) return undefined;

    const sharedNotes = invoiceNotes.filter((note) => note.share);
    if (!sharedNotes.length) return undefined;

    const creator =
      typeof invoiceLike?.seller === "string"
        ? invoiceLike.seller.toLowerCase()
        : undefined;
    if (!creator) return undefined;

    const creatorNotes = sharedNotes.filter(
      (note) => note.author?.toLowerCase() === creator
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
  }, [invoiceNotes, invoiceLike?.seller]);

  useEffect(() => {
    setLiveStatus(normalizedStatus);
  }, [normalizedStatus]);

  useEffect(() => {
    if (!publicClient || !orderId) return;

    const shouldSubscribe =
      liveStatus === "AWAITING PAYMENT" ||
      liveStatus === "CREATED" ||
      liveStatus === "1" ||
      liveStatus === undefined;

    if (!shouldSubscribe) return;

    const activeChainId = chain?.id || ETHEREUM_SEPOLIA;

    const statusFromEvent: Record<
      | "InvoicePaid"
      | "InvoiceAccepted"
      | "InvoiceRejected"
      | "InvoiceRefunded"
      | "InvoiceReleased"
      | "InvoiceCanceled",
      string
    > = {
      InvoicePaid: "PAID",
      InvoiceAccepted: "ACCEPTED",
      InvoiceRejected: "REFUNDED",
      InvoiceRefunded: "REFUNDED",
      InvoiceReleased: "RELEASED",
      InvoiceCanceled: "CANCELED",
    };

    const eventNames: Array<keyof typeof statusFromEvent> = [
      "InvoicePaid",
      "InvoiceAccepted",
      "InvoiceRejected",
      "InvoiceRefunded",
      "InvoiceReleased",
      "InvoiceCanceled",
    ];

    const unwatch = eventNames.map((name) =>
      publicClient.watchContractEvent({
        address: SIMPLE_PAYMENT_PROCESSOR[activeChainId],
        abi: paymentProcessor,
        eventName: name,
        onLogs: (logs) => {
          for (const log of logs) {
            const id = (log.args?.orderId as bigint | undefined)?.toString();
            if (id !== orderId?.toString()) continue;
            setLiveStatus(statusFromEvent[name]);
          }
        },
      })
    );

    return () => {
      unwatch.forEach((u) => u?.());
    };
  }, [publicClient, orderId, chain?.id, liveStatus]);

  const canPay =
    liveStatus === "AWAITING PAYMENT" ||
    liveStatus === "CREATED" ||
    liveStatus === "1" ||
    liveStatus === undefined;

  const isCreator = useCallback(async () => {
    if (!orderId) return false;
    const creator = await getInvoiceOwner(orderId.toString());
    return address?.toLowerCase() === creator?.toLowerCase();
  }, [address, getInvoiceOwner, orderId]);

  useEffect(() => {
    const check = async () => {
      if (address && orderId) {
        const result = await isCreator();
        setUserIsCreator(result);
      }
    };
    check();
  }, [address, orderId, isCreator]);

  const handlePayment = async () => {
    const priceEth = (() => {
      const priceVal = invoiceLike?.price;
      if (typeof priceVal === "bigint") return formatEther(priceVal);
      if (typeof priceVal === "string") return priceVal;
      if (typeof priceVal === "number") return priceVal.toString();
      return data?.price;
    })();

    if (!priceEth || !orderId) {
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
      if (
        await makeInvoicePayment(
          priceWei,
          orderId,
          paymentNote.trim(),
          shareNote
        )
      ) {
        setOpen(true);

        setCountdown(3);

        const interval = setInterval(() => {
          setCountdown((prev) => {
            const next = prev - 1;

            if (next <= 0) {
              clearInterval(interval);

              (async () => {
                router.push("/dashboard?tab=buyer");
              })();
            }

            return next;
          });
        }, 1000);
      }
    } catch (err) {
      console.error("Payment failed:", err);
      toast.error("Payment failed. Please try again.");
    }
  };

  return (
    <>
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Pay Invoice</CardTitle>
          <CardDescription>Complete your payment</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-2">
              <Label htmlFor="id">Invoice ID</Label>
              <Input
                id="id"
                value={displayOrderId?.toString() ?? "Loading..."}
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
                  &quot;{sharedCreatorNote.message}&quot;
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
                !orderId ||
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
