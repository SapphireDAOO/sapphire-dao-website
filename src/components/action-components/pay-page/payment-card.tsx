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
import { useCallback, useContext, useEffect, useState } from "react";
import { ConnectKitButton } from "connectkit";
import { PaymentCardProps } from "@/model/model";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatEther } from "viem";
import { useGetInvoiceData } from "@/hooks/useGetInvoiceData";

const PaymentCard = ({ data }: PaymentCardProps) => {
  const { address } = useAccount();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [userIsCreator, setUserIsCreator] = useState(false);

  const [countdown, setCountdown] = useState(3);

  const orderId = data?.orderId;
  const { data: invoiceData } = useGetInvoiceData(orderId);

  const { getInvoiceOwner, makeInvoicePayment, isLoading, refetchInvoiceData } =
    useContext(ContractContext);

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
    if (!invoiceData?.price || !orderId) {
      toast.error("Invoice is missing price or order ID.");
      return;
    }

    try {
      if (await makeInvoicePayment(invoiceData.price, orderId)) {
        setOpen(true);

        setCountdown(3);

        const interval = setInterval(() => {
          setCountdown((prev) => {
            const next = prev - 1;

            if (next <= 0) {
              clearInterval(interval);

              (async () => {
                await refetchInvoiceData?.();
                await new Promise((resolve) => setTimeout(resolve, 1500));
                router.push("/dashboard?tab=buyer");
              })();
            }

            return next;
          });
        }, 1000);
      }
    } catch (err) {
      console.error("Payment failed:", err);
    }
  };

  const currStatus = invoiceData?.status;

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
                placeholder={`${invoiceData?.invoiceId || "N/A"}`}
                disabled
              />
            </div>

            <div className="flex flex-col space-y-2 mt-3">
              <Label htmlFor="price">Requested Amount</Label>
              <Input
                id="price"
                value={`${formatEther(invoiceData?.price ?? BigInt(0))} ETH`}
                disabled
              />
            </div>
          </div>
        </CardContent>

        <CardFooter>
          {address ? (
            <Button
              onClick={handlePayment}
              className="w-full"
              disabled={
                currStatus !== 1 ||
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
              ) : currStatus !== 1 ? (
                "RESOLVED"
              ) : (
                "Make Payment"
              )}
            </Button>
          ) : (
            <ConnectKitButton mode="dark" />
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
