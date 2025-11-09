"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { Invoice, Note } from "@/model/model";
import { formatAddress, timeLeft, unixToGMT } from "@/utils";
import { toast } from "sonner";
import generateSecureLink from "@/lib/generate-link";
import { QRCodeSVG } from "qrcode.react";
import SellersAction from "../invoices-components/sellers-action";
import CancelInvoice from "../invoices-components/cancel-payment";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const mockNote: Note = {
  id: "note-001",
  sender: "0xA13f...B7E9",
  message: "Payment confirmed. Shipping will begin tomorrow.",
  timestamp: new Date().toLocaleString(),
};

const THREE_DAYS_IN_MS = 259_200_000;

export function InvoiceCard({
  invoice,
  isExpanded,
  onToggle,
  onAddNote,
}: {
  invoice: Invoice;
  isExpanded: boolean;
  onToggle: () => void;
  onAddNote: (invoiceId: string, message: string) => void;
}) {
  const [noteInput, setNoteInput] = useState("");
  const [countdown, setCountdown] = useState<string>("—");

  const isSellerView =
    invoice.type === "Seller" || invoice.type === "IssuedInvoice";

  const isBuyerView =
    invoice.type === "Buyer" || invoice.type === "ReceivedInvoice";

  // Update countdown every second (only when necessary)
  useEffect(() => {
    if (!invoice.paidAt && !invoice.releaseAt && !invoice.holdPeriod) return;

    const interval = setInterval(() => {
      let updated = "—";
      if (invoice.status === "ACCEPTED" && invoice.releaseAt) {
        updated = timeLeft(invoice.paidAt ?? 0, Number(invoice.releaseAt));
      } else if (invoice.status === "PAID" && invoice.paidAt) {
        updated = timeLeft(invoice.paidAt ?? 0, THREE_DAYS_IN_MS);
      }

      setCountdown(updated);
      if (updated === "Time Elapsed") clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [invoice.status, invoice.paidAt, invoice.releaseAt, invoice.holdPeriod]);

  const handleAddNote = useCallback(() => {
    const trimmed = noteInput.trim();
    if (!trimmed) return;
    onAddNote(invoice.id, trimmed);
    setNoteInput("");
  }, [noteInput, onAddNote, invoice.id]);

  const paymentUrl = useMemo(() => {
    if (!isExpanded || !invoice.orderId) return "";
    try {
      const domain = window.location.origin;
      const encoded = generateSecureLink(invoice.orderId.toString());
      return `${domain}/pay/?data=${encoded}`;
    } catch {
      return "";
    }
  }, [isExpanded, invoice.orderId]);

  const notesToDisplay =
    invoice.notes && invoice.notes.length > 0 ? invoice.notes : [mockNote];

  const handleCopyLink = useCallback(() => {
    if (!paymentUrl) return;
    navigator.clipboard.writeText(paymentUrl);
    toast.success("Payment link copied!");
  }, [paymentUrl]);

  const displayStatus =
    invoice.status === "CREATED"
      ? "AWAITING PAYMENT"
      : invoice.status || "Unknown";

  const statusColors: Record<string, string> = {
    CREATED: "bg-blue-100 text-blue-800",
    "AWAITING PAYMENT": "bg-yellow-100 text-yellow-800",
    PAID: "bg-orange-100 text-orange-800",
    ACCEPTED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
    CANCELLED: "bg-gray-100 text-gray-800",
    RELEASED: "bg-purple-100 text-purple-800",
    REFUNDED: "bg-indigo-100 text-indigo-800",
    DISPUTED: "bg-pink-100 text-pink-800",
    "Dispute Resolved": "bg-teal-100 text-teal-800",
    Unknown: "bg-gray-100 text-gray-600",
  };

  const badgeColor = statusColors[displayStatus] ?? "bg-gray-100 text-gray-600";

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="cursor-pointer select-none" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">#{invoice.id}</h3>
          <div className="flex items-center gap-2">
            <Badge
              className={`${badgeColor} cursor-default select-none hover:bg-inherit hover:text-inherit`}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {displayStatus}
            </Badge>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </div>

        <p className="mt-1 text-xs text-gray-500">
          {invoice.status === "PAID" && isSellerView
            ? `Decision window: ${countdown}`
            : invoice.status === "PAID"
            ? `Paid At: ${unixToGMT(invoice.paidAt)}`
            : invoice.status === "ACCEPTED"
            ? `Release in: ${countdown}`
            : "—"}
        </p>

        <div className="mt-2 space-y-2 text-xs text-gray-600">
          {invoice.price && (
            <p>
              Amount: <span className="text-black">{invoice.price} ETH</span>
            </p>
          )}

          {invoice.status === "REJECTED" && (
            <>
              <InvoiceField
                label="Contract"
                value={renderContractLink(invoice.contract)}
                description="Smart contract handling escrow and release logic."
                link="https://sapphiredao.gitbook.io/sapphiredao-docs/technical-docs/core-contracts"
              />

              <InvoiceField
                label="Creator"
                value={renderContractLink(invoice.seller)}
                description="Seller or issuer who created this invoice."
                link="https://sapphiredao.gitbook.io/sapphiredao-docs/user-docs/publish-your-docs#seller"
              />

              <InvoiceField
                label="Amount Paid"
                value={`${invoice.amountPaid} ETH`}
                description="The amount already paid into escrow by the buyer."
              />

              {isBuyerView && (
                <p className="text-xs text-red-600 font-medium mt-2">
                  Order rejected by{" "}
                  <a
                    href={`https://sepolia.etherscan.io/address/${invoice.seller}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-red-700 hover:text-red-800"
                  >
                    {invoice.seller
                      ? `${invoice.seller.slice(0, 6)}...${invoice.seller.slice(
                          -4
                        )}`
                      : "Unknown Contract"}
                  </a>{" "}
                  — refund initiated.
                </p>
              )}

              {notesToDisplay.map((note) => (
                <div
                  key={note.id}
                  className="bg-gray-100 p-3 rounded-md text-xs"
                >
                  <p className="font-medium text-gray-700">{note.sender}</p>
                  <p className="text-gray-600">{note.message}</p>
                  <p className="text-gray-400 text-[10px] mt-1">
                    {note.timestamp}
                  </p>
                </div>
              ))}
            </>
          )}

          {invoice.status === "AWAITING PAYMENT" && (
            <CancelInvoice orderId={invoice.orderId} />
          )}

          {invoice.status === "PAID" && isSellerView && (
            <div className="pt-4 mt-3 border-t border-gray-200 flex justify-end gap-3">
              <SellersAction orderId={invoice.orderId} state text="Accept" />
              <SellersAction
                orderId={invoice.orderId}
                state={false}
                text="Reject"
              />
            </div>
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="border-t pt-4 space-y-3 text-sm text-gray-800">
          {invoice.contract && invoice.status !== "REJECTED" && (
            <InvoiceField
              label="Contract"
              value={renderContractLink(invoice.contract)}
              description="Smart contract handling invoice creation, escrow, and release."
              link="https://sapphiredao.gitbook.io/sapphiredao-docs/technical-docs/core-contracts"
            />
          )}

          {invoice.seller && invoice.status !== "REJECTED" && (
            <InvoiceField
              label="Creator"
              value={renderContractLink(invoice.seller)}
              description="The seller or issuer who created this invoice."
              link="https://sapphiredao.gitbook.io/sapphiredao-docs/user-docs/publish-your-docs#seller"
            />
          )}

          {invoice.buyer && invoice.status !== "REJECTED" && (
            <InvoiceField
              label="Payer"
              value={renderContractLink(invoice.buyer)}
              description="The buyer or payer responsible for completing the transaction."
              link="https://sapphiredao.gitbook.io/sapphiredao-docs/user-docs/publish-your-docs#buyer"
            />
          )}

          {invoice.price && invoice.status !== "REJECTED" && (
            <InvoiceField
              label="Invoice Amount"
              value={`${invoice.price} ETH`}
              description="Total amount requested by the seller (excluding gas and protocol fees)."
            />
          )}

          {invoice.amountPaid && invoice.status !== "REJECTED" && (
            <InvoiceField
              label="Amount Paid"
              value={`${invoice.amountPaid} ETH`}
              description="The amount already paid into escrow by the buyer."
            />
          )}
          {invoice.history &&
            invoice.history.length > 0 &&
            invoice.status !== "REJECTED" && (
              <InvoiceField
                label="State History"
                value={
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {invoice.history.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <span className="bg-gray-100 border border-gray-300 rounded-full px-3 py-1">
                          {entry.status}
                          <span className="ml-2 text-[10px] text-gray-500">
                            {entry.time
                              ? unixToGMT(entry.time).toLocaleString()
                              : ""}
                          </span>
                        </span>
                        {idx < invoice.history!.length - 1 && (
                          <span className="text-gray-400">→</span>
                        )}
                      </div>
                    ))}
                  </div>
                }
                description="All state transitions this invoice has gone through with their timestamps."
              />
            )}

          <div className="space-y-3">
            {invoice.status !== "REJECTED" &&
              notesToDisplay.map((note) => (
                <div
                  key={note.id}
                  className="bg-gray-100 p-3 rounded-md text-xs"
                >
                  <p className="font-medium text-gray-700">{note.sender}</p>
                  <p className="text-gray-600">{note.message}</p>
                  <p className="text-gray-400 text-[10px] mt-1">
                    {note.timestamp}
                  </p>
                </div>
              ))}

            <div className="flex items-center gap-2">
              <Input
                placeholder="Write a note..."
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                className="flex-1 text-sm"
              />
              <Button size="sm" onClick={handleAddNote}>
                Send
              </Button>
            </div>
          </div>

          {paymentUrl && invoice.status === "AWAITING PAYMENT" && (
            <div className="mt-4 flex flex-col items-center gap-3">
              <div className="border border-dashed p-2 rounded-xl bg-gray-50">
                <QRCodeSVG value={paymentUrl} size={120} level="H" />
              </div>
              <Button size="sm" variant="outline" onClick={handleCopyLink}>
                Copy Payment Link
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/* Helper for contract link */
export const renderContractLink = (address?: string) => {
  if (!address) return <span className="text-gray-500">—</span>;
  return (
    <a
      href={`https://sepolia.etherscan.io/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 underline hover:text-blue-800"
    >
      {formatAddress(address)}
    </a>
  );
};

/* Small reusable field row with info icon */
export const InvoiceField = ({
  label,
  value,
  description,
  link,
}: {
  label: string;
  value: React.ReactNode;
  description: string;
  link?: string;
}) => {
  return (
    <div className="text-sm text-gray-800 flex flex-wrap items-center gap-1">
      <span className="font-semibold">{label}</span>

      {/* Info icon with tooltip (desktop) and popover (mobile) */}
      <div className="flex items-center">
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`${label} info`}
                className="cursor-pointer flex items-center focus:outline-none"
              >
                <Info className="w-3.5 h-3.5 text-gray-500 hover:text-gray-700 transition" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="w-60 text-xs p-3 bg-white border border-gray-200 rounded-md shadow-md text-gray-700">
              <p>{description}</p>
              {link && (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline hover:text-blue-800 mt-2 inline-block"
                >
                  View Details
                </a>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <span>:</span>
      <span className="truncate">{value}</span>
    </div>
  );
};
