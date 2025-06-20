"use client";
import { useAccount } from "wagmi";
import { useContext, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGetFeeRate } from "@/hooks/useGetFeeRate";
import { ContractContext } from "@/context/contract-context";
import { ConnectKitButton } from "connectkit";
import { type Address, parseUnits } from "viem";
import { CirclePlus, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import generateSecureLink from "@/lib/generate-link";

const CreateInvoiceDialog = () => {
  const [amount, setAmount] = useState("");
  const { address } = useAccount();
  const { data: formatedFee } = useGetFeeRate();

  const [openCreate, setOpenCreate] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);
  const [invoiceKey, setInvoiceKey] = useState<Address>("0x");

  const { createInvoice, refetchInvoiceData, isLoading } =
    useContext(ContractContext);

  const handleClick = async () => {
    const amountValue = parseUnits(amount, 18);
    const response = await createInvoice(amountValue);

    setOpenCreate(false);
    if (response) {
      setInvoiceKey(response);
      refetchInvoiceData?.();
      setOpen(true);
    }
  };
  // const formatedFee = data ? parseInt(data.toString()) / 100 : "0";
  // const formatedFee = "0";
  const isAmountValid = true;
  return (
    <>
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogTrigger asChild>
          <Button variant="ghost">
            <CirclePlus className="h-4 w-4" />
            Create Invoice
          </Button>
        </DialogTrigger>
        <DialogContent className="w-1/2">
          <DialogHeader>
            <DialogTitle className="text-2xl">New Invoice</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Additional fee of {Number(formatedFee) / 100} % applies
              excluding gas fee
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-8 my-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="value" className="text-right">
                Amount
              </Label>
              <Input
                id="value"
                type="number"
                value={amount}
                placeholder="Enter amount in pol"
                onChange={(e) => setAmount(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Close
              </Button>
            </DialogClose>
            {address ? (
              <Button onClick={handleClick} disabled={!isAmountValid}>
                {isLoading === "createInvoice" ? (
                  <Loader2
                    className="inline-flex animate-spin"
                    size={10}
                    color="#cee7d6"
                  />
                ) : (
                  "Create Invoice"
                )}
              </Button>
            ) : (
              <ConnectKitButton mode="dark" />
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <InvoiceQRLink open={open} setOpen={setOpen} invoiceKey={invoiceKey} />
    </>
  );
};
export default CreateInvoiceDialog;

interface InvoiceQRLinkProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  invoiceKey: Address;
}

export const InvoiceQRLink = ({
  open,
  setOpen,
  invoiceKey,
}: InvoiceQRLinkProps) => {
  const domain = typeof window !== "undefined" ? window.location.origin : "";

  const encodedEncryptedData = generateSecureLink(invoiceKey!);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(
      `${domain}/pay/?data=${encodedEncryptedData}`
    );
    toast.success("Copied");
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-1/2">
        <DialogHeader>
          <DialogTitle className="text-2xl">Successfully Created</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            *Scan this Qr to proceed to payment page*
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-8 my-4">
          <QRCodeSVG value={`${domain}/pay/?data=${encodedEncryptedData}`} />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Close
            </Button>
          </DialogClose>
          <Button onClick={handleCopyLink}>Copy Link</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
