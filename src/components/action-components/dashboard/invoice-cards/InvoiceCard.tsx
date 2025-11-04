"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Invoice } from "@/model/model";
import { formatAddress } from "@/utils";
import { toast } from "sonner";
import generateSecureLink from "@/lib/generate-link";
import { QRCodeSVG } from "qrcode.react";

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
    invoice.status = "Awaiting Payment";
  }

  const statusColors: Record<string, string> = {
    Created: "bg-blue-100 text-blue-800",
    "Awaiting Payment": "bg-yellow-100 text-yellow-800",
    Paid: "bg-orange-100 text-orange-800",
    Accepted: "bg-green-100 text-green-800",
    Rejected: "bg-red-100 text-red-800",
    Cancelled: "bg-gray-100 text-gray-800",
    Released: "bg-purple-100 text-purple-800",
    Refunded: "bg-indigo-100 text-indigo-800",
    Disputed: "bg-pink-100 text-pink-800",
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
          {invoice.status === "Awaiting Payment" && invoice.holdPeriod
            ? `Decision window: ${invoice.holdPeriod}`
            : invoice.status === "Paid" && invoice.paidAt
            ? `Paid: ${invoice.paidAt}`
            : invoice.status === "Accepted" && invoice.releaseAt
            ? `Release in: ${invoice.releaseAt}`
            : "—"}
        </p>

        <div className="mt-1 space-y-1 text-xs text-gray-600">
          {invoice.createdAt && (
            <p>
              Created At:{" "}
              <span className="text-black">
                {invoice.createdAt}
              </span>
            </p>
          )}
          {invoice.contract && (
            <p>
              Contract:{" "}
              <span className="text-blue-600 underline">
                {formatAddress(invoice.contract)}
              </span>
            </p>
          )}
          {invoice.buyer && (
            <p>
              Buyer:{" "}
              <span className="text-blue-600 underline">
                {formatAddress(invoice.buyer)}
              </span>
            </p>
          )}
          {invoice.seller && (
            <p>
              Seller:{" "}
              <span className="text-blue-600 underline">
                {formatAddress(invoice.seller)}
              </span>
            </p>
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="border-t pt-4 space-y-4">
          {/* Notes */}
          <div className="space-y-2">
            {(invoice.notes ?? []).map((note) => (
              <div key={note.id} className="rounded bg-gray-50 p-3 text-xs">
                <p className="font-medium text-gray-700">{note.sender}</p>
                <p className="text-gray-600">{note.message}</p>
                <p className="mt-1 text-xs text-gray-400">{note.timestamp}</p>
              </div>
            ))}
          </div>

          {/* Add Note */}
          <div className="flex gap-2">
            <Input
              placeholder="Add a note..."
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
              className="flex-1 text-xs"
            />
            <Button size="sm" onClick={handleAddNote}>
              Send
            </Button>
          </div>

          {/* QR + Copy Link */}
          {paymentUrl && (
            <div className="my-4 flex flex-col items-center gap-3">
              <div className="flex h-32 w-32 items-center justify-center rounded-xl border-2 border-dashed bg-gray-50 p-2">
                <QRCodeSVG value={paymentUrl} size={120} level="H" />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyLink}
                className="text-blue-600 hover:text-blue-700"
              >
                Copy Payment Link
              </Button>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {invoice.status === "Awaiting Payment" && (
              <Button size="sm">Pay Now</Button>
            )}
            {invoice.status === "Paid" && (
              <>
                <Button size="sm" className="bg-green-600 hover:bg-green-700">
                  Accept
                </Button>
                <Button size="sm" className="bg-red-600 hover:bg-red-700">
                  Reject
                </Button>
              </>
            )}
            {invoice.status === "Accepted" && (
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                Release Funds
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
