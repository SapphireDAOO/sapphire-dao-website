"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Invoice } from "@/model/model";
import { Button } from "@/components/ui/button";
import React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { timeLeft } from "@/utils";
import AcceptInvoice from "./accept-invoice";
import CreateDispute from "./create-dispute";
import Refund from "./refund";

const marketplaceActions: ColumnDef<Invoice>[] = [
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
            {payment.status === "CREATED" && (
              <>
                {payment.type === "ReceivedInvoice" && (
                  <>
                    <DropdownMenuItem>Pay Invoice</DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                {payment.type === "IssuedInvoice" && t !== "Time Elapsed" && (
                  <>
                    <DropdownMenuItem>Waiting for Payment</DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
              </>
            )}

            {payment.status === "PAID" && (
              <>
                {payment.type === "IssuedInvoice" && t !== "Time Elapsed" && (
                  <>
                    <AcceptInvoice invoiceKey={payment.invoiceKey} />
                  </>
                )}

                {payment.type === "ReceivedInvoice" &&
                  t !== "Time Elapsed" &&
                  ""}

                {payment.type === "ReceivedInvoice" && t === "Time Elapsed" && (
                  <Refund invoiceKey={payment.invoiceKey} />
                )}
              </>
            )}

            {payment.status === "ACCEPTED" &&
              payment.type === "ReceivedInvoice" && (
                <CreateDispute invoiceKey={payment.invoiceKey} />
              )}

            {payment.status === "REJECTED" && (
              <DropdownMenuItem>Refunded</DropdownMenuItem>
            )}

            {payment.status === "CANCELED" && (
              <DropdownMenuItem>Invoice Cancelled</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export default marketplaceActions;
