"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Invoice } from "@/model/model";
import { formatAddress, timeLeft } from "@/utils";
import { toast } from "sonner";
import generateSecureLink from "@/lib/generate-link";
import { QRCodeSVG } from "qrcode.react";
import SellersAction from "../invoices-components/sellers-action";
import CancelInvoice from "../invoices-components/cancel-payment";

// const mockNote: Note = {
//   id: "note-001",
//   sender: "0xA13f...B7E9",
//   message: "Payment confirmed. Shipping will begin tomorrow.",
//   timestamp: new Date().toLocaleString(),
// };

// const notes: Note[] = [mockNote];

const THREE_DAYS_IN_MILISECONDS = 259_200_000;

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

  // const isBuyerView =
  // invoice.type === "Buyer" || invoice.type === "ReceivedInvoice";

  // Auto-update countdown every second if invoice has timing info
  useEffect(() => {
    if (!invoice.paidAt && !invoice.releaseAt && !invoice.holdPeriod) return;

    const interval = setInterval(() => {
      let updatedTime = "—";

      if (invoice.status === "ACCEPTED" && invoice.releaseAt) {
        updatedTime = timeLeft(invoice.paidAt ?? 0, Number(invoice.releaseAt));
      } else if (invoice.status === "PAID" && invoice.paidAt) {
        updatedTime = timeLeft(invoice.paidAt ?? 0, THREE_DAYS_IN_MILISECONDS);
      }

      setCountdown(updatedTime);

      if (updatedTime === "Time Elapsed") {
        clearInterval(interval);
      }
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
      const id = invoice.orderId.toString();
      const encoded = generateSecureLink(id);
      return `${domain}/pay/?data=${encoded}`;
    } catch {
      return "";
    }
  }, [isExpanded, invoice.orderId]);

  const handleCopyLink = useCallback(() => {
    if (!paymentUrl) return;
    navigator.clipboard.writeText(paymentUrl);
    toast.success("Payment link copied!");
  }, [paymentUrl]);

  // Always show status, fallback to "Unknown"
  const displayStatus = invoice.status || "Unknown";

  if (invoice.status == "CREATED") {
    invoice.status = "AWAITING PAYMENT";
  }

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

  const badgeColor = statusColors[displayStatus] || "bg-gray-100 text-gray-600";

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="cursor-pointer select-none" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">#{invoice.id}</h3>
          <div className="flex items-center gap-2">
            {/* Always visible badge */}
            <Badge className={badgeColor}>{displayStatus}</Badge>
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
            ? `Paid: ${invoice.paidAt}`
            : invoice.status === "ACCEPTED"
            ? `Release in: ${countdown}`
            : "—"}
        </p>

        <div className="mt-1 space-y-2 text-xs text-gray-600">
          {invoice.price && (
            <p>
              Amount: <span className="text-black">{invoice.price} ETH</span>
            </p>
          )}

          {invoice.status === "AWAITING PAYMENT" && (
            <div>
              <CancelInvoice orderId={invoice.orderId} />
            </div>
          )}

          {invoice.status === "PAID" && isSellerView && (
            <div className="pt-4 mt-3 border-t border-gray-200 flex justify-end gap-3">
              <SellersAction
                orderId={invoice.orderId}
                state={true}
                text="Accept Payment"
              />
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
        <CardContent className="border-t pt-4 space-y-5 text-sm text-gray-800">
          {/* Contract Info */}
          {invoice.contract && (
            <p>
              <strong>Contract:</strong> {renderContractLink(invoice.contract)}
            </p>
          )}

          {/* Seller */}
          {invoice.seller && (
            <p>
              <strong>Creator:</strong> {renderContractLink(invoice.seller)}
            </p>
          )}

          {/* Amount Paid */}
          {invoice.amountPaid && (
            <p>
              <strong>Amount Paid:</strong> {invoice.amountPaid} ETH
            </p>
          )}

          {/* State History */}
          {invoice.history && invoice.history.length > 0 && (
            <div>
              <p className="font-semibold mb-1">State History:</p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {invoice.history.map((status, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span className="bg-gray-100 border border-gray-300 rounded-full px-3 py-1">
                      {status}
                    </span>
                    {invoice.history && idx < invoice.history.length - 1 && (
                      <span className="text-gray-400">→</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-3">
            {invoice.notes?.map((note) => (
              <div key={note.id} className="bg-gray-100 p-3 rounded-md text-xs">
                <p className="font-medium text-gray-700">{note.sender}</p>
                <p className="text-gray-600">{note.message}</p>
                <p className="text-gray-400 text-[10px] mt-1">
                  {note.timestamp}
                </p>
              </div>
            ))}

            {/* Optional Note Input */}
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

          {/* QR Code + Link */}
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

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 mt-3">
            {invoice.status === "Accepted" && (
              <Button
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                Release Funds
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

const renderContractLink = (address?: string) => {
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
