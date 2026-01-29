"use client";

import { useAccount } from "wagmi";
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
import { useContext, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { type Address } from "viem";
import { InvoiceDetails, TokenData } from "@/model/model";
import { Textarea } from "@/components/ui/textarea";
import { createNote as createInvoiceNote } from "@/services/notes";
import { ADVANCED_PAYMENT_PROCESSOR, ETHEREUM_SEPOLIA } from "@/constants";
import { formatAddress } from "@/utils";

interface CheckoutCardProps {
  data: InvoiceDetails;
  isMetaInvoice?: boolean;
}

const CheckoutCard = ({ data, isMetaInvoice }: CheckoutCardProps) => {
  console.log(data, isMetaInvoice);
  const router = useRouter();
  const { address, chain } = useAccount();
  const contractAddress =
    ADVANCED_PAYMENT_PROCESSOR[chain?.id || ETHEREUM_SEPOLIA];

  const [open, setOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [shareNote, setShareNote] = useState(false);

  const [countdown, setCountdown] = useState(3);

  const { payAdvancedInvoice, isLoading, refetchInvoiceData } =
    useContext(ContractContext);

  const normalizedStatus = data?.status?.toUpperCase?.();
  const isPayableStatus =
    !normalizedStatus ||
    normalizedStatus === "CREATED" ||
    normalizedStatus === "INITIATED" ||
    normalizedStatus === "AWAITING PAYMENT";

  const supportedTokens: TokenData[] = Array.isArray(data?.tokenList)
    ? data.tokenList.filter(Boolean)
    : data.tokenList
      ? [data.tokenList]
      : [];

  const savePaymentNote = async () => {
    const trimmed = paymentNote.trim();
    if (!trimmed) return;

    if (!address) {
      toast.error("Connect your wallet to add notes.");
      return;
    }

    try {
      await createInvoiceNote({
        orderId: data.orderId.toString(),
        author: address,
        content: trimmed,
        share: shareNote,
      });
    } catch (error) {
      console.error("Failed to save payment note:", error);
      toast.error("Unable to save payment note.");
    }
  };

  const handleClick = async () => {
    if (!isPayableStatus) {
      toast.error("This invoice is no longer payable.");
      return;
    }

    if (!selectedToken) {
      toast.error("Please select a token first.");
      return;
    }

    const paymentType = isMetaInvoice ? "payMetaInvoice" : "paySingleInvoice";
    const tokenAddress = selectedToken as Address;
    const amount = BigInt(data.price);

    if (
      await payAdvancedInvoice(paymentType, amount, data.orderId, tokenAddress)
    ) {
      setOpen(true);
      void savePaymentNote();
      setCountdown(3);

      const interval = setInterval(() => {
        setCountdown((prev) => {
          const next = prev - 1;

          if (next <= 0) {
            clearInterval(interval);

            (async () => {
              await refetchInvoiceData?.();
              router.push("/marketplace-dashboard/?tab=buyer");
            })();
          }

          return next;
        });
      }, 1000);
    }
  };

  return (
    <>
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Pay Invoice</CardTitle>
          <CardDescription>
            This invoice is bounded to the blockchain by contract{" "}
            {contractAddress ? (
              <a
                href={`https://sepolia.etherscan.io/address/${contractAddress}`}
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
          <div className="grid gap-4">
            {/* Request Amount */}
            <div className="flex flex-col space-y-2">
              <Label>Request Amount</Label>
              <Input
                placeholder={
                  data?.price
                    ? `${(Number(data.price) / 1e8).toFixed(2)} USD`
                    : "N/A"
                }
                disabled
              />
            </div>

            {/* Token Selector */}
            <div className="flex flex-col space-y-2 mt-3">
              <Label>Payment Token</Label>
              <Select value={selectedToken} onValueChange={setSelectedToken}>
                <SelectTrigger id="token" className="w-full">
                  <SelectValue placeholder="Select a token" />
                </SelectTrigger>

                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Tokens</SelectLabel>
                    {supportedTokens.map((token) => (
                      <SelectItem key={token.id} value={token.id.toString()}>
                        {token.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

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
            <div className="w-full flex flex-col gap-2">
              <Button
                onClick={handleClick}
                className="w-full"
                disabled={
                  !isPayableStatus ||
                  isLoading === "paySingleInvoice" ||
                  isLoading === "payMetaInvoice"
                }
              >
                {isLoading === "paySingleInvoice" ||
                isLoading === "payMetaInvoice" ? (
                  <>
                    <span>Processing...</span>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  </>
                ) : (
                  "Make Payment"
                )}
              </Button>
              {!isPayableStatus && (
                <p className="text-center text-sm text-red-500">
                  Invoice is not payable in its current status{" "}
                  {normalizedStatus ? `(${normalizedStatus})` : ""}.
                </p>
              )}
            </div>
          ) : (
            <ConnectButton chainStatus="icon" showBalance={false} />
          )}
        </CardFooter>
      </Card>

      {/* SUCCESS POPUP */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 bg-black/50" />
          <DialogContent className="fixed left-1/2 top-1/2 max-w-md w-full -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-8 text-center shadow-lg">
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

            {/* Countdown */}
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

export default CheckoutCard;
