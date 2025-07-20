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
import { ConnectKitButton } from "connectkit";
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
  DialogDescription,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { type Address } from "viem";
import { InvoiceDetails, TokenData } from "@/model/model";

interface CheckoutCardProps {
  data: InvoiceDetails;
  isMetaInvoice: boolean | undefined;
}
const CheckoutCard = ({ data, isMetaInvoice }: CheckoutCardProps) => {
  const router = useRouter();
  const { address } = useAccount();
  const [open, setOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<string>("");
  const { payAdvancedInvoice, isLoading } = useContext(ContractContext);

  const supportedTokens: TokenData[] = Array.isArray(data?.tokenList)
    ? (data.tokenList as TokenData[]).filter(
        (t): t is TokenData => t !== undefined
      )
    : data.tokenList
    ? [data.tokenList]
    : [];

  const handleClick = async () => {
    if (!data?.price) {
      toast.error("Invoice price is not available.");
      return;
    }

    const paymentType = isMetaInvoice ? "payMetaInvoice" : "paySingleInvoice";
    const paymentToken = selectedToken as Address;

    if (!selectedToken) {
      toast.error("Please select a token to proceed.");
      return;
    }
    const amount = BigInt(data?.price);
    // paymentToken === zeroAddress as Address ?  : BigInt(0);

    const success = await payAdvancedInvoice(
      paymentType,
      amount,
      data.invoiceKey,
      paymentToken
    );

    if (success) {
      setOpen(true);
      toast.success("Payment successful!");
    }
  };

  return (
    <>
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Pay Invoice</CardTitle>
          <CardDescription>Make your invoice payment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid w-full items-center gap-4">
            {/* <div className="flex flex-col space-y-2">
              <Label htmlFor="id">Invoice ID</Label>
              <Input id="id" placeholder={data?.id || "N/A"} disabled />
            </div> */}

            <div className="flex flex-col space-y-2 mt-3">
              <Label htmlFor="price">Request Amount</Label>
              <Input
                id="price"
                placeholder={
                  data?.price
                    ? `$${(Number(data.price) / 1e8).toFixed(2)}`
                    : "N/A"
                }
                disabled
              />
            </div>

            <div className="flex flex-col space-y-2 mt-3">
              <Label htmlFor="token">Payment Token</Label>
              <Select
                value={selectedToken}
                onValueChange={(value) => setSelectedToken(value)}
              >
                <SelectTrigger id="token" className="w-full">
                  <SelectValue placeholder="Select a token" />
                </SelectTrigger>

                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>tokens</SelectLabel>
                    {supportedTokens?.map((token) => (
                      <SelectItem key={token.id} value={token.id}>
                        {token.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex">
          {address ? (
            <Button
              onClick={handleClick}
              className="w-full"
              disabled={
                isLoading === "payMetaInvoice" ||
                isLoading === "paySingleInvoice"
              }
            >
              {isLoading === "payMetaInvoice" ||
              isLoading === "paySingleInvoice" ? (
                <>
                  <p>Processing...</p>
                  <Loader2
                    className="inline-flex animate-spin"
                    size={10}
                    color="#cee7d6"
                  />
                </>
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
          <DialogContent className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md p-8 text-gray-900 shadow bg-white">
            <DialogTitle className="text-xl font-bold">
              Payment Successful
            </DialogTitle>
            <DialogDescription />
            <div className="flex flex-col items-center gap-4 mt-8">
              <CircleCheckBig
                size={100}
                color="#3baa2c"
                strokeWidth={3}
                absoluteStrokeWidth
                className="circle-check-animate"
              />
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

export default CheckoutCard;
