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
import { useContext, useEffect, useState } from "react";
import { ConnectKitButton } from "connectkit";
import { PaymentCardProps } from "@/model/model";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
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

  const invoiceKEY = data?.invoiceKey;
  const { data: invoiceData } = useGetInvoiceData(invoiceKEY!);

  const { getInvoiceOwner, makeInvoicePayment, isLoading } =
    useContext(ContractContext);

  // Check if the connected user is the creator of the invoice
  useEffect(() => {
    const checkCreator = async () => {
      if (address && invoiceKEY) {
        const creatorCheck = await isCreator();
        setUserIsCreator(creatorCheck);
      }
    };

    checkCreator();
  }, [address, invoiceKEY]);

  const isCreator = async () => {
    const creator = await getInvoiceOwner(invoiceKEY!);
    return address?.toLowerCase() === creator.toLowerCase();
  };

  const handleClick = async () => {
    if (!invoiceData?.price) {
      toast.error("Invoice price not available.");
      return;
    }
    const success = await makeInvoicePayment(invoiceData.price, invoiceKEY!);
    if (success) {
      setOpen(true);
      toast.success("Payment successful!");
    }
  };

  const currStatus = invoiceData?.status;

  return (
    <>
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Pay invoice </CardTitle>
          <CardDescription>Make your invoice payment</CardDescription>
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
              <Label htmlFor="price">Request Amount</Label>
              <Input
                id="price"
                placeholder={`${
                  formatEther(invoiceData?.price ?? BigInt(0)) || "N/A"
                } POL`}
                disabled
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex">
          {address ? (
            <Button
              onClick={handleClick}
              className="w-full"
              disabled={
                invoiceData?.status !== 1 || userIsCreator || !invoiceKEY
              }
            >
              {isLoading === "makeInvoicePayment" ? (
                <>
                  <p>processing...</p>
                  <Loader2
                    className="inline-flex animate-spin"
                    size={10}
                    color="#cee7d6"
                  />
                </>
              ) : currStatus && currStatus !== 1 ? (
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

      <Dialog open={open} onOpenChange={() => {}}>
        <DialogPortal>
          <DialogOverlay className="fixed inset-0 bg-black/50" />
          <DialogContent className="fixed left-1/2  top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md p-8 text-gray-900 shadow bg-white">
            <DialogTitle className="text-xl font-bold">
              Payment Successful
            </DialogTitle>
            <DialogDescription></DialogDescription>
            <div className="flex flex-col items-center gap-4 mt-8">
              <p className="items-center">
                <CircleCheckBig
                  size={100}
                  color="#3baa2c"
                  strokeWidth={3}
                  absoluteStrokeWidth
                  className="circle-check-animate"
                />
              </p>
              <p>Your payment has been successfully processed.</p>
              <Button
                onClick={() => {
                  setOpen(false);
                  router.push("/dashboard");
                }}
              >
                Go to Dashboard
              </Button>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  );
};

export default PaymentCard;
