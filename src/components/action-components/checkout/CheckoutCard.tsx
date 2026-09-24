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
import { CircleCheckBig, Loader2, ShieldCheck } from "lucide-react";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
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
import { INTERMEDIATED_PAYMENT_PROCESSOR, BASE_SEPOLIA } from "@/constants";
import { formatAddress, formatDurationSeconds } from "@/utils";
import { useGetIntermediatedInvoiceData } from "@/hooks/useGetIntermediatedInvoiceData";
import { useInvoicePaymentOptions } from "@/hooks/useInvoicePaymentOptions";

interface CheckoutCardProps {
  data: InvoiceDetails;
  isMetaInvoice?: boolean;
}

const CheckoutCard = ({ data, isMetaInvoice }: CheckoutCardProps) => {
  const router = useRouter();
  const { address, chain } = useAccount();
  const chainId = chain?.id || BASE_SEPOLIA;
  const contractAddress = INTERMEDIATED_PAYMENT_PROCESSOR[chainId];

  // Escrow hold period, read from the intermediated processor. The struct calls
  // it escrowHoldPeriod; holdPeriod is kept as a fallback for the pre-rename shape.
  const { data: onChainInvoice } = useGetIntermediatedInvoiceData(data?.invoiceId);
  const holdPeriodSeconds = useMemo(() => {
    const fetched = onChainInvoice as
      | { escrowHoldPeriod?: number | bigint; holdPeriod?: number | bigint }
      | undefined;
    const raw = fetched?.escrowHoldPeriod ?? fetched?.holdPeriod;
    if (raw === undefined || raw === null) return undefined;
    const seconds = Number(raw);
    return Number.isFinite(seconds) ? seconds : undefined;
  }, [onChainInvoice]);

  const [open, setOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState("");

  const [countdown, setCountdown] = useState(3);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const { payIntermediatedInvoice, isLoading, refetchInvoiceData } =
    useContext(ContractContext);

  const normalizedStatus = data?.status?.toUpperCase?.();

  // Everything the chain might accept, before the invoice's own allow-list is
  // applied. A meta-invoice reports no status of its own, so the payable
  // decision for both kinds comes from the hook below rather than from here.
  const candidateTokens: TokenData[] = Array.isArray(data?.tokenList)
    ? data.tokenList.filter(Boolean)
    : data.tokenList
      ? [data.tokenList]
      : [];

  // The seller nominates the tokens when creating the invoice, and the state
  // has to be CREATED for the contract to take payment at all. Neither is in
  // the subgraph, so both are read from the processor.
  const {
    tokens: supportedTokens,
    isPayable: isPayableStatus,
    isLoading: isLoadingOptions,
  } = useInvoicePaymentOptions(data?.invoiceId, Boolean(isMetaInvoice), candidateTokens);

  // A token chosen before the allow-list landed, or left over from another
  // invoice, must not survive into the payment call.
  useEffect(() => {
    if (!selectedToken) return;
    if (supportedTokens.some((token) => token.id.toString() === selectedToken)) {
      return;
    }
    setSelectedToken("");
  }, [selectedToken, supportedTokens]);


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
      await payIntermediatedInvoice(paymentType, amount, data.invoiceId, tokenAddress)
    ) {
      setOpen(true);
      setCountdown(3);

      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          const next = prev - 1;

          if (next <= 0) {
            clearInterval(countdownIntervalRef.current!);
            countdownIntervalRef.current = null;

            (async () => {
              await refetchInvoiceData?.();
              router.push("/intermediated-dashboard/?tab=buyer");
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
          <div className="grid gap-4">
            {holdPeriodSeconds !== undefined && holdPeriodSeconds > 0 && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div className="space-y-1">
                  <p className="text-sm font-bold leading-tight text-amber-900">
                    Held in escrow for{" "}
                    {formatDurationSeconds(holdPeriodSeconds)}
                  </p>
                  <p className="text-xs leading-snug text-amber-800">
                    Your payment will be locked from the moment you pay, and
                    released to the seller once this period ends, provided no
                    dispute has been raised.
                  </p>
                </div>
              </div>
            )}
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
              <Select
                value={selectedToken}
                onValueChange={setSelectedToken}
                disabled={isLoadingOptions || supportedTokens.length === 0}
              >
                <SelectTrigger id="token" className="w-full">
                  <SelectValue
                    placeholder={
                      isLoadingOptions
                        ? "Loading accepted tokens..."
                        : supportedTokens.length === 0
                          ? "No accepted tokens"
                          : "Select a token"
                    }
                  />
                </SelectTrigger>

                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Accepted by this invoice</SelectLabel>
                    {supportedTokens.map((token) => (
                      <SelectItem key={token.id} value={token.id.toString()}>
                        {token.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {!isLoadingOptions && supportedTokens.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  The seller did not nominate any token this wallet can pay
                  with on this network.
                </p>
              )}
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
                  isLoadingOptions ||
                  !selectedToken ||
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
              {!isPayableStatus && !isLoadingOptions && (
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
