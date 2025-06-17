"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Invoice } from "@/model/model";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import SellersAction from "./sellers-action";
import CancelInvoice from "./cancel-payment";
import ReleaseInvoice from "./release-invoice";
import RefundBuyer from "./refund-buyer";
import { timeLeft } from "@/utils";
import generateSecureLink from "@/lib/generate-link";
import React from "react";

const invoiceActions: ColumnDef<Invoice>[] = [
  {
    id: "actions",
    cell: ({ row }) => {
      const paidAtTimestamp = row.getValue("paidAt");
      const t = timeLeft(Number(paidAtTimestamp), 259200000);

      const payment = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            {payment.type === "Seller" &&
              t !== "Time Elapsed" &&
              payment.status == "CREATED" && (
                <>
                  <DropdownMenuItem
                    onClick={async () => {
                      const domain =
                        typeof window !== "undefined"
                          ? window.location.origin
                          : "";
                      const encodedEncryptedData = generateSecureLink(
                        payment?.invoiceKey
                      );
                      navigator.clipboard.writeText(
                        `${domain}/pay/?data=${encodedEncryptedData}`
                      );
                      toast.success("Copied");
                    }}
                  >
                    Copy payment URL
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

            {payment?.status === "PAID" &&
              payment.type === "Seller" &&
              t !== "Time Elapsed" && (
                <>
                  <DropdownMenuItem>
                    <SellersAction
                      invoiceKey={payment.invoiceKey}
                      state={true}
                      text="Accept Payment"
                      key="0"
                    />
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <SellersAction
                      invoiceKey={payment.invoiceKey}
                      state={false}
                      text="Reject Payment"
                      key="1"
                    />
                  </DropdownMenuItem>
                </>
              )}
            {payment?.status === "CREATED" && (
              <DropdownMenuItem>
                <CancelInvoice invoiceKey={payment.invoiceKey} />
              </DropdownMenuItem>
            )}

            {payment?.status === "ACCEPTED" && payment.type === "Seller" && (
              <DropdownMenuItem>
                <ReleaseInvoice invoiceKey={payment.invoiceKey} />
              </DropdownMenuItem>
            )}
            {payment?.status !== "REFUNDED" &&
              payment?.status !== "REJECTED" &&
              payment?.type === "Seller" && (
                <DropdownMenuItem>
                  <RefundBuyer
                    invoiceKey={payment.invoiceKey}
                    timeStamp={payment.paidAt}
                  />
                </DropdownMenuItem>
              )}
            {payment?.status === "REFUNDED" ||
              (payment?.status === "REJECTED" && payment?.type === "Buyer" && (
                <DropdownMenuItem>
                  <Button className="w-full">All Settled</Button>
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export default invoiceActions;
